// Everything that makes the place feel inhabited: traffic on the roads, people on the
// pavements, the neighbourhood across the south road, the crew on the phase-2 tower and birds.
// Decorative only; none of it is simulated physiology.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rand, toScene } from './common';
import { Person, lookFor } from './Person';

export function Life() {
  return (
    <group>
      <Traffic />
      <Neighbourhood />
      <Pedestrians />
      <TowerBCrew />
      <Birds />
    </group>
  );
}

const CAR_COLOURS = ['#f4f4f2', '#d8dcdf', '#1d1f23', '#9aa4ab', '#b8312f', '#f2f0ea', '#2f4f7a', '#e7e2d6'];

interface Lane {
  from: THREE.Vector3;
  to: THREE.Vector3;
}

const LANES: Lane[] = [
  { from: toScene(130, -260, 0), to: toScene(130, 300, 0) }, // east road, northbound
  { from: toScene(138, 300, 0), to: toScene(138, -260, 0) }, // east road, southbound
  { from: toScene(-240, -62, 0), to: toScene(320, -62, 0) }, // south road, eastbound
  { from: toScene(320, -70, 0), to: toScene(-240, -70, 0) }, // south road, westbound
];

/** Cars, pickups, a taxi and a water tanker looping along the two roads. */
function Traffic() {
  const vehicles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        lane: LANES[i % LANES.length]!,
        offset: rand(i * 3.1),
        speed: 0.018 + rand(i + 7) * 0.014,
        colour: i % 9 === 4 ? '#e8b923' : CAR_COLOURS[i % CAR_COLOURS.length]!,
        kind: i % 11 === 5 ? 'tanker' : i % 4 === 1 ? 'pickup' : 'car',
      })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    vehicles.forEach((v, i) => {
      const g = refs.current[i];
      if (!g) return;
      const t = (v.offset + clock.elapsedTime * v.speed) % 1;
      g.position.lerpVectors(v.lane.from, v.lane.to, t);
      g.lookAt(v.lane.to.x, 0, v.lane.to.z);
    });
  });
  return (
    <group>
      {vehicles.map((v, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          {v.kind === 'tanker' ? (
            <>
              <mesh position={[0, 1.4, 2.6]} castShadow>
                <boxGeometry args={[2.4, 2.2, 2]} />
                <meshStandardMaterial color="#f2f0ea" />
              </mesh>
              <mesh position={[0, 1.6, -1.2]} rotation-x={Math.PI / 2} castShadow>
                <cylinderGeometry args={[1.1, 1.1, 5, 14]} />
                <meshStandardMaterial color="#d7dde2" metalness={0.5} roughness={0.3} />
              </mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 0.75, 0]} castShadow>
                <boxGeometry args={[1.85, 0.8, v.kind === 'pickup' ? 5.2 : 4.5]} />
                <meshStandardMaterial color={v.colour} roughness={0.35} metalness={0.4} />
              </mesh>
              <mesh position={[0, 1.4, v.kind === 'pickup' ? 0.7 : 0]} castShadow>
                <boxGeometry args={[1.7, 0.6, v.kind === 'pickup' ? 2.2 : 2.6]} />
                <meshStandardMaterial color="#2c3a44" roughness={0.15} metalness={0.5} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/** Low-rise apartments with shaded parking, a row of shops and a small neighbourhood mosque. */
function Neighbourhood() {
  const blocks = useMemo(() => [-40, 10, 60, 160].map((x, i) => ({ x, y: -150 - (i % 2) * 6, floors: 5 + (i % 3) })), []);
  return (
    <group>
      {blocks.map((b, i) => (
        <group key={i} position={toScene(b.x, b.y)}>
          <mesh position={[0, (b.floors * 3.2) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[30, b.floors * 3.2, 16]} />
            <meshStandardMaterial color={i % 2 ? '#efe6d6' : '#e6dccb'} roughness={0.9} />
          </mesh>
          {Array.from({ length: b.floors }, (_, f) => (
            <mesh key={f} position={[0, f * 3.2 + 1.6, 8.05]}>
              <boxGeometry args={[27, 1.3, 0.05]} />
              <meshStandardMaterial color="#5c7a8c" roughness={0.2} metalness={0.3} />
            </mesh>
          ))}
          {Array.from({ length: b.floors }, (_, f) => (
            <mesh key={`b${f}`} position={[0, f * 3.2 + 0.6, 8.6]} castShadow>
              <boxGeometry args={[28, 0.15, 1.2]} />
              <meshStandardMaterial color="#f4efe5" />
            </mesh>
          ))}
          {/* Shaded parking in front */}
          <mesh position={[0, 2.4, 14]} castShadow receiveShadow>
            <boxGeometry args={[26, 0.12, 5]} />
            <meshStandardMaterial color="#f0f0ee" />
          </mesh>
        </group>
      ))}
      {/* Shops with awnings */}
      <group position={toScene(108, -142)}>
        <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[34, 4.4, 10]} />
          <meshStandardMaterial color="#e9e2d3" />
        </mesh>
        {[-12, -4, 4, 12].map((x, i) => (
          <mesh key={x} position={[x, 3.2, 5.6]} rotation-x={0.35} castShadow>
            <boxGeometry args={[7, 0.1, 2]} />
            <meshStandardMaterial color={['#c94f3d', '#2f6fbf', '#3a8f5c', '#d39b2a'][i]} />
          </mesh>
        ))}
      </group>
      {/* Neighbourhood mosque: prayer hall, dome and minaret */}
      <group position={toScene(232, -150)}>
        <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[22, 7, 22]} />
          <meshStandardMaterial color="#f5f1e8" roughness={0.8} />
        </mesh>
        <mesh position={[0, 7, 0]} castShadow>
          <sphereGeometry args={[6.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e8e2d4" roughness={0.6} />
        </mesh>
        <mesh position={[13, 12, 9]} castShadow>
          <cylinderGeometry args={[1.1, 1.4, 24, 12]} />
          <meshStandardMaterial color="#f5f1e8" />
        </mesh>
        <mesh position={[13, 24.8, 9]} castShadow>
          <coneGeometry args={[1.3, 3, 12]} />
          <meshStandardMaterial color="#d8cfb9" />
        </mesh>
      </group>
    </group>
  );
}

/** A few people on the pavements: a delivery rider's wait, a walk to the shops. */
function Pedestrians() {
  const people = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const southSide = i % 2 === 0;
        const a = southSide ? toScene(-60 + i * 30, -77) : toScene(127, -40 + i * 18);
        const b = southSide ? toScene(-60 + i * 30 + 40, -77) : toScene(127, -40 + i * 18 + 34);
        return { id: `ped${i}`, a, b, phase: rand(i) * 10, look: { skin: ['#8d5a3b', '#c49069', '#a56b45', '#e0b48c'][i % 4]!, coverall: ['#f2f2f0', '#2b4b7e', '#c9b38f', '#3d3d3d'][i % 4]!, vest: ['#f2f2f0', '#7a8c9a', '#c9b38f', '#2a2a2a'][i % 4]!, helmet: '#2a2a2a', shade: '#f2f2f0' } };
      }),
    [],
  );
  return (
    <group>
      {people.map((p) => (
        <Walker key={p.id} {...p} />
      ))}
    </group>
  );
}

function Walker({ id, a, b, phase, look }: { id: string; a: THREE.Vector3; b: THREE.Vector3; phase: number; look: Parameters<typeof Person>[0]['look'] }) {
  const target = useRef(b.clone());
  const holder = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // Switch direction every ~25 s; Person walks itself to the target.
    const leg = Math.floor((clock.elapsedTime + phase) / 25) % 2;
    target.current.copy(leg ? a : b);
  });
  return (
    <group ref={holder}>
      <Person id={id} target={target.current} spawn={a} look={{ ...look, helmet: look.coverall }} pose="stand" anchor={false} ring={false} />
    </group>
  );
}

