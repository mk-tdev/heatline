// The 3D site. Engine coordinates are metres with x east and y north; three.js uses x east,
// y up and z south, so an engine point (x, y) sits at (x, height, -y).

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MinuteRecord, Plan, Scenario, Zone } from '@heatline/contracts';
import { heatZone } from '@heatline/rules';
import { Worker } from './Worker';
import { LabelProjector, anchors } from './labels';

const toScene = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);
export const CREW_COLOURS: Record<string, string> = { A: '#4c9be8', B: '#f08a24', C: '#2fb39a' };
const ZONE_CHIP: Record<string, string> = { unrestricted: '#3aa76d', low: '#b8c43a', medium: '#e8a33d', high: '#e5484d' };

export interface SiteProps {
  scenario: Scenario;
  record: MinuteRecord;
  plan: Plan | null;
  pourProgress: number; // 0..1
  truckOnSite: boolean;
  selectedWorker: string;
  redFlagWorkers: string[];
  /** changing this puts the camera back to its home view */
  viewKey: number;
}

function CameraHome({ viewKey }: { viewKey: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(118, 62, 78);
    camera.lookAt(46, 10, -8);
  }, [viewKey, camera]);
  return null;
}

const labelPoint = (zone: Zone) => (zone.id === 'facade' ? toScene(zone.at.x - 6, zone.at.y, 32) : toScene(zone.at.x, zone.at.y, zone.height + 6));

export function Site(props: SiteProps) {
  const labelled = useMemo(() => props.scenario.zones.filter((z) => z.kind === 'outdoor' || z.kind === 'elevated'), [props.scenario]);
  useEffect(() => {
    for (const z of labelled) anchors.set(`z-${z.id}`, { point: labelPoint(z), lift: 0 });
    return () => labelled.forEach((z) => anchors.delete(`z-${z.id}`));
  }, [labelled]);
  return (
    <>
      <Canvas shadows camera={{ position: [118, 62, 78], fov: 40, near: 1, far: 2000 }} gl={{ antialias: true }}>
        <SceneContents {...props} />
        <LabelProjector />
        <OrbitControls key={props.viewKey} target={[46, 10, -8]} maxPolarAngle={Math.PI / 2.15} minDistance={40} maxDistance={330} enableDamping />
        <CameraHome viewKey={props.viewKey} />
      </Canvas>
      <div className="labels">
        {labelled.map((z) => {
          const c = props.record.zones.find((x) => x.zone === z.id)!;
          const hz = heatZone(c.wbgt);
          return (
            <div key={z.id} id={`lbl-z-${z.id}`} className="zone-label">
              <span className="zone-dot" style={{ background: ZONE_CHIP[hz] }} />
              <strong>{z.label}</strong>
              <span>
                {c.wbgt.toFixed(1)}°C · {hz}
                {c.shaded ? ' · shade' : ''}
              </span>
            </div>
          );
        })}
        {props.scenario.workers
          .filter((w) => w.featured)
          .map((w) => (
            <div key={w.id} id={`lbl-w-${w.id}`} className={`worker-label${w.id === props.selectedWorker ? ' selected' : ''}${props.redFlagWorkers.includes(w.id) ? ' red' : ''}`}>
              {w.name}
            </div>
          ))}
      </div>
    </>
  );
}

