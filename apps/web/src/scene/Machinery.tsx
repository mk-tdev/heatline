// Illustrative machinery; ambient motion does not model crane operations or worker transport.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toScene } from './common';

type Point = [number, number, number];
type Member = [Point, Point];
const GOLD = '#eeb344';
const DARK = '#344b51';

// One draw call for each structural assembly, including all diagonal bracing.
function Steel({ members, color = GOLD, width = .1 }: { members: Member[]; color?: string; width?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const object = new THREE.Object3D();
    const axis = new THREE.Vector3(0, 1, 0);
    members.forEach(([a, b], i) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
      const direction = end.clone().sub(start);
      object.position.copy(start).add(end).multiplyScalar(.5);
      object.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
      object.scale.set(width, direction.length(), width);
      object.updateMatrix(); ref.current!.setMatrixAt(i, object.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [members, width]);
  return <instancedMesh ref={ref} args={[undefined, undefined, members.length]} castShadow><boxGeometry /><meshStandardMaterial color={color} roughness={.56} metalness={.45} /></instancedMesh>;
}
function Box({ at, size, color = GOLD }: { at: Point; size: Point; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.65} metalness={.2} /></mesh>;
}
function mastMembers(height: number, radius: number, step: number): Member[] {
  const out: Member[] = [];
  const corners: Point[] = [[-radius,0,-radius],[radius,0,-radius],[radius,0,radius],[-radius,0,radius]];
  for (let i=0;i<4;i++) {
    const a=corners[i]!, b=corners[(i+1)%4]!;
    out.push([a,[a[0],height,a[2]]]);
    for(let y=0;y<height;y+=step) {
      const top=Math.min(height,y+step);
      out.push([[a[0],y,a[2]],[b[0],y,b[2]]],[[a[0],y,a[2]],[b[0],top,b[2]]]);
    }
  }
  return out;
}
export function Crane({ at, height, jib, turn = 0 }: { at: THREE.Vector3; height: number; jib: number; turn?: number }) {
  const slew=useRef<THREE.Group>(null), trolley=useRef<THREE.Group>(null), cable=useRef<THREE.Mesh>(null), hook=useRef<THREE.Group>(null);
  const mast=useMemo(()=>mastMembers(height,.9,3),[height]);
  const boom=useMemo(()=>{
    const out:Member[]=[];
    const back=-jib*.32;
    for(let x=back;x<jib;x+=3) {
      const next=Math.min(jib,x+3);
      for(const z of [-.8,.8]) out.push([[x,0,z],[next,0,z]],[[x,0,z],[next,1.65,0]],[[x,1.65,0],[next,0,z]]);
      out.push([[x,1.65,0],[next,1.65,0]],[[x,0,-.8],[x,0,.8]]);
    }
    return out;
  },[jib]);
  const stays=useMemo<Member[]>(()=>[[[0,8,0],[jib*.72,2.6,0]],[[0,8,0],[-jib*.29,2.6,0]],[[0,2.6,0],[0,8,0]]],[jib]);
  useFrame(({clock})=>{
    const t=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:clock.elapsedTime*.08;
    const length=height*(.25+.12*(1+Math.sin(t)));
    if(slew.current) slew.current.rotation.y=turn+Math.sin(t*.35)*.25;
    if(trolley.current) trolley.current.position.x=jib*(.52+.12*Math.sin(t*.6));
    if(cable.current) {cable.current.position.y=-length/2;cable.current.scale.y=length;}
    if(hook.current) hook.current.position.y=-length;
  });
  return <group position={at}>
    <Box at={[0,.6,0]} size={[6,1.2,6]} color="#a4a39c" />
    <Steel members={mast} width={.16} />
    <group ref={slew} position={[0,height,0]} rotation-y={turn}>
      <mesh><cylinderGeometry args={[1.6,1.6,.5,20]} /><meshStandardMaterial color={DARK} /></mesh>
      <group position={[0,2.6,0]}><Steel members={boom} width={.13}/></group>
      <Steel members={stays} width={.09} color={DARK}/>
      <Box at={[1.2,.8,1.3]} size={[2.4,2.3,1.7]} color="#eee7d3"/>
      <Box at={[1.25,1.1,2.17]} size={[1.9,1.3,.06]} color="#286477"/>
      <Box at={[2.42,1.1,1.3]} size={[.05,1.3,1.3]} color="#286477"/>
      {[0,1,2,3].map(i=><Box key={i} at={[-jib*.28+i*.65,1.5,0]} size={[.55,2.5,2.4]} color="#8d9694"/>)}
      <Box at={[-jib*.14,2.9,0]} size={[2,1,1.2]} color={DARK}/>
      <group ref={trolley} position={[jib*.52,2.5,0]}>
        <Box at={[0,0,0]} size={[1.6,.45,2]} color={DARK}/>
        <mesh ref={cable}><boxGeometry args={[.055,1,.055]}/><meshStandardMaterial color="#26393b"/></mesh>
        <group ref={hook}>
          <Box at={[0,0,0]} size={[.65,.8,.5]} color={GOLD}/>
          <mesh position={[0,-.65,0]} rotation-z={-.4}><torusGeometry args={[.3,.08,6,12,Math.PI*1.65]}/><meshStandardMaterial color={DARK}/></mesh>
        </group>
      </group>
    </group>
  </group>;
}
export function Hoist() {
  const cage=useRef<THREE.Group>(null);
  const mast=useMemo(()=>mastMembers(44,.4,1.75),[]);
  const frame=useMemo<Member[]>(()=>{
    const out:Member[]=[];
    for(const x of [.6,2.8]) for(const z of [-1.4,1.4]) out.push([[x,0,z],[x,2.6,z]]);
    for(const y of [.15,1.1,2.5]) {
      out.push([[.6,y,-1.4],[2.8,y,-1.4]],[[.6,y,1.4],[2.8,y,1.4]],[[2.8,y,-1.4],[2.8,y,1.4]]);
    }
    for(let z=-1.2;z<=1.2;z+=.3) out.push([[2.8,.2,z],[2.8,2.5,z]]);
    for(let x=.8;x<2.8;x+=.3) for(const z of [-1.4,1.4]) out.push([[x,.2,z],[x,2.5,z]]);
    return out;
  },[]);
  const ties=useMemo<Member[]>(()=>Array.from({length:12},(_,i)=>[[-2,(i+1)*3.5,0],[0,(i+1)*3.5,0]] as Member),[]);
  useFrame(({clock})=>{
    // Four seconds at each landing; eight seconds of eased travel to the next stop.
    const t=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:clock.elapsedTime;
    const stops=[0,3,6,9,12,9,6,3,0];
    const leg=Math.floor(t/12)%8, phase=Math.max(0,(t%12-4)/8), ease=phase*phase*(3-2*phase);
    if(cage.current) cage.current.position.y=.4+(stops[leg]!+(stops[leg+1]!-stops[leg]!)*ease)*3.5;
  });
  return <group position={toScene(42,9)}>
    <Box at={[1,.15,0]} size={[5,.3,4.2]} color="#aaa99e"/>
    <Steel members={mast} width={.09} color="#b2bdbe"/><Steel members={ties} width={.16} color={DARK}/>
    <Box at={[.44,22,0]} size={[.12,44,.16]} color={DARK}/>
    <group ref={cage} position={[0,.4,0]}>
      <Steel members={frame} width={.065} color="#e89630"/>
      <Box at={[1.7,.06,0]} size={[2.35,.16,3]} color={DARK}/>
      <Box at={[1.7,2.65,0]} size={[2.5,.18,3.15]}/>
      <Box at={[.75,2.95,0]} size={[.7,.5,.9]} color={DARK}/>
      <Box at={[2.85,.45,0]} size={[.1,.5,2.8]}/>
    </group>
    {[0,1,2].map(i=><Box key={i} at={[1.7,.45,i-1]} size={[2.5,.12,.12]} color={DARK}/>)}
  </group>;
}
