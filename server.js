import express from 'express';
import {createServer} from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {Server} from 'socket.io';
import {Game} from './src/game.js';
import {MEMES} from './src/memes.js';
function shuffleAvatars(){const ids=MEMES.map(m=>m.id);for(let i=ids.length-1;i>0;i--){const j=randomInt(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
const app=express(),http=createServer(app),io=new Server(http,{maxHttpBufferSize:8192});
const rooms=new Map();
if(process.env.NODE_ENV==='production')app.use(express.static('dist'));
else {const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
function info(r){return {code:r.code,local:r.local,players:r.local?Array.from({length:r.count},(_,i)=>({id:r.owner,name:`Игрок ${i+1}`,avatar:r.avatars[i]})):r.players,owner:r.owner,started:r.started};}
function publish(r){io.to(r.code).emit('room',info(r));}
function leave(s){const r=rooms.get(s.data.room);if(!r)return;s.leave(r.code);const removed=r.players.findIndex(p=>p.id===s.id);if(!r.local&&removed<r.game.turn)r.game.turn--;r.players=r.players.filter(p=>p.id!==s.id);if(!r.players.length){r.game.dispose();rooms.delete(r.code);}else {r.owner=r.players[0].id;r.game.drop();r.game.turn%=r.players.length;publish(r);}s.data.room=null;}
io.on('connection',s=>{
 s.on('join',(data={},ack=()=>{})=>{
  if(typeof ack!=='function')return;
  let r;if(data.code){if(typeof data.code!=='string')return ack({error:'Неверный код'});r=rooms.get(data.code.toUpperCase());if(!r||r.local)return ack({error:'Комната не найдена'});if(r.players.length>=6||r.started)return ack({error:'Игра уже началась или комната заполнена'});}
  if(rooms.size>=200&&!r)return ack({error:'Сервер занят'});
  leave(s);
  if(!r){const code=randomBytes(3).toString('hex').toUpperCase();r={code,avatars:shuffleAvatars(),local:data.local!==false,count:Math.max(1,Math.min(6,Number.isInteger(data.count)?data.count:2)),owner:s.id,players:[],game:new Game(),started:data.local!==false};rooms.set(code,r);}
  r.players.push({id:s.id,avatar:r.avatars.find(id=>!r.players.some(p=>p.avatar===id)),name:typeof data.name==='string'?data.name.trim().slice(0,20)||`Игрок ${r.players.length+1}`:`Игрок ${r.players.length+1}`});s.data.room=r.code;s.join(r.code);ack({ok:true});publish(r);s.emit('state',r.game.snapshot());
 });
 s.on('start',()=>{const r=rooms.get(s.data.room);if(r?.owner===s.id){r.started=true;publish(r);}});
 s.on('reset',()=>{const r=rooms.get(s.data.room);if(r?.owner===s.id){r.game.dispose();r.game=new Game();publish(r);}});
 s.on('action',(a={})=>{const r=rooms.get(s.data.room);if(!r||!r.started)return;const g=r.game;const player=r.local?r.owner:r.players[g.turn%r.players.length]?.id;if(player!==s.id||g.over)return;
 if(a.type==='select')g.select(a.id);if(a.type==='pull')g.pull(a.value);if(a.type==='release'&&g.finish())g.turn=(g.turn+1)%(r.local?r.count:r.players.length);
 });
 s.on('disconnect',()=>leave(s));
});
let tick=0;setInterval(()=>{for(const r of rooms.values()){if(r.started&&r.game.step())r.game.turn=(r.game.turn+1)%(r.local?r.count:r.players.length);if(tick%3===0)io.to(r.code).emit('state',r.game.snapshot());}tick++;},1000/60);
http.listen(process.env.PORT===undefined?3000:Number(process.env.PORT),'0.0.0.0',()=>console.log(`Jenga: http://localhost:${http.address().port}`));