function SceneContents({ scenario, record, plan, pourProgress, truckOnSite, selectedWorker, redFlagWorkers }: SiteProps) {
  const env = record.env;
  const sunDir = useMemo(() => {
    const az = (env.sunAzimuth * Math.PI) / 180;
    const el = (Math.max(env.sunElevation, 2) * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }, [env.sunAzimuth, env.sunElevation]);
  const warmth = THREE.MathUtils.clamp(1 - env.sunElevation / 60, 0, 1); // later = warmer light
  const sunColour = new THREE.Color().lerpColors(new THREE.Color('#fff4e0'), new THREE.Color('#ffb36b'), warmth);
  const skyColour = new THREE.Color().lerpColors(new THREE.Color('#bcd6ea'), new THREE.Color('#f2c38f'), warmth * 0.8);
  const zones = new Map(scenario.zones.map((z) => [z.id, z]));
  const tentsUp = (plan?.tents ?? []).filter((t) => t.readyAt <= record.minute);

  return (
    <>
      <color attach="background" args={[skyColour.getStyle()]} />
      <fog attach="fog" args={[skyColour.getStyle(), 260, 700]} />
      <hemisphereLight args={['#fff1dc', '#b9935f', 0.55]} />
      <SunLight direction={sunDir} colour={sunColour} />

      {/* Ground: sand with a compacted site pad */}
      <mesh rotation-x={-Math.PI / 2} position={[40, -0.05, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#d8c39b" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[48, 0.01, -5]} receiveShadow>
        <planeGeometry args={[150, 100]} />
        <meshStandardMaterial color="#c9b48b" roughness={1} />
      </mesh>
      <Sea />

      <Tower scenario={scenario} pourProgress={pourProgress} />
      <Scaffold />
      <Crane />
      <RebarYard at={zones.get('yard')!} />
      <Container at={zones.get('cabin')!} colour="#eef0f2" label="AC" />
      <Container at={zones.get('store')!} colour="#d5dde3" />
      <Container at={zones.get('first-aid')!} colour="#f4f4f4" cross />
      <Canopy at={zones.get('shelter')!.at} height={0} size={[14, 10]} colour="#e9e3d2" />
      {tentsUp.map((t) => {
        const z = zones.get(t.zone)!;
        return <Canopy key={t.zone} at={z.at} height={z.kind === 'elevated' ? z.height : 0} size={[12, 9]} colour="#f7f2e3" />;
      })}
      {truckOnSite && <Truck />}

      {scenario.workers.map((w, i) => {
        const t = record.truth.find((x) => x.worker === w.id)!;
        const zone = zones.get(t.zone)!;
        return (
          <Worker
            key={w.id}
            id={w.id}
            target={workerSpot(zone, i)}
            crewColour={CREW_COLOURS[w.crew] ?? '#888'}
            activity={t.activity}
            selected={w.id === selectedWorker}
            redFlag={redFlagWorkers.includes(w.id)}
            label={w.featured ? w.name : undefined}
          />
        );
      })}
    </>
  );
}

function SunLight({ direction, colour }: { direction: THREE.Vector3; colour: THREE.Color }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(45, 0, -5);
    return o;
  }, []);
  useFrame(() => {
    if (!light.current) return;
    light.current.position.copy(target.position).addScaledVector(direction, 220);
    light.current.target = target;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        color={colour}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={10}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
      />
    </>
  );
}

/** Spread workers around their zone's anchor so they don't overlap. */
function workerSpot(zone: Zone, index: number): THREE.Vector3 {
  const ring = 2.2 + (index % 3) * 1.6;
  const angle = index * 2.399; // golden angle
  if (zone.id === 'facade') return toScene(zone.at.x - 1, zone.at.y + ((index % 6) - 2.5) * 3.5, 6 + (index % 4) * 7.5);
  const base = toScene(zone.at.x + Math.cos(angle) * ring, zone.at.y + Math.sin(angle) * ring, zone.height + (zone.kind === 'elevated' ? 0.35 : 0));
  return base;
}

function Tower({ scenario, pourProgress }: { scenario: Scenario; pourProgress: number }) {
  const t = scenario.tower;
  const w = t.maxX - t.minX;
  const d = t.maxY - t.minY;
  const levels = Math.round(t.height / 3.5);
  const centre = toScene((t.minX + t.maxX) / 2, (t.minY + t.maxY) / 2);
  const columns = useMemo(() => {
    const pts: [number, number][] = [];
    for (let x = t.minX + 2; x <= t.maxX - 2; x += 9) for (let y = t.minY + 2; y <= t.maxY - 2; y += 9) pts.push([x, y]);
    return pts;
  }, [t]);
  return (
    <group>
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={i} position={[centre.x, i * 3.5 + 0.2, centre.z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.45, d]} />
          <meshStandardMaterial color={i === levels ? '#b9b2a6' : '#cfc8bc'} roughness={0.9} />
        </mesh>
      ))}
      {columns.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, t.height / 2, -y]} castShadow>
          <boxGeometry args={[0.7, t.height, 0.7]} />
          <meshStandardMaterial color="#bdb6aa" roughness={0.9} />
        </mesh>
      ))}
      {/* Fresh concrete spreading across the deck as the pour progresses */}
      {pourProgress > 0 && (
        <mesh position={[t.minX + (w * pourProgress) / 2, t.height + 0.48, centre.z]} receiveShadow>
          <boxGeometry args={[w * pourProgress, 0.12, d - 1]} />
          <meshStandardMaterial color="#8d8a85" roughness={0.6} />
        </mesh>
      )}
      {/* Rebar mat waiting for the pour */}
      {pourProgress < 1 && (
        <mesh position={[t.minX + w * pourProgress + (w * (1 - pourProgress)) / 2, t.height + 0.46, centre.z]}>
          <boxGeometry args={[w * (1 - pourProgress), 0.06, d - 1]} />
          <meshStandardMaterial color="#8a5a3a" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Scaffold() {
  const bars = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (let y = 0; y <= 30; y += 3) out.push({ p: [-3.2, 15, -y], s: [0.15, 30, 0.15] });
    for (let h = 0; h <= 30; h += 3.5) out.push({ p: [-3.2, h, -15], s: [0.15, 0.15, 30] });
    for (let h = 0; h <= 30; h += 7) out.push({ p: [-2.2, h + 0.1, -15], s: [2, 0.12, 30] });
    return out;
  }, []);
  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.p} castShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={i % 2 ? '#9ea4a8' : '#c2862e'} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Crane() {
  return (
    <group position={[-22, 0, -48]}>
      <mesh position={[0, 31, 0]} castShadow>
        <boxGeometry args={[1.6, 62, 1.6]} />
        <meshStandardMaterial color="#e3b23c" />
      </mesh>
      <mesh position={[22, 62, 0]} castShadow>
        <boxGeometry args={[58, 1.2, 1.2]} />
        <meshStandardMaterial color="#e3b23c" />
      </mesh>
      <mesh position={[-9, 60.5, 0]} castShadow>
        <boxGeometry args={[4, 3, 2.5]} />
        <meshStandardMaterial color="#7a7f86" />
      </mesh>
    </group>
  );
}

