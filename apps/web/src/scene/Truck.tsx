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
    wheel(.56,.38,side*.99,'#262829');
    wheel(.355,.045,side*1.19,'#a4aaa7');
    wheel(.29,.055,side*1.2,'#414749');
    wheel(.20,.07,side*1.22,'#919692');
    for (let lug = 0; lug < 8; lug++) {
      const angle = lug * Math.PI / 4;
      part(new THREE.CylinderGeometry(.028,.028,.04,6).rotateZ(Math.PI/2),
        side*1.265,.56+.15*Math.sin(angle),z+.15*Math.cos(angle),'#c3c6be');
    }
  }
  // Side profile of a cab-over cab, including the wheel opening and raked windscreen.
  const outline = new THREE.Shape();
  const profile = [[1.83,1.06],[2.16,1.06],[2.32,1.32],[3.37,1.32],
    [3.59,1.05],[4.05,1.05],[4.05,2.02],[3.81,2.84],[1.87,2.84]];
  profile.forEach(([z,y],i) => i ? outline.lineTo(-z!,y!) : outline.moveTo(-z!,y!));
  outline.closePath();
  const cab = new THREE.ExtrudeGeometry(outline,{depth:2.22,bevelEnabled:true,
    bevelThickness:.065,bevelSize:.06,bevelSegments:3,steps:1}).rotateY(Math.PI/2);
  part(cab,-1.11,0,0,'#e0ded2');
  part(new THREE.BoxGeometry(2.13,.77,.05).rotateX(-.285),0,2.42,4.00,'#2b4653');
  for (const x of [-.56,.54]) {
    part(new THREE.BoxGeometry(.66,.025,.028).rotateZ(.08),x,2.14,4.12,'#181f22');
  }
  box(0,2.87,2.82,2.31,.09,1.97,'#f3efe1');
  box(0,1.21,4.01,2.44,.3,.24,'#62696a');
  for(let i=0;i<4;i++) box(0,1.48+i*.085,4.13,1.25,.045,.06,'#333a3d');
  for(const side of [-1,1]) {
    box(side*1.185,2.42,2.88,.035,.68,1.55,'#344e58');
    box(side*1.21,2.42,3.39,.026,.69,.044,'#232c30');
    box(side*1.19,1.94,2.25,.05,.065,.22,'#434b4d');
    box(side*1.24,1.02,2.05,.38,.10,.53,'#7b8382');
    box(side*1.16,.81,2.05,.38,.10,.53,'#5a6569');
    box(side*.91,1.0,.65,.55,.58,1.53,'#939893');
    for (const z of [.18,1.12]) box(side*.92,1.0,z,.57,.60,.07,'#555e60');
    box(side*1.27,2.36,3.6,.23,.05,.05,'#41464a');
    box(side*1.41,2.36,3.6,.11,.29,.16,'#363d40');
    box(side*.91,1.52,4.16,.42,.19,.12,'#fff2c9');
    box(side*1.04,.93,1.69,.45,.16,.64,'#667075');
    box(side*.97,.91,-2.59,.48,.16,2.68,'#42494c');
    box(side*.96,.71,-4.17,.27,.13,.1,'#b94b38');
  }
  box(0,1.2,-1.08,1.64,.25,5.7,'#596463');
  return mergeGeometries(pieces)!;
}

function buildDrum() {
  // Turn the angular grid along the drum so the two painted spirals have crisp edges.
  const profile = [[-2.66,.04],[-2.65,.43],[-2.40,.80],[-1.83,1.11],[-1.20,1.28],
    [-.74,1.31],[.33,1.28],[.92,1.18],[1.55,.96],[2.33,.63],[2.63,.53],[2.67,.53]];
  const rings = profile.map(([y,r]) => new THREE.Vector2(r!,y!));
  const outline: THREE.Vector2[] = [rings[0]!];
  for (let i = 1; i < rings.length; i++) {
    const start = rings[i-1]!;
    const end = rings[i]!;
    const steps = Math.ceil(start.distanceTo(end) / .14);
    for (let step = 1; step <= steps; step++) {
      outline.push(start.clone().lerp(end, step / steps));
    }
  }
  const geometry = new THREE.LatheGeometry(outline,64).toNonIndexed();
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const normals = geometry.getAttribute('normal');
  const colors: number[] = [];
  for (let face=0; face<positions.count; face+=3) {
    const u = (uv.getX(face)+uv.getX(face+1)+uv.getX(face+2))/3;
    const stripe = (u*2)%1;
    const paint = new THREE.Color(stripe < .23 ? '#a9502b' : stripe < .28 ? '#563e34' : '#d9d6c5');
    for (let i=face; i<face+3; i++) {
      const y = positions.getY(i);
      const angle = 2*Math.PI*uv.getX(i) + y*.74;
      const radius = Math.hypot(positions.getX(i),positions.getZ(i));
      positions.setXYZ(i,radius*Math.sin(angle),y,radius*Math.cos(angle));
      const radial = Math.hypot(normals.getX(i),normals.getZ(i));
      normals.setXYZ(i,radial*Math.sin(angle),normals.getY(i),radial*Math.cos(angle));
      colors.push(paint.r,paint.g,paint.b);
    }
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
      <group position={[0,1.91,-4.04]} rotation={[-.31,.26,0]}>
        <mesh rotation-x={Math.PI/2} castShadow>
          <cylinderGeometry args={[.28,.23,1.82,16,1,true,-Math.PI/2,Math.PI]}/>
          <meshStandardMaterial color="#798281" side={THREE.DoubleSide}/>
        </mesh>
      </group>
      <group position={[.84,1.89,-3.7]} rotation-x={-.21}>
        {[-.22,.22].map(x=><mesh key={x} position-x={x}><boxGeometry args={[.055,1.96,.06]}/><meshStandardMaterial color="#505c5d"/></mesh>)}
        {[0,1,2,3,4,5].map(i=><mesh key={i} position-y={i*.31-.85}><boxGeometry args={[.45,.042,.085]}/><meshStandardMaterial color="#9a9f95"/></mesh>)}
      </group>
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
