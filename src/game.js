import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
export const H=.58, W=.98, L=3;
const ZERO={x:0,y:0,z:0};
export class Game {
 constructor(){
  this.world=new RAPIER.World({x:0,y:-9.82,z:0});
  this.world.timestep=1/120;
  this.world.integrationParameters.numSolverIterations=12;
  this.world.integrationParameters.numInternalPgsIterations=4;
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(30,.25,30).setTranslation(0,-.25,0).setFriction(.6));
  this.blocks=[];this.turn=0;this.moves=0;this.active=null;this.over=false;this.age=0;this.cooldown=0;this.accumulator=0;
  for(let row=0;row<18;row++)for(let col=0;col<3;col++){
   const angle=row%2?Math.PI/2:0;
   const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(row%2?(col-1)*1.01:0,H/2+row*(H+.002),row%2?0:(col-1)*1.01).setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)}).setLinearDamping(.12).setAngularDamping(.25).setCcdEnabled(true));
   this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(L/2-.015,H/2-.015,W/2-.015,.015).setMass(.32).setFriction(.18).setRestitution(0),b);
   b.row=row;this.blocks.push(b);
  }
  // Let the stack settle under its own weight before the first hand touches it.
  for(let i=0;i<120;i++)this.world.step();
 }
 select(id){
  if(this.over||this.cooldown>0||!Number.isInteger(id)||!this.blocks[id])return false;
  const b=this.blocks[id],top=Math.max(...this.blocks.map(b=>b.row));
  if(b.row>=top-1)return false;
  if(this.active===id){this.releaseRequested=false;this.distance=this.extracted();this.travel=this.distance;return true;}
  this.drop();this.active=id;this.origin=b.translation();const q=b.rotation();
  const x=1-2*(q.y*q.y+q.z*q.z),z=2*(q.x*q.z-q.w*q.y),length=Math.hypot(x,z);
  this.axis={x:x/length,y:0,z:z/length};this.distance=0;this.travel=0;
  // The hand holds the block level while pulling, without locking any other blocks.
  b.setEnabledRotations(false,false,false,true);b.setAngvel(ZERO,true);return true;
 }
 pull(value){if(this.active!==null&&Number.isFinite(value))this.distance=Math.max(-3.7,Math.min(3.7,value));}
 drop(){
  if(this.active!==null){const b=this.blocks[this.active];b.resetForces(true);b.setEnabledRotations(true,true,true,true);}
  this.active=null;this.distance=0;this.releaseRequested=false;
 }
 extracted(){
  if(this.active===null)return 0;const p=this.blocks[this.active].translation();
  return (p.x-this.origin.x)*this.axis.x+(p.z-this.origin.z)*this.axis.z;
 }
 finish(){
  if(this.active===null)return false;
  if(Math.abs(this.distance)<3.15){this.drop();return false;}
  this.releaseRequested=true;this.releaseDeadline=this.age+6;return this.release();
 }
 release(){
  if(this.active===null)return false;
  const b=this.blocks[this.active];
  if(Math.abs(this.distance)<3.15){this.drop();return false;}
  if(Math.abs(this.extracted())<3.1)return false;
  const others=this.blocks.filter(x=>x!==b),top=Math.max(...others.map(x=>x.row));
  const count=others.filter(x=>x.row===top).length,row=count<3?top:top+1,col=count<3?count:0;
  const y=Math.max(...others.filter(x=>x.row===top).map(x=>x.translation().y))+(row===top?0:H+.012);
  this.drop();b.setTranslation({x:row%2?(col-1)*1.01:0,y,z:row%2?0:(col-1)*1.01},true);
  const angle=row%2?Math.PI/2:0;b.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},true);b.setLinvel(ZERO,true);b.setAngvel(ZERO,true);b.row=row;
  this.lastMover=this.turn;this.moves++;this.cooldown=1.4;return true;
 }
 step(dt=1/60){
  this.age+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.accumulator+=Math.min(dt,.1);
  while(this.accumulator>=1/120){
   if(this.active!==null){
    const b=this.blocks[this.active],p=b.translation(),v=b.linvel();
    this.travel+=Math.max(-1.5/120,Math.min(1.5/120,this.distance-this.travel));
    const clamp=f=>Math.max(-35,Math.min(35,f));
    b.resetForces(false);b.addForce({x:clamp((this.origin.x+this.axis.x*this.travel-p.x)*80-v.x*10),y:clamp(b.mass()*9.82+(this.origin.y-p.y)*80-v.y*10),z:clamp((this.origin.z+this.axis.z*this.travel-p.z)*80-v.z*10)},true);
   }
   this.world.step();this.accumulator-=1/120;
  }
  if(this.age>1&&!this.over){
   this.over=this.blocks.some((b,i)=>{const q=b.rotation();return i!==this.active&&b.row>2&&(b.translation().y<1||1-2*(q.x*q.x+q.z*q.z)<.45);});
   if(this.over)this.loser=this.active!==null?this.turn:(this.lastMover??this.turn);
  }
  if(this.releaseRequested&&!this.over){
   if(this.release())return true;
   if(this.age>=this.releaseDeadline)this.drop();
  }
  return false;
 }
 snapshot(){return {blocks:this.blocks.map(b=>{const p=b.translation(),q=b.rotation();return [p.x,p.y,p.z,q.x,q.y,q.z,q.w,b.row];}),loser:this.loser,extracted:this.extracted(),active:this.active,distance:this.distance||0,over:this.over,moves:this.moves,turn:this.turn,cooldown:this.cooldown};}
 dispose(){this.world.free();}
}
