import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession} from '../src/session.js';
const join=(session,data)=>new Promise(resolve=>session.emit('join',data,resolve));
test('static hosting supports six local players, physics, turns and restart without a server',{timeout:12000},async t=>{
 const session=createSession({serverURL:null});t.after(()=>session.disconnect());
 let room,state;session.on('room',r=>room=r);session.on('state',s=>state=s);
 assert((await join(session,{local:true,count:6})).ok);
 assert.equal(room.players.length,6);assert.equal(new Set(room.players.map(p=>p.avatar)).size,6);assert.equal(state.blocks.length,54);
 session.emit('action',{type:'select',id:30});assert.equal(state.active,30);
 const completed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local turn stalled')),8000);session.on('state',s=>{if(s.moves===1){clearTimeout(timer);resolve(s);}});});
 session.emit('action',{type:'pull',value:3.7});session.emit('action',{type:'release'});
 assert.equal((await completed).turn,1);session.emit('reset');assert.equal(state.moves,0);assert.equal(state.turn,0);
 const unavailable=await join(session,{local:false,code:'bad'});assert.match(unavailable.error,/8 символов/);
 session.emit('action',{type:'select',id:30});assert.equal(state.active,30);
});
