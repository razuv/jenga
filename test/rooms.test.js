import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {io} from 'socket.io-client';
const wait=(socket,event,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timeout: ${event}`));},8000);function handler(value){if(predicate(value)){clearTimeout(timer);socket.off(event,handler);resolve(value);}}socket.on(event,handler);});
const join=(socket,data)=>new Promise(resolve=>socket.emit('join',data,resolve));
test('six-player rooms enforce capacity, turns, start and ownership transfer',{timeout:20000},async t=>{
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'0',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 const [data]=await once(child.stdout,'data');const url=data.toString().match(/http:\/\/localhost:\d+/)?.[0];assert(url);
 const sockets=[];t.after(()=>sockets.forEach(s=>s.disconnect()));
 async function client(){const s=io(url,{transports:['websocket'],forceNew:true});sockets.push(s);await once(s,'connect');return s;}
 const host=await client();let roomPromise=wait(host,'room');assert((await join(host,{local:false,name:'Хозяин'})).ok);const room=await roomPromise;
 const guests=[];for(let i=0;i<5;i++){const guest=await client();assert((await join(guest,{code:room.code,name:`Игрок ${i}`})).ok);guests.push(guest);}
 const seventh=await client();assert.match((await join(seventh,{code:room.code})).error,/заполнена/);
 guests[0].emit('action',{type:'select',id:30});let state=await wait(host,'state');assert.equal(state.active,null);
 roomPromise=wait(host,'room',r=>r.started);host.emit('start');const fullRoom=await roomPromise;assert.equal(fullRoom.players.length,6);assert.equal(new Set(fullRoom.players.map(p=>p.avatar)).size,6);
 guests[0].emit('action',{type:'select',id:30});state=await wait(host,'state');assert.equal(state.active,null);
 host.emit('action',{type:'select',id:30});state=await wait(host,'state',s=>s.active===30);assert.equal(state.turn,0);
 host.emit('action',{type:'pull',value:3.7});
 host.emit('action',{type:'release'});state=await wait(host,'state',s=>s.moves===1);assert.equal(state.turn,1);assert.equal(state.blocks[30][7],18);
 const nextRoom=wait(guests[0],'room',r=>r.owner===guests[0].id);host.disconnect();assert.equal((await nextRoom).players.length,5);state=await wait(guests[0],'state');assert.equal(state.turn,0);
 assert.match((await join(seventh,{code:room.code})).error,/началась/);
});
