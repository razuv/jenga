import PeerPackage from 'peerjs';
const Peer=PeerPackage.Peer||PeerPackage;
import {MEMES} from './memes.js';
const PREFIX='jenga-v1-';
const nameOf=value=>typeof value==='string'?value.trim().slice(0,20)||'Игрок':'Игрок';
export function validRoom(room){
 return room&&room.local===false&&/^[A-F0-9]{8}$/.test(room.code)&&typeof room.owner==='string'&&typeof room.started==='boolean'&&Array.isArray(room.players)&&room.players.length>=1&&room.players.length<=6&&room.players.every(p=>p&&typeof p.id==='string'&&p.id.length<=100&&typeof p.name==='string'&&p.name.length<=20&&MEMES.some(m=>m.id===p.avatar))&&new Set(room.players.map(p=>p.id)).size===room.players.length&&room.players.some(p=>p.id===room.owner);
}
export function validState(state,room){
 return state&&Array.isArray(state.blocks)&&state.blocks.length===54&&state.blocks.every(b=>Array.isArray(b)&&b.length===8&&b.every(Number.isFinite))&&Number.isInteger(state.turn)&&state.turn>=0&&state.turn<room.players.length&&(state.active===null||Number.isInteger(state.active)&&state.active>=0&&state.active<54)&&typeof state.over==='boolean'&&Number.isFinite(state.distance)&&Number.isFinite(state.extracted)&&Number.isFinite(state.cooldown)&&Number.isInteger(state.moves)&&state.moves>=0;
}
export function iceServers(value){
 if(value){
  try{
   const servers=JSON.parse(value);
   if(!Array.isArray(servers)||!servers.length||servers.length>8||!servers.every(s=>s&&[].concat(s.urls).every(url=>typeof url==='string'&&/^(stun|stuns|turn|turns):/.test(url))&&[].concat(s.urls).length>0))throw new Error();
   return servers;
  }catch{throw new Error('Некорректная настройка STUN/TURN.');}
 }
 // PeerJS ships these public relay credentials; TCP also covers networks blocking UDP.
 return [{urls:'stun:stun.l.google.com:19302'},{urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478','turn:eu-0.turn.peerjs.com:3478?transport=tcp','turn:us-0.turn.peerjs.com:3478?transport=tcp'],username:'peerjs',credential:'peerjsp'}];
}
export async function connectP2P(data,notify,{PeerClass=Peer,timeout=30000}={}){
 const code=data.code?String(data.code).trim().toUpperCase():Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
 if(!/^[A-F0-9]{8}$/.test(code))throw new Error('Код комнаты должен содержать 8 символов.');
 const hosting=!data.code;
 let peer,game,room,state,timer,closed=false,ready=false,hostConnection,deadline,ticks=0;
 const connections=new Map(),pending=new Set();
 const send=(connection,message)=>{if(connection.open){try{connection.send(message);}catch{connection.close();}}};
 const broadcast=(type,value)=>{notify(type,value);for(const connection of connections.values())if(type!=='state'||!(connection.dataChannel?.bufferedAmount>65536))send(connection,{type,value});};
 const publish=()=>broadcast('room',room);
 const snapshot=()=>broadcast('state',game.snapshot());
 const advance=()=>{game.turn=(game.turn+1)%room.players.length;};
 function cleanup(){
  if(closed)return;closed=true;clearInterval(timer);clearTimeout(deadline);for(const connection of pending)connection.close();pending.clear();
  peer?.destroy();game?.dispose();game=null;
 }
 function handle(actor,event,value){
  if(!game||!room||closed)return;
  if(event==='start'&&actor===room.owner){room.started=true;publish();return;}
  if(event==='reset'&&actor===room.owner){const Game=game.constructor;game.dispose();game=new Game();snapshot();return;}
  if(event!=='action'||!room.started||game.over||room.players[game.turn]?.id!==actor||!value||typeof value!=='object')return;
  if(value.type==='select')game.select(value.id);
  if(value.type==='pull')game.pull(value.value);
  if(value.type==='release'&&game.finish())advance();snapshot();
 }
 try{
  await new Promise((resolve,reject)=>{
   deadline=setTimeout(()=>reject(new Error('Не удалось установить P2P-соединение. Проверьте сеть и попробуйте снова.')),timeout);
   const finish=()=>{ready=true;clearTimeout(deadline);resolve();};
   const fail=message=>{clearTimeout(deadline);if(!ready)reject(new Error(message));else{cleanup();notify('disconnect');notify('error',message);}};
   peer=new PeerClass(hosting?PREFIX+code:undefined,{config:{iceServers:iceServers(import.meta.env?.VITE_ICE_SERVERS)}});
   peer.on('error',error=>{
    if(error?.type==='peer-unavailable')fail('Комната не найдена или хост уже вышел.');
    else if(error?.type==='unavailable-id')fail('Этот код уже занят. Создайте комнату ещё раз.');
    else if(!ready)fail('Сервис подключения недоступен. Попробуйте позже.');
   });
   peer.on('close',()=>{if(!closed)fail('P2P-соединение закрыто.');});
   peer.on('disconnected',()=>{if(ready&&!closed)peer.reconnect();});
   peer.on('connection',connection=>{
    if(!hosting||!ready||pending.size+connections.size>=10){connection.close();return;}
    pending.add(connection);let joined=false,packets=0,windowStart=Date.now();
    let joinTimer=setTimeout(()=>connection.close(),timeout);
    connection.on('open',()=>{clearTimeout(joinTimer);joinTimer=setTimeout(()=>connection.close(),10000);});
    const rejectJoin=error=>{send(connection,{type:'rejected',error});setTimeout(()=>connection.close(),100);};
    connection.on('data',message=>{
     if(closed||!message||typeof message!=='object'||JSON.stringify(message).length>2048){connection.close();return;}
     if(!joined){
      if(message.type!=='join'||connection.label!=='jenga-v1'){connection.close();return;}
      clearTimeout(joinTimer);
      if(room.started||room.players.length>=6){rejectJoin('Игра уже началась или комната заполнена.');return;}
      if(connections.has(connection.peer)){rejectJoin('Игрок уже в комнате.');return;}
      joined=true;pending.delete(connection);connections.set(connection.peer,connection);
      const available=MEMES.filter(m=>!room.players.some(p=>p.avatar===m.id));
      room.players.push({id:connection.peer,name:nameOf(message.name),avatar:available[Math.floor(Math.random()*available.length)].id});
      send(connection,{type:'welcome',room,state:game.snapshot()});publish();return;
     }
     if(Date.now()-windowStart>=1000){windowStart=Date.now();packets=0;}
     if(++packets<=120)handle(connection.peer,message.type,message.value);
    });
    const leave=()=>{
     clearTimeout(joinTimer);pending.delete(connection);if(closed||!joined||connections.get(connection.peer)!==connection)return;
     connections.delete(connection.peer);const removed=room.players.findIndex(p=>p.id===connection.peer);
     if(removed===game.turn)game.drop();if(removed<game.turn)game.turn--;
     room.players.splice(removed,1);game.turn%=room.players.length;publish();snapshot();
    };
    connection.on('close',leave);connection.on('error',()=>{connection.close();leave();});
   });
   peer.on('open',async()=>{
    if(closed)return;
    if(hosting){
     try{
      const {Game}=await import('./game.js');if(closed)return;game=new Game();
      room={code,local:false,owner:peer.id,started:false,players:[{id:peer.id,name:nameOf(data.name),avatar:MEMES[Math.floor(Math.random()*MEMES.length)].id}]};
      timer=setInterval(()=>{if(closed)return;if(room.started&&game.step())advance();if(ticks++%3===0)snapshot();},1000/60);
      finish();
     }catch{fail('Не удалось загрузить физику игры.');}
    }else{
     hostConnection=peer.connect(PREFIX+code,{label:'jenga-v1',serialization:'json',reliable:true});
     hostConnection.on('open',()=>send(hostConnection,{type:'join',name:nameOf(data.name)}));
     hostConnection.on('data',message=>{
      if(!message||typeof message!=='object')return;
      if(message.type==='rejected'){fail(typeof message.error==='string'?message.error.slice(0,150):'Хост отклонил подключение.');return;}
      if(message.type==='welcome'&&!ready){
       if(!validRoom(message.room)||message.room.code!==code||message.room.owner!==PREFIX+code||!message.room.players.some(p=>p.id===peer.id)||!validState(message.state,message.room)){fail('Хост передал некорректные данные.');return;}
       room=message.room;state=message.state;finish();return;
      }
      if(!ready||closed)return;
      if(message.type==='room'&&validRoom(message.value)&&message.value.code===code&&message.value.owner===room.owner&&message.value.players.some(p=>p.id===peer.id)){room=message.value;notify('room',room);}
      if(message.type==='state'&&validState(message.value,room)){state=message.value;notify('state',state);}
     });
     hostConnection.on('close',()=>{if(!closed)fail('Хост вышел. Партия завершена.');});
     hostConnection.on('error',()=>fail('Связь с хостом потеряна. Партия завершена.'));
    }
   });
  });
  return {
   get id(){return peer.id;},room,state:hosting?game.snapshot():state,
   emit(event,value){if(closed)return;if(hosting)handle(peer.id,event,value);else send(hostConnection,{type:event,value});},
   removeAllListeners(){},disconnect:cleanup
  };
 }catch(error){cleanup();throw error;}
}