/** Eight people working the formwork on the phase-2 tower's top deck. */
function TowerBCrew() {
  const crew = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ id: `tb${i}`, at: toScene(12 + (i % 4) * 6, 80 + Math.floor(i / 4) * 9, 21.6), facing: i * 0.8 })), []);
  return (
    <group>
      {crew.map((c, i) => (
        <Person key={c.id} id={c.id} target={c.at} look={lookFor(c.id, i + 3, i === 0 ? 'lead' : 'worker', 'B')} pose={i % 3 ? 'work-heavy' : 'work-moderate'} facing={c.facing} anchor={false} ring={false} />
      ))}
    </group>
  );
}

/** Gulls circling over the shore. */
function Birds() {
  const flock = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ r: 40 + rand(i) * 50, h: 45 + rand(i + 3) * 25, speed: 0.08 + rand(i + 5) * 0.06, phase: rand(i + 9) * 6, cx: -20 + rand(i + 2) * 100, cz: -150 })), []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    flock.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const t = clock.elapsedTime * b.speed + b.phase;
      g.position.set(b.cx + Math.cos(t) * b.r, b.h + Math.sin(t * 3) * 2, b.cz + Math.sin(t) * b.r * 0.6);
      g.rotation.y = -t;
      g.children.forEach((wing, k) => (wing.rotation.z = (k ? -1 : 1) * (0.3 + Math.sin(clock.elapsedTime * 8 + i) * 0.35)));
    });
  });
  return (
    <group>
      {flock.map((_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <mesh position={[0.6, 0, 0]}>
            <boxGeometry args={[1.2, 0.05, 0.4]} />
            <meshStandardMaterial color="#f4f4f2" />
          </mesh>
          <mesh position={[-0.6, 0, 0]}>
            <boxGeometry args={[1.2, 0.05, 0.4]} />
            <meshStandardMaterial color="#f4f4f2" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
