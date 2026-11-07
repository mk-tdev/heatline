import { describe, expect, it } from 'vitest';
import { walkPosition } from '../apps/web/src/scene/explorationState';

describe('playground walking boundaries', () => {
  it('blocks the ground-floor facade while allowing movement along it', () => {
    expect(walkPosition(39, -11, false, { x: 42, z: -10 })).toEqual({ x: 42, z: -11 });
  });
  it('keeps rooftop walkers inside edge protection', () => {
    expect(walkPosition(80, -90, true, { x: 37, z: -9 })).toEqual({ x: 38.8, z: -28.8 });
  });
  it('blocks the roof core without trapping the walker', () => {
    expect(walkPosition(10, -12, true, { x: 8, z: -11 })).toEqual({ x: 8, z: -12 });
    expect(walkPosition(7, -11, true, { x: 8, z: -11 })).toEqual({ x: 7, z: -11 });
  });
  it('does not mutate caller-owned positions and stays within the site', () => {
    const previous = Object.freeze({ x: 109, z: 40 });
    expect(walkPosition(200, 200, false, previous)).toEqual({ x: 112, z: 42 });
    expect(previous).toEqual({ x: 109, z: 40 });
  });
});

import { CrewHoist, CrewWalk } from '../apps/web/src/scene/crewTransit';
import { clearPath, obstacles, route } from '../apps/web/src/scene/worksiteRoutes';
import { Vector3 } from 'three';

it('takes a detour around the benches and follows only clear segments', () => {
  const start={x:70,z:20.5}, end={x:70,z:12.5};
  const path=route(start,end,0);
  expect(path.at(-1)).toEqual(end);
  expect(clearPath(start,end,obstacles(0))).toBe(false);
  path.forEach((point,i)=>expect(clearPath(path[i-1] ?? start,point,obstacles(0))).toBe(true));
});

it('boards, rides with the cage, and exits at the roof, scaffold and ground', () => {
  const lift=new CrewHoist(), walk=new CrewWalk(0), p=new Vector3(64,0,20.5);
  for (const target of [new Vector3(13,42.55,-5),new Vector3(-3.1,7.14,-17),new Vector3(70,0,14.85)]) {
    let riding=false;
    for(let i=0;i<3000 && p.distanceTo(target)>.02;i++) {
      const y=lift.height;
      lift.tick(.05);
      walk.advance('worker',p,target,lift,.05);
      if(lift.height!==y && lift.requests.get('worker')?.phase==='riding') {
        riding=true;
        expect(p.x).toBeCloseTo(43.7);
        expect(p.y).toBeCloseTo(lift.height+.14);
      }
    }
    expect(riding).toBe(true);
    expect(p.distanceTo(target)).toBeLessThan(.02);
  }
});

it('carries a whole crew up in one trip', () => {
  const lift=new CrewHoist(), target=new Vector3(13,42.55,-5);
  const crew=Array.from({length:8},(_,i)=>({id:`w${i}`,walk:new CrewWalk(0,i),p:new Vector3(46+i%4,0,-6-Math.floor(i/4))}));
  let trips=0, lastDir=0, steps=0;
  for(;steps<4000 && crew.some((c)=>c.p.distanceTo(target)>.5);steps++) {
    const y=lift.height;
    lift.tick(.05);
    const dir=Math.sign(lift.height-y);
    if(dir>0 && lastDir<=0 && [...lift.requests.values()].some((r)=>r.phase==='riding')) trips++;
    if(dir) lastDir=dir;
    for(const c of crew) c.walk.advance(c.id,c.p,target,lift,.05);
  }
  expect(crew.every((c)=>c.p.y>40)).toBe(true);
  expect(trips).toBe(1);
});
