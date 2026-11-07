// Common three-axle chassis for the site mixer and municipal water tankers. Front is +Z.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function buildChassis() {
  const pieces: THREE.BufferGeometry[] = [];
  function part(geometry: THREE.BufferGeometry, x:number,y:number,z:number, paint:string) {
    const g=geometry.index ? geometry.toNonIndexed() : geometry;
    g.translate(x,y,z);
    const tint=new THREE.Color(paint);
    const colors=new Float32Array(g.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3) tint.toArray(colors,i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    pieces.push(g);
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string) =>
    part(new THREE.BoxGeometry(w,h,d),x,y,z,c);
  box(0,.83,0,1.02,.36,8.3,'#32383b');
  for(const z of [2.86,-1.92,-3.26]) for(const side of [-1,1]) {
    const wheel=(radius:number,depth:number,x:number,c:string)=>part(
      new THREE.CylinderGeometry(radius,radius,depth,22).rotateZ(Math.PI/2),x,.56,z,c);
    wheel(.56,.36,side*.99,'#222427'); wheel(.32,.05,side*1.18,'#727c80'); wheel(.14,.07,side*1.21,'#454d50');
  }
  box(0,1.94,2.91,2.4,1.62,2.1,'#e3e1d6');
  box(0,2.24,3.975,2.12,.73,.04,'#344d59');
  box(0,2.82,2.88,2.44,.15,2.15,'#f3efe1');
  box(0,1.21,4.01,2.44,.3,.24,'#62696a');
  for(let i=0;i<4;i++) box(0,1.48+i*.085,3.977,1.25,.045,.06,'#333a3d');
  for(const side of [-1,1]) {
    box(side*1.21,2.24,2.95,.035,.69,1.4,'#405963');
    box(side*1.27,2.36,3.6,.23,.05,.05,'#41464a');
    box(side*1.41,2.36,3.6,.11,.29,.16,'#363d40');
    box(side*.91,1.48,3.99,.42,.18,.09,'#fff2c9');
    box(side*1.04,.93,1.69,.45,.16,.64,'#667075');
    box(side*.97,.91,-2.59,.48,.16,2.68,'#42494c');
    box(side*.96,.71,-4.17,.27,.13,.1,'#b94b38');
  }
  box(0,1.2,-1.08,1.64,.25,5.7,'#596463');
  return mergeGeometries(pieces)!;
}

function buildDrum() {
  const profile=[[-2.65,.55],[-2.25,1.03],[-1.25,1.27],[.55,1.24],[1.7,.91],[2.65,.51]];
  const geometry=new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r!,y!)),48);
  const colors=[];
  for(let i=0;i<geometry.attributes.position!.count;i++) {
    const uv=geometry.attributes.uv!;
    const phase=(uv.getX(i)*2+uv.getY(i)*.65)%1;
    const color=new THREE.Color(phase<.22?'#b66b38':'#ddd9c9');
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  return geometry;
}

export function Truck({body = 'tanker'}:{body?:'mixer' | 'tanker' | 'pump'}) {
  const [chassis]=useState(buildChassis);
  const drum=useRef<THREE.Mesh>(null);
  const [geometry]=useState(()=>body === 'mixer' ? buildDrum() : null);
  useFrame((_,dt)=>{if(drum.current) drum.current.rotation.y+=dt*.65;});
  return <group>
    <mesh geometry={chassis} castShadow><meshStandardMaterial vertexColors roughness={.74}/></mesh>
    {geometry ? <>
      <group position={[0,2.23,-1.05]} rotation-x={-Math.PI/2+.18}>
        <mesh ref={drum} geometry={geometry} castShadow><meshStandardMaterial vertexColors roughness={.76} side={THREE.DoubleSide}/></mesh>
      </group>
      <mesh position={[0,2.73,-3.83]} castShadow><cylinderGeometry args={[.66,.29,.72,10]}/><meshStandardMaterial color="#92938b"/></mesh>
      <mesh position={[.12,1.92,-4.24]} rotation-x={-.35} castShadow><boxGeometry args={[.47,.17,1.4]}/><meshStandardMaterial color="#717b79"/></mesh>
    </> : body === 'pump' ? <group>
      <mesh position={[0,1.45,-.9]} castShadow><boxGeometry args={[2.4,.45,5.9]}/><meshStandardMaterial color="#c4c2b8"/></mesh>
      {[-2.7,1.2].map(z=><group key={z} position={[0,0,z]}>
        <mesh position-y={.82}><boxGeometry args={[5.4,.25,.32]}/><meshStandardMaterial color="#444c51"/></mesh>
        {[-2.6,2.6].map(x=><mesh key={x} position={[x,.42,0]}><cylinderGeometry args={[.18,.26,.84,10]}/><meshStandardMaterial color="#747d80"/></mesh>)}
      </group>)}
    </group> : <mesh position={[0,2,-1.04]} rotation-x={Math.PI/2} castShadow>
      <capsuleGeometry args={[1.01,3.6,6,24]}/><meshStandardMaterial color="#c4c9c7" metalness={.35} roughness={.43}/>
    </mesh>}
  </group>;
}