function RebarYard({ at }: { at: Zone }) {
  const bundles = useMemo(() => Array.from({ length: 6 }, (_, i) => toScene(at.at.x - 8 + (i % 3) * 8, at.at.y - 6 + Math.floor(i / 3) * 12, 0.4)), [at]);
  return (
    <group>
      {bundles.map((p, i) => (
        <mesh key={i} position={p} rotation-y={0.1 * i} castShadow>
          <boxGeometry args={[6, 0.7, 1.4]} />
          <meshStandardMaterial color="#7a4b31" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Container({ at, colour, label, cross }: { at: Zone; colour: string; label?: string; cross?: boolean }) {
  const p = toScene(at.at.x, at.at.y, 1.3);
  return (
    <group position={p}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[12, 2.6, 4]} />
        <meshStandardMaterial color={colour} roughness={0.6} />
      </mesh>
      {cross && (
        <group position={[0, 0.2, 2.05]}>
          <mesh>
            <boxGeometry args={[1.8, 0.5, 0.05]} />
            <meshStandardMaterial color="#d93a3a" />
          </mesh>
          <mesh>
            <boxGeometry args={[0.5, 1.8, 0.05]} />
            <meshStandardMaterial color="#d93a3a" />
          </mesh>
        </group>
      )}
      {label && (
        <mesh position={[4.5, 1.6, 0]}>
          <boxGeometry args={[1.5, 0.6, 1]} />
          <meshStandardMaterial color="#9aa3aa" />
        </mesh>
      )}
    </group>
  );
}

function Canopy({ at, height, size, colour }: { at: { x: number; y: number }; height: number; size: [number, number]; colour: string }) {
  const p = toScene(at.x, at.y, height);
  const posts: [number, number][] = [
    [-size[0] / 2, -size[1] / 2],
    [size[0] / 2, -size[1] / 2],
    [-size[0] / 2, size[1] / 2],
    [size[0] / 2, size[1] / 2],
  ];
  return (
    <group position={p}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size[0], 0.12, size[1]]} />
        <meshStandardMaterial color={colour} side={THREE.DoubleSide} />
      </mesh>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.6, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3.2]} />
          <meshStandardMaterial color="#6b6b6b" />
        </mesh>
      ))}
    </group>
  );
}

function Truck() {
  const drum = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (drum.current) drum.current.rotation.x += dt * 1.5;
  });
  return (
    <group position={[48, 0, 8]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 1.6, 3.2]} castShadow>
        <boxGeometry args={[2.5, 2.4, 2.4]} />
        <meshStandardMaterial color="#e9eef2" />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[2.5, 0.6, 8.5]} />
        <meshStandardMaterial color="#444b52" />
      </mesh>
      <mesh ref={drum} position={[0, 2.4, -1]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[1.4, 1.1, 5.2, 16]} />
        <meshStandardMaterial color="#d8822f" />
      </mesh>
    </group>
  );
}

function Sea() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[40, -0.03, 330]}>
      <planeGeometry args={[1200, 300]} />
      <meshStandardMaterial color="#5fa3b6" roughness={0.3} metalness={0.1} />
    </mesh>
  );
}
