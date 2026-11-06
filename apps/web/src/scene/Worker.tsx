// A procedural site worker (hard hat, hi-vis vest, crew-coloured ring). Moves smoothly toward
// its target; works with a gentle bend, rests seated. Individual strain is never shown here:
// the ring is the crew colour, and only a disclosed red flag adds a beacon.

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anchors } from './labels';
import type { Activity } from '@heatline/contracts';

export function Worker({
  id,
  target,
  crewColour,
  activity,
  selected,
  redFlag,
  label,
}: {
  id: string;
  target: THREE.Vector3;
  crewColour: string;
  activity: Activity;
  selected: boolean;
  redFlag: boolean;
  label?: string;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const seed = useRef(Math.random() * 10);
  useEffect(() => {
    if (!label || !root.current) return;
    anchors.set(`w-${id}`, { object: root.current, lift: 2.4 });
    return () => void anchors.delete(`w-${id}`);
  }, [id, label]);
  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    // Travel between zones, faster over long distances (lifts, stairs).
    const gap = g.position.distanceTo(target);
    if (gap > 80) g.position.copy(target);
    else g.position.lerp(target, Math.min(1, dt * 2.2));
    const t = clock.elapsedTime + seed.current;
    if (body.current) {
      const working = activity !== 'rest';
      body.current.rotation.x = working ? 0.25 + Math.sin(t * (activity === 'heavy' ? 4 : 2.5)) * 0.18 : 0;
      body.current.position.y = working ? 0 : -0.35;
    }
    if (beacon.current) beacon.current.scale.setScalar(1 + Math.sin(t * 6) * 0.25);
  });
  return (
    <group ref={root} position={target}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.55, selected ? 0.95 : 0.75, 24]} />
        <meshBasicMaterial color={selected ? '#ffffff' : crewColour} transparent opacity={selected ? 0.95 : 0.8} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.42, 0.9, 0.3]} />
          <meshStandardMaterial color="#2f3640" />
        </mesh>
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[0.5, 0.65, 0.34]} />
          <meshStandardMaterial color="#f5c518" emissive="#4a3a00" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, 1.75, 0]} castShadow>
          <sphereGeometry args={[0.17, 12, 10]} />
          <meshStandardMaterial color="#b5835a" />
        </mesh>
        <mesh position={[0, 1.88, 0]} castShadow>
          <sphereGeometry args={[0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fbfbfb" />
        </mesh>
      </group>
      {redFlag && (
        <mesh ref={beacon} position={[0, 2.7, 0]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshBasicMaterial color="#ff3b3b" />
        </mesh>
      )}
    </group>
  );
}
