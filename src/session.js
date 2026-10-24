import {io} from 'socket.io-client';
import {MEMES} from './memes.js';
export function createSession({serverURL=import.meta.env?.VITE_SERVER_URL||(import.meta.env?.VITE_STATIC_HOST==='true'?null:globalThis.location?.origin)}={}){
 const listeners=new Map();let game=null,room=null,remote=null,GameClass=null,tick=0;
 const fire=(event,value)=>{for(const handler of listeners.get(event)||[])handler(value);};
 const snapshot=()=>fire('state',game.snapshot());
 const advance=()=>{game.turn=(game.turn+1)%room.players.length;};
 const timer=setInterval(()=>{if(!game)return;if(game.step())advance();if(tick++%3===0)snapshot();},1000/60);
 const session={
  get id(){return remote?.id||'local';},
  on(event,handler){if(!listeners.has(event))listeners.set(event,[]);listeners.get(event).push(handler);return session;},
  async emit(event,data={},ack=()=>{}){
   if(event==='join'){
    if(data.local===false){
     if(!serverURL){ack({error:'Онлайн-комнаты пока недоступны. Можно играть на одном компьютере.'});return;}
     if(remote){remote.emit(event,data,ack);return;}
     const candidate=io(serverURL,{autoConnect:false,timeout:8000,reconnection:false});
     candidate.once('connect_error',()=>{candidate.disconnect();ack({error:'Не удалось подключиться к серверу. Локальная игра доступна.'});});
     candidate.once('connect',()=>candidate.emit('join',data,result=>{
      if(result.error){candidate.disconnect();ack(result);return;}
      if(game){game.dispose();game=null;}remote=candidate;remote.io.reconnection(true);
      remote.on('room',r=>fire('room',r));remote.on('state',s=>fire('state',s));
      remote.on('disconnect',()=>fire('disconnect'));remote.on('connect',()=>fire('connect'));ack(result);
     }));candidate.connect();return;
    }
    try{
     GameClass||= (await import('./game.js')).Game;
     if(remote){remote.removeAllListeners();remote.disconnect();remote=null;}
     game?.dispose();game=new GameClass();const count=Math.max(1,Math.min(6,Number.isInteger(data.count)?data.count:2));
     const avatars=MEMES.map(m=>m.id);for(let i=avatars.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[avatars[i],avatars[j]]=[avatars[j],avatars[i]];}
     room={code:'',local:true,owner:'local',started:true,players:Array.from({length:count},(_,i)=>({id:'local',name:`Игрок ${i+1}`,avatar:avatars[i]}))};
     ack({ok:true});fire('room',room);snapshot();
    }catch{ack({error:'Не удалось загрузить физику игры. Обновите страницу.'});}return;
   }
   if(remote){remote.emit(event,data,ack);return;}
   if(!game)return;
   if(event==='reset'){game.dispose();game=new GameClass();snapshot();return;}
   if(event==='action'&&!game.over){
    if(data.type==='select')game.select(data.id);
    if(data.type==='pull')game.pull(data.value);
    if(data.type==='release'&&game.finish())advance();snapshot();
   }
  },
  disconnect(){clearInterval(timer);game?.dispose();game=null;remote?.removeAllListeners();remote?.disconnect();listeners.clear();}
 };
 queueMicrotask(()=>fire('connect'));return session;
}
