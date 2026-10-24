import {test} from 'node:test';import assert from 'node:assert/strict';import {Game} from '../src/game.js';
test('tower stays stable and prevents selecting top floors',()=>{const g=new Game();for(let i=0;i<3600;i++)g.step();assert.equal(g.blocks.length,54);assert.equal(g.over,false);assert.equal(g.select(53),false);assert.equal(g.select(-1),false);assert.equal(g.select(30),true);assert.equal(g.select(27),true);assert.equal(g.active,27);g.pull(Infinity);assert.equal(g.distance,0);});
test('extracted block moves to top, short pull does not count',()=>{const g=new Game();assert(g.select(30));g.pull(.3);assert.equal(g.release(),false);assert.equal(g.moves,0);assert(g.select(30));g.pull(3.7);for(let i=0;i<240;i++)g.step();assert.equal(g.release(),true);assert.equal(g.blocks[30].row,18);assert.equal(g.moves,1);assert.equal(g.active,null);assert.equal(g.select(27),false);});

test('delayed collapse belongs to the player who moved last',()=>{const g=new Game();g.age=4;g.turn=1;g.lastMover=0;g.blocks[20].setTranslation({x:0,y:.5,z:0},true);g.step();assert.equal(g.over,true);assert.equal(g.snapshot().loser,0);});

test('gentle extraction leaves the tower balanced after placement',()=>{
 for(const id of [30,31]){
  const g=new Game();assert(g.select(id));g.pull(3.7);
  for(let i=0;i<360;i++){g.step();if(g.release())break;}
  assert.equal(g.moves,1);for(let i=0;i<1200;i++)g.step();
  assert.equal(g.over,false,`block ${id} should not topple a supported tower`);
  assert(Math.abs(g.blocks[53].translation().x-1.01)<.15);g.dispose();
 }
});
test('dropping a held block restores rotation and keeps its current position',()=>{
 const g=new Game();g.select(30);g.pull(.5);for(let i=0;i<60;i++)g.step();
 const p=g.blocks[30].translation();g.drop();assert.equal(g.active,null);assert.equal(g.moves,0);
 assert.deepEqual(g.blocks[30].translation(),p);g.dispose();
});

test('release request completes on the server without a second client message',()=>{
 const g=new Game();g.select(30);g.pull(3.7);assert.equal(g.finish(),false);
 let completed=false;for(let i=0;i<360;i++){if(g.step()){completed=true;break;}}
 assert(completed);assert.equal(g.moves,1);assert.equal(g.active,null);g.dispose();
});
test('a pending block can be regrabbed or replaced without getting stuck',()=>{
 const g=new Game();g.select(30);g.pull(3.7);g.finish();for(let i=0;i<20;i++)g.step();
 assert(g.select(30));assert.equal(g.releaseRequested,false);assert(Math.abs(g.distance-g.extracted())<.001);
 assert(g.select(31));assert.equal(g.active,31);g.drop();assert(g.select(30));g.dispose();
});
test('blocked extraction times out and releases the hand',()=>{
 const g=new Game();g.select(30);g.pull(3.7);g.finish();
 g.blocks[30].setEnabledTranslations(false,false,false,true);
 for(let i=0;i<370;i++)g.step();assert.equal(g.active,null);assert.equal(g.moves,0);g.dispose();
});
