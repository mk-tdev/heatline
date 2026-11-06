// A UAE construction worker: navy coverall, hi-vis vest with reflective bands, hard hat with a
// neck shade cloth, gloves and boots. Articulated limbs: walks between places, works (tying
// rebar, pouring, fixing panels), sits to rest, lies down when being cooled.
// Individual strain is never shown on the figure; only a disclosed red flag adds a beacon.

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Activity } from '@heatline/contracts';
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

export type Pose = 'work-heavy' | 'work-moderate' | 'work-light' | 'rest' | 'cooling';

export function poseFor(activity: Activity, zone: string): Pose {
  if (zone === 'first-aid') return 'cooling';
  if (activity === 'rest') return 'rest';
  if (activity === 'heavy') return 'work-heavy';
  if (activity === 'moderate') return 'work-moderate';
  return 'work-light';
}

export function Person({ id, target, look, pose, facing = 0, selected, redFlag, labelled, crewColour }: { id: string; target: THREE.Vector3; look: Look; pose: Pose; facing?: number; selected: boolean; redFlag: boolean; labelled: boolean; crewColour: string }) {
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
    if (!labelled || !root.current) return;
    anchors.set(`w-${id}`, { object: root.current, lift: 2.3 });
    return () => void anchors.delete(`w-${id}`);
  }, [id, labelled]);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime + seed;
    // Walk toward the target. Long hops (up the hoist, between levels) are shortened.
    const delta = new THREE.Vector3().subVectors(target, g.position);
    const dist = delta.length();
    let walking = false;
    if (dist > 60) g.position.copy(target);
    else if (dist > 0.25) {
      walking = true;
      const step = Math.min(dist, dt * (dist > 12 ? 9 : 3.2));
      g.position.addScaledVector(delta.normalize(), step);
      heading.current = Math.atan2(delta.x, delta.z);
    } else {
      heading.current += ((facing - heading.current + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 2);
    }
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
    } else if (pose === 'work-heavy') {
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
    } else if (pose === 'work-moderate') {
      // Fixing panels: arms raised, small reaching movements.
      const s = Math.sin(t * 2.4);
      set(legL);
      set(legR);
      set(kneeL);
      set(kneeR);
      set(torso, -0.05);
      set(armL, -2.4 + s * 0.2);
      set(armR, -2.1 - s * 0.25);
    } else if (pose === 'work-light') {
      const s = Math.sin(t * 1.6);
      set(legL);
      set(legR);
      set(kneeL);
      set(kneeR);
      set(torso, 0.25);
      set(armL, -0.9 + s * 0.15);
      set(armR, -0.8 - s * 0.15);
    } else if (pose === 'rest') {
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
    <group ref={root} position={target}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, selected ? 0.82 : 0.66, 28]} />
        <meshBasicMaterial color={selected ? '#ffffff' : crewColour} transparent opacity={selected ? 0.95 : 0.75} />
      </mesh>
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
