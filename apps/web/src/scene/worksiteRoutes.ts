// Positions and clearances are in scene metres. Each footprint includes room for a worker.
export interface Point { x: number; z: number }
export type Rect = readonly [number, number, number, number];
export const rect = (x:number,z:number,w:number,d:number): Rect =>
  [x-w/2-.32,x+w/2+.32,z-d/2-.32,z+d/2+.32];
const core: Rect = [8.7,19.3,-17.8,-8.2];
const ground: Rect[] = [
  [-4.5,41,-31,1], rect(50,-34,6,6), rect(88,22,12.4,4.4),
  rect(86,-38,12.4,4.4), rect(100,28,12.4,4.4), rect(104,-26,5,2.2),
  rect(104,-34,3.6,3.6), rect(96,-16,5,1.6), rect(110,-12.4,1.3,6.2),
  rect(42,-9,.8,.8),
];
ground.push([-31,54.4,49.6,50.4],[59.6,119,49.6,50.4]);
for (let i=0;i<12;i++) ground.push(rect(52+i%4*3.2,-30-Math.floor(i/4)*3.2,2.4,2.4));
for (let i=0;i<4;i++) ground.push(rect(64+i*4,36,2.6,1.4));
for (let i=0;i<10;i++) ground.push(rect(70+i%5*6,-5-Math.floor(i/5)*18,1.45,11.3));
for (const dz of [-3,0,3]) ground.push(rect(70,14+dz,12,.6));
for (const dx of [-7.8,0,7.8]) for (const dz of [-4.8,4.8]) ground.push(rect(70+dx,14+dz,.18,.18));
for (const dx of [-4.8,4.8]) for (const dz of [-3.3,3.3]) ground.push(rect(96+dx,-16+dz,.2,.2));
for (const x of [65,75]) ground.push(rect(x,10,.7,.7));
for (const x of [76,77]) ground.push(rect(x,17.5,.65,.65));
for (let i=0;i<6;i++) ground.push(rect(94+i%3*5.5,-44-Math.floor(i/3)*9,5.2,2));
const roof: Rect[] = [core];
const floor: Rect[] = [core,[-2.5,0,-31,-10.6],[-2.5,0,-9.5,0]];
for(let x=1;x<=39;x+=7.6) for(let z=-1;z>=-29;z-=7) floor.push(rect(x,z,.8,.8));
export const obstacles = (level:number) => level===0 ? ground : level===12 ? roof : floor;

// Clip the whole step against each footprint so a low frame rate cannot skip a wall.
export function clearPath(a:Point,b:Point,blocks:readonly Rect[]) {
  return !blocks.some(([left,right,top,bottom])=>{
    let near=0, far=1;
    for (const [from,to,min,max] of [[a.x,b.x,left,right],[a.z,b.z,top,bottom]] as const) {
      if (from===to) { if(from<=min || from>=max) return false; continue; }
      const u=(min-from)/(to-from), v=(max-from)/(to-from);
      near=Math.max(near,Math.min(u,v)); far=Math.min(far,Math.max(u,v));
    }
    return near<far;
  });
}

export function route(start:Point,end:Point,level:number,extra:readonly Rect[]=[]): Point[] {
  const blocks=extra.length ? [...obstacles(level),...extra] : obstacles(level);
  if (!clearPath(end,end,blocks)) return [];
  if(clearPath(start,end,blocks)) return [end];
  // Search a one-metre walking grid only when the direct walkway is obstructed.
  const queue:Point[]=[start], parents=[-1], visited=new Set<string>();
  for(let i=0;i<queue.length;i++) {
    const p=queue[i]!;
    if(clearPath(p,end,blocks)) {
      const path=[end,p];
      for(let j=parents[i]!;j>0;j=parents[j]!) path.push(queue[j]!);
      path.reverse();
      return path;
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const next={x:p.x+dx,z:p.z+dz}, key=Math.round(next.x)+','+Math.round(next.z);
      if(visited.has(key) || next.x < (level?-3.5:-14) || next.x > (level?46:114) ||
        next.z < (level?-29:-48) || next.z > (level?-.5:60) || !clearPath(p,next,blocks)) continue;
      visited.add(key); queue.push(next); parents.push(i);
    }
  }
  return [];
}
