// A UAE construction worker: navy coverall, hi-vis vest with reflective bands, hard hat with a
// neck shade cloth, gloves and boots. Articulated limbs: walks between places, works (tying
// rebar, pouring, fixing panels), sits to rest, lies down when being cooled.
// Individual strain is never shown on the figure; only a disclosed red flag adds a beacon.

import { useContext, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Activity } from '@heatline/contracts';
import { CrewLift, CrewWalk } from './crewTransit';
import { anchors } from './labels';

export interface Look {
  skin: string;
  coverall: string;
  vest: string;
  helmet: string;
  shade: string;
  harness?: boolean;
  tablet?: boolean;
}

export type Pose = 'work-heavy' | 'work-moderate' | 'work-light' | 'rest' | 'cooling' | 'stand';

export function poseFor(activity: Activity, zone: string): Pose {
  if (zone === 'first-aid') return 'cooling';
  if (activity === 'rest') return 'rest';
  if (activity === 'heavy') return 'work-heavy';
  if (activity === 'moderate') return 'work-moderate';
  return 'work-light';
}

export function Person({
  id,
  target,
  spawn,
  slot=0,
  look,
  pose,
  facing = 0,
  selected = false,
  redFlag = false,
  anchor = true,
  crewColour,
  ring = true,
}: {
  id: string;
  target: THREE.Vector3;
  /** where the figure first appears; it then walks to `target` */
  spawn?: THREE.Vector3;
  slot?: number;
  look: Look;
  pose: Pose;
  facing?: number;
  selected?: boolean;
  redFlag?: boolean;
  /** register a screen anchor (labels and speech bubbles) */
  anchor?: boolean;
  crewColour?: string;
  ring?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) * 0.37, [id]);
  const heading = useRef(facing);

  useEffect(() => {
    if (!anchor || !root.current) return;
    anchors.set(`w-${id}`, { object: root.current, lift: 2.3 });
    anchors.set(`say-${id}`, { object: root.current, lift: 2.9 });
    return () => {
      anchors.delete(`w-${id}`);
      anchors.delete(`say-${id}`);
    };
  }, [id, anchor]);
  const start = useMemo(() => (spawn ?? target).clone(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const lift=useContext(CrewLift);
  const transit=useMemo(()=>new CrewWalk(start.y,slot),[start,slot]);
  useEffect(()=>()=>lift?.release(id),[lift,id]);
  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + seed;
    const beforeX=g.position.x, beforeZ=g.position.z;
    let walking=false;
    if(lift && anchor) walking=transit.advance(id,g.position,target,lift,Math.min(dt,.1));
    else {
      // Ambient pedestrians follow level pavement. Sandbox crew start at their station.
      const dx=target.x-beforeX, dz=target.z-beforeZ, d=Math.hypot(dx,dz);
      if(d>.02) {
        const fraction=Math.min(1,Math.min(dt,.1)*3.2/d);
        g.position.x+=dx*fraction; g.position.z+=dz*fraction; walking=true;
      }
    }
    if(walking) heading.current=Math.atan2(g.position.x-beforeX,g.position.z-beforeZ);
    else heading.current += ((facing-heading.current+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*2);
    const currentPose=lift && anchor && (lift.requests.has(id) || g.position.distanceTo(target)>.5) ? 'stand' : pose;
    g.rotation.y = heading.current;

    // Reset joints, then pose.
    const set = (r: RefObject<THREE.Group | null>, x = 0, z = 0) => r.current && r.current.rotation.set(x, 0, z);
    let hipY = 0.95;
    let lie = 0;
    if (walking) {
      const s = Math.sin(t * 8);
      set(legL, s * 0.6);
      set(legR, -s * 0.6);
      set(kneeL, Math.max(0, -s) * 0.7);
      set(kneeR, Math.max(0, s) * 0.7);
      set(armL, -s * 0.5);
      set(armR, s * 0.5);
      set(torso, 0.06);
      hipY += Math.abs(Math.cos(t * 8)) * 0.04;
    } else if (currentPose === 'work-heavy') {
      // Bent over, tying rebar or working the concrete: rhythmic arms.
      const s = Math.sin(t * 5);
      set(legL, -0.35);
      set(legR, -0.35);
      set(kneeL, 0.6);
      set(kneeR, 0.6);
      set(torso, 0.75 + s * 0.05);
      set(armL, -1.1 + s * 0.35);
      set(armR, -1.1 - s * 0.35);
      hipY = 0.85;
    } else if (currentPose === 'work-moderate') {
      // Fixing panels: arms raised, small reaching movements.
      const s = Math.sin(t * 2.4);
      set(legL);
      set(legR);
      set(kneeL);
      set(kneeR);
      set(torso, -0.05);
      set(armL, -2.4 + s * 0.2);
      set(armR, -2.1 - s * 0.25);
    } else if (currentPose === 'work-light') {
      const s = Math.sin(t * 1.6);
      set(legL);
      set(legR);
      set(kneeL);
      set(kneeR);
      set(torso, 0.25);
      set(armL, -0.9 + s * 0.15);
      set(armR, -0.8 - s * 0.15);
    } else if (currentPose === 'stand') {
      // Standing and waiting, a slight shift of weight.
      const s = Math.sin(t * 0.7);
      set(legL, s * 0.04);
      set(legR, -s * 0.04);
      set(kneeL);
      set(kneeR);
      set(torso, 0.02);
      set(armL, 0.05);
      set(armR, Math.sin(t * 0.3) > 0.8 ? -1.2 : 0.05);
    } else if (currentPose === 'rest') {
      // Seated on a bench, a bottle of water now and then.
      set(legL, -1.45);
      set(legR, -1.45);
      set(kneeL, 1.5);
      set(kneeR, 1.5);
      set(torso, 0.08);
      set(armL, -0.4);
      set(armR, Math.sin(t * 0.5) > 0.7 ? -2.4 : -0.4);
      hipY = 0.5;
    } else {
      // Being cooled: lying down.
      lie = Math.PI / 2;
      set(legL);
      set(legR);
      set(kneeL);
      set(kneeR);
      set(torso);
      set(armL, -0.2);
      set(armR, -0.2);
      hipY = 0.25;
    }
    if (hips.current) {
      hips.current.position.y = hipY;
      hips.current.rotation.x = -lie;
    }
    if (head.current) head.current.rotation.y = walking ? 0 : Math.sin(t * 0.4) * 0.35;
    if (beacon.current) beacon.current.scale.setScalar(1 + Math.sin(t * 6) * 0.25);
  });

  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => <meshStandardMaterial color={color} roughness={0.85} {...extra} />;
  const reflective = mat('#e6e8ea', { metalness: 0.6, roughness: 0.3 });

  return (
    <group ref={root} position={start}>
      {ring && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.5, selected ? 0.82 : 0.66, 28]} />
          <meshBasicMaterial color={selected ? '#ffffff' : (crewColour ?? '#888')} transparent opacity={selected ? 0.95 : 0.75} />
        </mesh>
      )}
      <group ref={hips} position={[0, 0.95, 0]}>
        {/* Legs: thigh → knee → shin → boot */}
        {(
          [
            [legL, kneeL, -0.11],
            [legR, kneeR, 0.11],
          ] as const
        ).map(([leg, knee, x]) => (
          <group key={x} ref={leg} position={[x, 0, 0]}>
            <mesh position={[0, -0.24, 0]} castShadow>
              <boxGeometry args={[0.16, 0.48, 0.18]} />
              {mat(look.coverall)}
            </mesh>
            <group ref={knee} position={[0, -0.48, 0]}>
              <mesh position={[0, -0.21, 0]} castShadow>
                <boxGeometry args={[0.14, 0.42, 0.16]} />
                {mat(look.coverall)}
              </mesh>
              <mesh position={[0, -0.24, 0]}>
                <boxGeometry args={[0.15, 0.05, 0.17]} />
                {reflective}
              </mesh>
              <mesh position={[0, -0.45, 0.05]} castShadow>
                <boxGeometry args={[0.16, 0.1, 0.28]} />
                {mat('#3a2d22')}
              </mesh>
            </group>
          </group>
        ))}
        <group ref={torso}>
          {/* Coverall body with a hi-vis vest over it */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.42, 0.62, 0.24]} />
            {mat(look.coverall)}
          </mesh>
          <mesh position={[0, 0.33, 0]} castShadow>
            <boxGeometry args={[0.45, 0.48, 0.27]} />
            {mat(look.vest, { emissive: look.vest, emissiveIntensity: 0.08 })}
          </mesh>
          {[0.22, 0.42].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.46, 0.04, 0.28]} />
              {reflective}
            </mesh>
          ))}
          {look.harness && (
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[0.47, 0.06, 0.29]} />
              {mat('#d4501f')}
            </mesh>
          )}
          {/* Arms with gloves */}
          {(
            [
              [armL, -0.27],
              [armR, 0.27],
            ] as const
          ).map(([arm, x]) => (
            <group key={x} ref={arm} position={[x, 0.56, 0]}>
              <mesh position={[0, -0.28, 0]} castShadow>
                <boxGeometry args={[0.11, 0.56, 0.12]} />
                {mat(look.coverall)}
              </mesh>
              <mesh position={[0, -0.6, 0]}>
                <boxGeometry args={[0.1, 0.12, 0.11]} />
                {mat('#d9d2b8')}
              </mesh>
            </group>
          ))}
          {look.tablet && (
            <mesh position={[0.2, 0.3, 0.22]} rotation-x={-0.6}>
              <boxGeometry args={[0.24, 0.17, 0.02]} />
              {mat('#1c1f24')}
            </mesh>
          )}
          {/* Head, neck shade and hard hat */}
          <group ref={head} position={[0, 0.78, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 14, 12]} />
              {mat(look.skin, { roughness: 0.7 })}
            </mesh>
            <mesh position={[0, -0.02, -0.07]}>
              <boxGeometry args={[0.27, 0.24, 0.1]} />
              {mat(look.shade)}
            </mesh>
            <mesh position={[0, 0.07, 0]} castShadow>
              <sphereGeometry args={[0.145, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              {mat(look.helmet, { roughness: 0.4 })}
            </mesh>
            <mesh position={[0, 0.07, 0.03]}>
              <cylinderGeometry args={[0.18, 0.18, 0.015, 18]} />
              {mat(look.helmet, { roughness: 0.4 })}
            </mesh>
          </group>
        </group>
      </group>
      {redFlag && (
        <mesh ref={beacon} position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshBasicMaterial color="#ff3b3b" />
        </mesh>
      )}
    </group>
  );
}

const SKINS = ['#8d5a3b', '#a56b45', '#7a4b31', '#b9825a', '#6b4029', '#c49069'];
const COVERALLS = ['#1f3a68', '#22406f', '#2b4b7e', '#1d355c'];

/** Appearance by worker: crew members in navy coveralls, lime vests and yellow helmets; the crew lead in an orange vest; the foreman in a white helmet (white is for engineers and supervisors on UAE sites). */
export function lookFor(id: string, index: number, role: 'worker' | 'lead' | 'foreman', crew: string): Look {
  const skin = SKINS[(index * 7 + id.length) % SKINS.length]!;
  const coverall = COVERALLS[index % COVERALLS.length]!;
  if (role === 'foreman') return { skin, coverall: '#e8e4da', vest: '#f08a24', helmet: '#fbfbfb', shade: '#f2efe6', tablet: true };
  if (role === 'lead') return { skin, coverall, vest: '#f08a24', helmet: '#f6c21c', shade: '#ece4cf' };
  return { skin, coverall, vest: '#c8e83a', helmet: '#f6c21c', shade: index % 2 ? '#ece4cf' : '#f4f2ea', harness: crew === 'C' };
}
