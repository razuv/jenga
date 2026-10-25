import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {connectP2P,validRoom,validState,iceServers} from '../src/p2p.js';
class Connection extends EventEmitter{
 constructor(peer,label){super();this.peer=peer;this.label=label;this.open=false;this.dataChannel={bufferedAmount:0};}
 send(message){if(!this.open)throw new Error('closed');const copy=structuredClone(message);queueMicrotask(()=>{if(this.other.open)this.other.emit('data',copy);});}
 close(){if(this.closed)return;this.closed=true;this.open=false;queueMicrotask(()=>this.emit('close'));this.other?.close();}
}
class FakePeer extends EventEmitter{
 static peers=new Map();static counter=0;
 constructor(id){super();this.id=id||`guest-${++FakePeer.counter}`;this.connections=[];FakePeer.peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
 connect(id,options){const target=FakePeer.peers.get(id),a=new Connection(id,options.label),b=new Connection(this.id,options.label);a.other=b;b.other=a;this.connections.push(a);
 queueMicrotask(()=>{if(!target){this.emit('error',{type:'peer-unavailable'});return;}target.connections.push(b);target.emit('connection',b);if(!a.closed){a.open=true;b.open=true;a.emit('open');b.emit('open');}});return a;
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;FakePeer.peers.delete(this.id);this.connections.forEach(c=>c.close());this.emit('close');}
 reconnect(){}
}
async function client(data){
 const current={},listeners=[];
 const transport=await connectP2P(data,(type,value)=>{current[type]=value;listeners.forEach(listener=>listener(type,value));},{PeerClass:FakePeer,timeout:3000});
 current.room=transport.room;current.state=transport.state;
 return {transport,current,wait(type,predicate=()=>true){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Timeout: ${type}`)),6000);listeners.push((event,value)=>{if(event===type&&predicate(value)){clearTimeout(timer);resolve(value);}});});}};
}
test('P2P host enforces six seats, turn ownership, reset and disconnect rules',{timeout:15000},async t=>{
 const host=await client({name:'Хост'});t.after(()=>host.transport.disconnect());
 assert(validRoom(host.current.room));assert(validState(host.current.state,host.current.room));
 const guests=[];for(let i=0;i<5;i++){const guest=await client({code:host.current.room.code,name:`Игрок ${i}`});guests.push(guest);t.after(()=>guest.transport.disconnect());}
 assert.equal(host.current.room.players.length,6);assert.equal(new Set(host.current.room.players.map(p=>p.avatar)).size,6);
 await assert.rejects(client({code:host.current.room.code}),/заполнена/);
 guests[0].transport.emit('start');assert.equal(host.current.room.started,false);
 host.transport.emit('start');await guests[0].wait('room',r=>r.started);
 guests[0].transport.emit('action',{type:'select',id:30});assert.equal((await host.wait('state')).active,null);
 host.transport.emit('action',{type:'select',id:30});assert.equal(host.current.state.active,30);
 guests[0].transport.emit('action',{type:'pull',value:3.7});assert.equal((await host.wait('state')).distance,0);
 host.transport.emit('action',{type:'pull',value:3.7});host.transport.emit('action',{type:'release'});
 const state=await guests[0].wait('state',s=>s.moves===1);assert.equal(state.turn,1);assert.equal(state.blocks[30][7],18);
 guests[0].transport.emit('reset');assert.equal((await host.wait('state')).moves,1);
 await host.wait('state',s=>s.cooldown===0);
 guests[0].transport.emit('action',{type:'select',id:24});await host.wait('state',s=>s.active===24);
 const left=host.wait('room',r=>r.players.length===5);guests[0].transport.disconnect();await left;
 assert.equal((await host.wait('state')).active,null);assert.equal(host.current.state.turn,1);
 host.transport.emit('reset');assert.equal(host.current.state.moves,0);assert.equal(host.current.state.turn,0);
 const ended=guests[1].wait('error');host.transport.disconnect();assert.match(await ended,/Хост вышел|связь|Связь/);
});
test('P2P rejects malformed codes and untrusted state',async()=>{
 await assert.rejects(connectP2P({code:'bad'},()=>{}, {PeerClass:FakePeer}),/8 символов/);
 assert(!validRoom({local:false,players:[]}));assert(!validRoom({local:false,code:'12345678',owner:'host',started:false,players:[null]}));assert(!validState({blocks:[[NaN]]},{players:[{}]}));
});

test('ICE configuration supports managed relays and rejects broken configuration',()=>{
 assert(iceServers().some(s=>[].concat(s.urls).some(url=>url.includes('transport=tcp'))));
 const config=[{urls:'turns:relay.example.com:443?transport=tcp',username:'temporary-user',credential:'temporary-token'}];
 assert.deepEqual(iceServers(JSON.stringify(config)),config);
 for(const bad of ['invalid','[]','{}','[{"urls":"https://example.com"}]'])assert.throws(()=>iceServers(bad),/STUN/);
});
