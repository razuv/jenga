import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createSession} from './session.js';
import './style.css';
import {createSeats} from './seats.js';
import {MEMES} from './memes.js';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#090909');scene.fog=new THREE.FogExp2('#090909',.016);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;$('scene').append(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Башня Jenga. Стрелки — выбор блока, Enter — взять. Затем влево и вправо — вытянуть, Enter — отпустить, Escape — отменить.');
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,160);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=11;controls.maxDistance=42;controls.maxPolarAngle=Math.PI/2-.04;controls.target.set(0,4.8,0);controls.enablePan=false;
function resetView(){camera.position.set(19,13,24);controls.target.set(0,3.2,0);controls.update();}resetView();
scene.add(new THREE.HemisphereLight('#e6e1d3','#29232a',1.5));
const key=new THREE.DirectionalLight('#fff1da',3.3);key.position.set(4,17,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=16;key.shadow.camera.bottom=-12;key.shadow.normalBias=.025;key.shadow.bias=-.0001;key.shadow.radius=4;scene.add(key);
const rim=new THREE.DirectionalLight('#a5b6d0',1.8);rim.position.set(-8,10,-6);scene.add(rim);
function wood(seed,dark=false){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
 let n=seed;const rand=()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};
 const data=ctx.createImageData(1024,256);
 const grid=Array.from({length:128*128},()=>rand());
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);const v=(xx,yy)=>grid[((yy%128+128)%128)*128+(xx%128+128)%128];return (v(ix,iy)*(1-a)+v(ix+1,iy)*a)*(1-b)+(v(ix,iy+1)*(1-a)+v(ix+1,iy+1)*a)*b;};
 const knotX=180+rand()*650,knotY=rand()*256;
 for(let y=0;y<256;y++)for(let x=0;x<1024;x++){
  const bend=noise(x*.005,y*.008)*14;const yy=y+bend;
  const grain=(noise(x*.004,yy*.19)-.5)*19+(noise(x*.012,yy*.7)-.5)*8;
  const radius=Math.hypot((x-knotX)*.13,(y-knotY)*1.1);const knot=Math.sin(radius*.85)*Math.exp(-radius*.025)*3;
  const fine=Math.pow(noise(x*.03,yy*1.8),8)*-20;const v=grain+knot+fine+(rand()-.5)*6;const i=(y*1024+x)*4;
  data.data[i]=(dark?75:187)+v;data.data[i+1]=(dark?51:149)+v*.85;data.data[i+2]=(dark?34:101)+v*.65;data.data[i+3]=255;
 }ctx.putImageData(data,0,0);
 for(let i=0;i<60;i++){const y=rand()*256;ctx.strokeStyle=`rgba(${dark?'20,10,0':'83,48,17'},${rand()*.13})`;ctx.lineWidth=rand()*.7+.2;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(350,y+rand()*8,650,y-rand()*8,1024,y+rand()*4);ctx.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=renderer.capabilities.getMaxAnisotropy();return map;
}
const materials=Array.from({length:9},(_,i)=>{const map=wood(83+i*13);return new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.022,roughness:.46,color:new THREE.Color().setHSL(.09,.1,.88+i*.008)});});
const geo=new RoundedBoxGeometry(3,.58,.98,3,.045),blocks=[];
for(let row=0;row<18;row++)for(let col=0;col<3;col++){const mesh=new THREE.Mesh(geo,materials[(row*3+col)%9].clone());mesh.position.set(row%2?(col-1)*1.01:0,.29+row*.586,row%2?0:(col-1)*1.01);mesh.rotation.y=row%2?Math.PI/2:0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.id=blocks.length;scene.add(mesh);blocks.push(mesh);}
const tableMap=wood(199,true);tableMap.wrapS=tableMap.wrapT=THREE.RepeatWrapping;tableMap.repeat.set(2,3);
const table=new THREE.Mesh(new THREE.CylinderGeometry(7.5,7.5,.5,128),new THREE.MeshStandardMaterial({map:tableMap,bumpMap:tableMap,bumpScale:.045,roughness:.5,color:'#a08a78'}));table.position.y=-.26;table.receiveShadow=true;scene.add(table);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#080808',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-4.5;ground.receiveShadow=true;scene.add(ground);
for(const x of [-4,4])for(const z of [-4,4]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.18,.13,4,12),table.material);leg.position.set(x,-2.5,z);leg.castShadow=true;scene.add(leg);}
const seats=createSeats(scene);
const socket=createSession();let room=null,state=null,mode='local',hover=-1,selected=-1,ended=false,online=false,audio=null,muted=true,rosterKey='',lastJoin=null;
const targets=blocks.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
function sound(freq=220){if(muted)return;try{audio||=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(70,audio.currentTime+.13);gain.gain.setValueAtTime(.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.16);}catch{}}
function canPlay(){return online&&room?.started&&state&&!state.over&&state.cooldown<=.05&&(room.local||room.players[state.turn%room.players.length]?.id===socket.id);}
function drawUI(){
 if(!room||!state)return;const turn=state.turn%room.players.length;const key=JSON.stringify([room.players,turn]);
 if(key!==rosterKey){rosterKey=key;seats.sync(room.players,turn);
 $('players').replaceChildren(...room.players.map((p,i)=>{const el=document.createElement('div');el.className='player'+(i===turn?' active':'');const av=document.createElement('img');av.className='avatar';const meme=MEMES.find(m=>m.id===p.avatar)||MEMES[0];av.src=meme.url;av.alt=meme.label;const label=document.createElement('span');label.textContent=p.name;const dot=document.createElement('span');dot.className='turn-indicator';dot.textContent=i===turn?'↗':'';el.append(av,label,dot);return el;}));}
 $('mode-title').textContent=room.local?'За одним столом':'Комната '+room.code;
 $('room-info').hidden=room.local;$('copy-code').textContent=room.code+' ⧉';
 $('status').textContent=!online?'Связь потеряна':state.over?'Башня упала':!room.started?'Ожидаем игроков':state.cooldown>.1?'Проверяем баланс':canPlay()?room.local?`${room.players[turn].name} ходит`:'Ваш ход':`Ходит ${room.players[turn]?.name||'игрок'}`;
 $('move').textContent=`Ход ${String(state.moves+1).padStart(2,'0')}`;
 $('restart').disabled=room.owner!==socket.id;$('again').disabled=room.owner!==socket.id;
 $('settings').textContent=!room.local&&!room.started&&room.owner===socket.id?'Начать игру ↗':'＋ Пригласить друзей';
 if(state.over&&!ended){ended=true;$('end-text').textContent=`${room.players[(state.loser??turn)%room.players.length]?.name||'Игрок'} теряет равновесие. Успешных ходов: ${state.moves}.`;$('end-dialog').showModal();sound(100);}
}
socket.on('connect',()=>{
 online=true;const code=new URLSearchParams(location.search).get('room');
 const request=lastJoin||(code?{code,local:false}:{local:true,count:2});
 room=null;state=null;drag=null;controls.enabled=true;$('status').textContent='Подключение…';join(request);
});
socket.on('disconnect',()=>{online=false;drag=null;controls.enabled=true;drawUI();});
socket.on('room',r=>{room=r;lastJoin=r.local?{local:true,count:r.players.length}:{...lastJoin,local:false,code:r.code};drawUI();});
socket.on('state',s=>{if(!s.over)ended=false;state=s;s.blocks.forEach((b,i)=>{targets[i].p.fromArray(b);targets[i].q.fromArray(b,3);});selected=s.active;drawUI();});
function join(data){socket.emit('join',data,result=>{if(result.error){$('lobby-error').textContent=result.error;if(!$('lobby').open)$('lobby').showModal();return;}online=true;lastJoin=data;$('lobby').close();$('end-dialog').close();});}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag=null;
function hit(e){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(blocks)[0]?.object.userData.id??-1;}
function eligible(id){return id>=0&&state&&state.blocks[id][7]<Math.max(...state.blocks.map(b=>b[7]))-1;}
function finish(){socket.emit('action',{type:'release'});}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.button!==0||!canPlay())return;
 const id=hit(e);if(!eligible(id))return;
 e.stopImmediatePropagation();renderer.domElement.focus();controls.enabled=false;
 const origin=blocks[id].position.clone(),axis=new THREE.Vector3(1,0,0).applyQuaternion(blocks[id].quaternion);axis.y=0;axis.normalize();
 const from=origin.clone().project(camera),to=origin.clone().add(axis).project(camera);
 const screenAxis=new THREE.Vector2((to.x-from.x)*innerWidth/2,-(to.y-from.y)*innerHeight/2);
 if(screenAxis.length()<2){controls.enabled=true;return;}
 drag={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,axis,origin,screenAxis,base:state.active===id?state.extracted:0,value:state.active===id?state.extracted:0};
 renderer.domElement.setPointerCapture(e.pointerId);socket.emit('action',{type:'select',id});sound(380);
},true);
renderer.domElement.addEventListener('pointermove',e=>{
 if(drag&&drag.pointer===e.pointerId){
  e.stopImmediatePropagation();const delta=new THREE.Vector2(e.clientX-drag.x,e.clientY-drag.y);
  drag.value=THREE.MathUtils.clamp(drag.base+delta.dot(drag.screenAxis)/drag.screenAxis.lengthSq(),-3.7,3.7);
  socket.emit('action',{type:'pull',value:drag.value});
 }else hover=canPlay()&&eligible(hit(e))?hit(e):-1;
 renderer.domElement.style.cursor=drag?'grabbing':hover>=0?'grab':'';
},true);
function endDrag(e){
 if(!drag||drag.pointer!==e.pointerId)return;
 e.stopImmediatePropagation();drag=null;controls.enabled=true;
 if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
 if(e.type==='pointercancel'){socket.emit('action',{type:'pull',value:0});socket.emit('action',{type:'release'});}
 else finish();
 renderer.domElement.style.cursor='';
}
renderer.domElement.addEventListener('pointerup',endDrag,true);
renderer.domElement.addEventListener('pointercancel',endDrag,true);
renderer.domElement.addEventListener('lostpointercapture',endDrag);
renderer.domElement.addEventListener('keydown',e=>{
 if(!canPlay())return;
 if(state.active!==null){
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();socket.emit('action',{type:'pull',value:state.distance+(e.key==='ArrowLeft'?-.15:.15)});}
  if(e.key==='Escape'){socket.emit('action',{type:'pull',value:0});socket.emit('action',{type:'release'});}
  if(e.key==='Enter')finish();
  return;
 }
 const delta={ArrowRight:1,ArrowLeft:-1,ArrowUp:3,ArrowDown:-3}[e.key];
 if(delta){e.preventDefault();let candidate=hover<0?24:hover;for(let i=0;i<54;i++){candidate=(candidate+delta+54)%54;if(eligible(candidate)){hover=candidate;break;}}$('hint').textContent=`Блок ${hover+1}`;}
 if(e.key==='Enter'&&eligible(hover))socket.emit('action',{type:'select',id:hover});
});
$('reset-view').onclick=resetView;$('sound').onclick=()=>{muted=!muted;$('sound').style.color=muted?'#9a9a96':'#eddec2';$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');sound();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('hint').textContent='Полноэкранный режим недоступен';}};
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();$('close-end').onclick=()=>$('end-dialog').close();
$('settings').onclick=()=>{if(room&&!room.local&&!room.started&&room.owner===socket.id){socket.emit('start');return;}$('lobby-error').textContent='';$('lobby').showModal();};$('close-lobby').onclick=()=>$('lobby').close();
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b===btn));$('count-label').hidden=mode!=='local';$('online-fields').hidden=mode==='local';});
$('lobby-form').onsubmit=e=>{e.preventDefault();join({local:mode==='local',count:Number($('count').value),name:$('name').value,code:mode==='online'?$('code').value.trim().toUpperCase():''});};
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}${import.meta.env.BASE_URL}?room=${room.code}`);$('copy-code').textContent='Ссылка скопирована';}catch{$('copy-code').textContent=room.code;}};
function restart(){if(state&&!state.over&&!confirm('Начать новую игру?'))return;socket.emit('reset');$('end-dialog').close();drag=null;controls.enabled=true;}
$('restart').onclick=restart;$('again').onclick=restart;
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.1);previous=now;const blend=1-Math.exp(-dt*18);blocks.forEach((mesh,i)=>{mesh.position.lerp(targets[i].p,blend);mesh.quaternion.slerp(targets[i].q,blend);const active=i===selected,highlight=i===hover&&canPlay();mesh.material.emissive.set(active?'#49341c':highlight?'#302a1e':'#000000');});controls.update();seats.faceCamera(camera);renderer.render(scene,camera);});
