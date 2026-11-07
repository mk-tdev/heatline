// Draw the streets, pavements and surrounding blocks in one instanced batch.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE, rand } from './common';

export const COAST_ROAD = 139;
export const CITY_EDGE = 1900;
const avenues = [-750, -470, -205, 134, 357, 620, 900];
const streets = [-880, -630, -425, -235, -66, COAST_ROAD];
type Box = [number, number, number, number, number, number, string];

function cityBlocks() {
  const boxes: Box[] = [];
  const add = (...part: Box) => boxes.push(part);
  // Pavements and markings stop at intersections, and at the construction gate.
  function road(vertical: boolean, centre: number, start: number, end: number, crossings: number[]) {
    const segment = (a: number, b: number, offset: number, width: number, height: number, thickness: number, color: string) => {
      if (b <= a) return;
      const mid = (a + b) / 2;
      if (vertical) add(centre + offset, mid, height, width, b - a, thickness, color);
      else add(mid, centre + offset, height, b - a, width, thickness, color);
    };
    segment(start,end,0,22,vertical ? 0.005 : 0.015,0.04,PALETTE.asphalt);
    let previous = start;
    for (const crossing of [...crossings, end + 11]) {
      const stop = Math.min(end, crossing - 11);
      for (const side of [-1,1]) {
        const offset = side * 12.5;
        if (vertical && centre === 134 && side === -1 && previous < -17 && stop > -17) {
          segment(previous,-24,offset,3,.09,.18,'#d2c8b6');
          segment(-10,stop,offset,3,.09,.18,'#d2c8b6');
        } else segment(previous,stop,offset,3,.09,.18,'#d2c8b6');
      }
      for (let d = previous + 3; d + 5 < stop; d += 15) segment(d,d+5,0,.24,.05,.012,'#ded9c8');
      previous = crossing + 11;
    }
  }
  avenues.forEach(x => road(true,x,-CITY_EDGE,COAST_ROAD,streets));
  streets.forEach(y => road(false,y,-CITY_EDGE,CITY_EDGE,avenues));

  const facades = ['#d6cbb9','#b8c9c9','#dfd6c7','#c1bab0','#c6d3cf'];
  for (let col=1; col<avenues.length; col++) for (let row=1; row<streets.length; row++) {
    const left=avenues[col-1]!, bottom=streets[row-1]!;
    const cellW=(avenues[col]!-left-32)/3, cellD=(streets[row]!-bottom-32)/2;
    for(let i=0;i<3;i++) for(let j=0;j<2;j++) {
      const x=left+16+(i+.5)*cellW, y=bottom+16+(j+.5)*cellD;
      if (x > -150 && x < 210 && y > -193) continue; // Existing detailed neighbourhood and site
      const seed=col*331+row*47+i*13+j;
      const w=Math.min(48,cellW*.65), d=Math.min(36,cellD*.62);
      const h=8+Math.floor(rand(seed)*8)*3.2;
      add(x,y,.08,cellW-2,cellD-2,.15,'#c9c4b4');
      add(x,y,h/2,w,d,h,facades[seed%facades.length]!);
      for(let floor=3;floor<h-1;floor+=3.2) add(x,y,floor,w+.08,d+.08,.94,'#758b8e');
      add(x,y,h+.24,w+.7,d+.7,.48,'#e6e1d3');
      add(x+w*.18,y,h+1.2,w*.26,d*.28,1.9,'#c0b8a8');
    }
  }
  return boxes;
}

export function District() {
  const boxes=useMemo(cityBlocks,[]);
  const batch=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    const mesh=batch.current!;
    const item=new THREE.Object3D();
    boxes.forEach(([x,y,h,w,d,t,color],i)=>{
      item.position.set(x,h,-y); item.scale.set(w,t,d); item.updateMatrix();
      mesh.setMatrixAt(i,item.matrix); mesh.setColorAt(i,new THREE.Color(color));
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
  },[boxes]);
  return <instancedMesh ref={batch} args={[undefined,undefined,boxes.length]} receiveShadow>
    <boxGeometry/><meshStandardMaterial roughness={.9}/>
  </instancedMesh>;
}
