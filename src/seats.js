import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {MEMES} from './memes.js';
export function createSeats(scene){
 const textures=new Map(),loader=new THREE.TextureLoader();
 for(const meme of MEMES){const map=loader.load(meme.url);map.colorSpace=THREE.SRGBColorSpace;textures.set(meme.id,map);}
 const box=new RoundedBoxGeometry(1,1,1,3,.12),capsule=new THREE.CapsuleGeometry(.18,1,4,8);
 const cloth=new THREE.MeshStandardMaterial({color:'#292a28',roughness:1});
 const chairMaterial=new THREE.MeshStandardMaterial({color:'#171918',roughness:.6});
 const skin=new THREE.MeshStandardMaterial({color:'#ab9279',roughness:.9});
 function part(group,geometry,material,position,scale){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
 const seats=MEMES.map(()=>{
  const root=new THREE.Group();scene.add(root);
  part(root,box,chairMaterial,[0,-2.4,.1],[2,.25,1.7]);
  part(root,box,chairMaterial,[0,-1.05,.8],[2,2.6,.22]);
  for(const x of [-.8,.8])for(const z of [-.55,.7])part(root,capsule,chairMaterial,[x,-3.45,z],[.6,1.65,.6]);
  const torso=part(root,box,cloth.clone(),[0,-.95,0],[1.6,2.7,1.05]);
  for(const x of [-.53,.53]){
   part(root,capsule,cloth,[x,-2.65,-.65],[1.15,1.2,1.15]);
   part(root,capsule,cloth,[x,-3.6,-1.1],[1,1.25,1]);
   part(root,box,chairMaterial,[x,-4.3,-1.3],[.58,.28,1]);
  }
  for(const x of [-.95,.95]){
   const upper=part(root,capsule,cloth,[x,-.6,-.45],[1,1.2,1]);upper.rotation.x=-.65;
   const forearm=part(root,capsule,cloth,[x,-.4,-1.15],[.9,1.1,.9]);forearm.rotation.x=-Math.PI/2;
   part(root,new THREE.SphereGeometry(.23,12,8),skin,[x,-.16,-1.8],[1,.65,1.3]);
  }
  const face=new THREE.Group();face.position.set(0,1.45,0);root.add(face);
  part(face,box,chairMaterial,[0,0,-.055],[2.15,2.15,.14]);
  const portrait=part(face,new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({toneMapped:false}),[0,0,.025],[1,1,1]);
  const ring=part(root,new THREE.TorusGeometry(1.05,.025,6,64),new THREE.MeshBasicMaterial({color:'#d9caac'}),[0,-4.44,.1],[1.3,1.3,1.3]);ring.rotation.x=-Math.PI/2;
  root.visible=false;return {root,face,portrait,torso,ring};
 });
 return {
  sync(players,turn){
   seats.forEach((seat,i)=>{
    const player=players[i];seat.root.visible=Boolean(player);if(!player)return;
    const angle=Math.atan2(24,19)+Math.PI/2+i*Math.PI*2/players.length;
    seat.root.position.set(Math.cos(angle)*8.6,0,Math.sin(angle)*8.6);
    seat.root.rotation.y=Math.PI/2-angle;
    seat.portrait.material.map=textures.get(player.avatar)||textures.get('mintai');seat.portrait.material.needsUpdate=true;seat.portrait.scale.y=player.avatar==='mintai'?850/1280:1;
    seat.ring.visible=i===turn;seat.torso.material.color.set(i===turn?'#44463c':'#292a28');
   });
  },
  faceCamera(camera){for(const seat of seats)if(seat.root.visible){const world=new THREE.Quaternion();seat.root.getWorldQuaternion(world);seat.face.quaternion.copy(world.invert().multiply(camera.quaternion));}}
 };
}
