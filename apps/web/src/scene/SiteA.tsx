import { Truck } from './Truck';
// Saadiyat Tower (the simulated site): the frame at level 12 with its core, edge protection,
// netting, glazing on the lower floors, hoist, formwork on the deck and the pour; plus the
// rebar shed, materials, welfare facilities and the concrete pump during the pour.

import { CrewLift } from './crewTransit';
import { PlaygroundContext } from './explorationState';
import { rect } from './worksiteRoutes';
import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Plan, Scenario, Zone } from '@heatline/contracts';
import { PALETTE, rand, toScene } from './common';
import { Crane, Hoist } from './Machinery';

const STOREY = 3.5;

export function SiteA({ scenario, minute, plan, pourProgress, pourActive, truckOnSite, truckLeaves }: { scenario: Scenario; minute: number; plan: Plan | null; pourProgress: number; pourActive: boolean; truckOnSite: boolean; truckLeaves: number }) {
  const zones = useMemo(() => new Map(scenario.zones.map((z) => [z.id, z])), [scenario]);
  const tentsUp = (plan?.tents ?? []).filter((t) => t.readyAt <= minute);
  return (
    <group>
      <Tower scenario={scenario} pourProgress={pourProgress} />
      <Scaffold />
      {[2,3,4,5].map(f=><mesh key={f} position={[-1.1,f*STOREY+.14,-10.05]}><boxGeometry args={[2.3,.15,1.4]}/><meshStandardMaterial color="#99876a"/></mesh>)}
      <Hoist />
      <Crane operable at={toScene(50, 34)} height={62} jib={58} turn={2.6} />
      <RebarYard yard={zones.get('yard')!} />
      <Materials />
      <Shelter at={zones.get('shelter')!} />
      <Cabin at={zones.get('cabin')!} label="Rest cabin" />
      <Cabin at={zones.get('store')!} label="Tool store" />
      <Cabin at={zones.get('first-aid')!} label="First aid" cross />
      {tentsUp.map((t) => {
        const z = zones.get(t.zone)!;
        return <Tent key={t.zone} at={z} />;
      })}
      {truckOnSite && <PourSet active={pourActive} deckHeight={scenario.tower.height} />}
      <Mixer minute={minute} arrives={scenario.pour.truckArrives} leaves={truckLeaves} pump={truckOnSite} />
    </group>
  );
}

function Tower({ scenario, pourProgress }: { scenario: Scenario; pourProgress: number }) {
  const t = scenario.tower;
  const w = t.maxX - t.minX;
  const d = t.maxY - t.minY;
  const levels = Math.round(t.height / STOREY);
  const c = toScene((t.minX + t.maxX) / 2, (t.minY + t.maxY) / 2);
  const columns = useMemo(() => {
    const pts: [number, number][] = [];
    for (let x = t.minX + 1; x <= t.maxX - 1; x += 7.6) for (let y = t.minY + 1; y <= t.maxY - 1; y += 7) pts.push([x, y]);
    return pts;
  }, [t]);
  const props = useMemo(() => Array.from({ length: 60 }, (_, i) => [t.minX + 2 + (i % 10) * 3.9, t.minY + 2 + Math.floor(i / 10) * 4.8] as const), [t]);
  return (
    <group>
      {/* Slabs */}
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={i} position={[c.x, i * STOREY + 0.2, c.z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.4, d]} />
          <meshStandardMaterial color={PALETTE.concrete} roughness={0.92} />
        </mesh>
      ))}
      {/* Columns, one storey at a time so the frame reads as a building */}
      {columns.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[x, t.height / 2, -y]} castShadow>
          <boxGeometry args={[0.8, t.height, 0.8]} />
          <meshStandardMaterial color={PALETTE.concreteDark} roughness={0.9} />
        </mesh>
      ))}
      {/* Lift and stair core, poured ahead of the floors */}
      <mesh position={[c.x - 6, (t.height + 7) / 2, c.z + 2]} castShadow receiveShadow>
        <boxGeometry args={[9, t.height + 7, 8]} />
        <meshStandardMaterial color="#c4bdb0" roughness={0.95} />
      </mesh>
      {/* Curtain wall on the lowest floors (the finished part of the building) */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh position={[c.x, i * STOREY + 1.95, c.z + d / 2 + 0.05]}>
            <boxGeometry args={[w, STOREY - 0.5, 0.08]} />
            <meshStandardMaterial color={PALETTE.glass} roughness={0.12} metalness={0.5} />
          </mesh>
          {[[-30,-11.1],[-9.05,0]].map(([lo,hi])=>(
            <mesh key={lo} position={[t.maxX+.05,i*STOREY+1.95,(lo!+hi!)/2]}>
              <boxGeometry args={[.08,STOREY-.5,hi!-lo!]} />
              <meshStandardMaterial color={PALETTE.glass} roughness={.12} metalness={.5}/>
            </mesh>
          ))}
        </group>
      ))}
      {/* Block walls going in on floors 4–7 */}
      {[4, 5, 6, 7].map((i) => (
        <mesh key={i} position={[c.x + 6, i * STOREY + 1.6, c.z + d / 2 - 0.3]} castShadow>
          <boxGeometry args={[w * (0.9 - (i - 4) * 0.18), STOREY - 0.6, 0.25]} />
          <meshStandardMaterial color="#e2dccf" roughness={1} />
        </mesh>
      ))}
      {/* Green safety netting on the top three floors, yellow-black edge barriers at the deck */}
      {[levels - 3, levels - 2, levels - 1].map((i) => (
        <group key={i}>
          <mesh position={[c.x, i * STOREY + 1.9, c.z + d / 2 + 0.6]}>
            <boxGeometry args={[w + 1, STOREY, 0.05]} />
            <meshStandardMaterial color="#2e7d4f" transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[t.maxX + 0.6, i * STOREY + 1.9, c.z]}>
            <boxGeometry args={[0.05, STOREY, d + 1]} />
            <meshStandardMaterial color="#2e7d4f" transparent opacity={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <EdgeBarrier w={w} d={d} y={t.height + 0.9} centre={c} />
      {/* Formwork props under the deck being poured */}
      {props.map(([x, y], i) => (
        <mesh key={i} position={[x, t.height - STOREY / 2, -y]}>
          <cylinderGeometry args={[0.05, 0.05, STOREY - 0.4, 5]} />
          <meshStandardMaterial color={i % 3 ? '#d9822b' : '#b8b8b8'} metalness={0.4} />
        </mesh>
      ))}
      {/* Fresh concrete spreading across the deck over the rebar mat */}
      {pourProgress > 0 && (
        <mesh position={[t.minX + (w * pourProgress) / 2, t.height + 0.46, c.z]} receiveShadow>
          <boxGeometry args={[w * pourProgress, 0.14, d - 0.6]} />
          <meshStandardMaterial color="#8e8b85" roughness={0.45} />
        </mesh>
      )}
      {pourProgress < 1 && <RebarMat x0={t.minX + w * pourProgress} x1={t.maxX} y0={t.minY} y1={t.maxY} h={t.height + 0.45} />}
    </group>
  );
}

function EdgeBarrier({ w, d, y, centre }: { w: number; d: number; y: number; centre: THREE.Vector3 }) {
  const segments = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    const n = Math.floor(w / 2.5);
    for (let i = 0; i < n; i++) {
      const x = centre.x - w / 2 + 1.25 + i * 2.5;
      out.push({ p: [x, y, centre.z + d / 2], s: [2.4, 0.12, 0.08], c: i % 2 ? '#1b1b1b' : '#f2c21b' });
      out.push({ p: [x, y, centre.z - d / 2], s: [2.4, 0.12, 0.08], c: i % 2 ? '#f2c21b' : '#1b1b1b' });
    }
    const m = Math.floor(d / 2.5);
    for (let i = 0; i < m; i++) {
      const z = centre.z - d / 2 + 1.25 + i * 2.5;
      if (Math.abs(z+10.05)>1.8) out.push({ p: [centre.x + w / 2, y, z], s: [0.08, 0.12, 2.4], c: i % 2 ? '#1b1b1b' : '#f2c21b' });
      out.push({ p: [centre.x - w / 2, y, z], s: [0.08, 0.12, 2.4], c: i % 2 ? '#f2c21b' : '#1b1b1b' });
    }
    return out;
  }, [w, d, y, centre]);
  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} position={s.p}>
          <boxGeometry args={s.s} />
          <meshStandardMaterial color={s.c} />
        </mesh>
      ))}
    </group>
  );
}

function RebarMat({ x0, x1, y0, y1, h }: { x0: number; x1: number; y0: number; y1: number; h: number }) {
  const bars = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (let x = Math.ceil(x0); x < x1; x += 1.5) out.push({ p: [x, h, -(y0 + y1) / 2], s: [0.05, 0.05, y1 - y0 - 1] });
    for (let y = y0 + 1; y < y1; y += 1.5) out.push({ p: [(x0 + x1) / 2, h + 0.05, -y], s: [x1 - x0, 0.05, 0.05] });
    return out;
  }, [x0, x1, y0, y1, h]);
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, h - 0.06, -(y0 + y1) / 2]} receiveShadow>
        <boxGeometry args={[x1 - x0, 0.04, y1 - y0 - 0.6]} />
        <meshStandardMaterial color="#c98a4c" roughness={0.9} />
      </mesh>
      {bars.map((b, i) => (
        <mesh key={i} position={b.p}>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={PALETTE.rebar} metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Tube-and-fitting scaffold on the west façade with boards every two storeys. */
function Scaffold() {
  const parts = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
    for (let y = 0; y <= 30; y += 2.5) {
      out.push({ p: [-2.2, 15, -y], s: [0.07, 30, 0.07], c: '#a7adb2' });
      out.push({ p: [-4, 15, -y], s: [0.07, 30, 0.07], c: '#a7adb2' });
    }
    for (let h = 1.5; h <= 30; h += 2) {
      out.push({ p: [-2.2, h, -15], s: [0.06, 0.06, 30], c: '#a7adb2' });
      out.push({ p: [-4, h + 1, -15], s: [0.06, 0.06, 30], c: '#a7adb2' });
    }
    for (let h = 0; h <= 28; h += 3.5) out.push({ p: [-3.1, h + 0.1, -15], s: [1.9, 0.08, 30], c: '#c08a3e' });
    return out;
  }, []);
  return (
    <group>
      {parts.map((b, i) => (
        <mesh key={i} position={b.p} castShadow={i % 3 === 0}>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Rack-and-pinion material hoist on the east face, the cage riding up and down. */

function RebarYard({ yard }: { yard: Zone }) {
  const bundles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ p: toScene(yard.at.x - 12 + (i % 5) * 6, yard.at.y - 9 + Math.floor(i / 5) * 18, 0.35), turn: (rand(i) - 0.5) * 0.15 })), [yard]);
  return (
    <group>
      {bundles.map((b, i) => (
        <group key={i} position={b.p} rotation-y={b.turn}>
          {/* A bundle of bars on two timber bearers */}
          {Array.from({ length: 12 }, (_, k) => (
            <mesh key={k} position={[(k % 4) * 0.13 - 0.2, -0.05 + Math.floor(k / 4) * 0.12, 0]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 11, 5]} />
              <meshStandardMaterial color={PALETTE.rebar} roughness={0.7} metalness={0.45} />
            </mesh>
          ))}
          {[-3.5, 3.5].map((z) => (
            <mesh key={z} position={[0, -0.22, z]} castShadow>
              <boxGeometry args={[1.2, 0.18, 0.2]} />
              <meshStandardMaterial color="#8b6a44" />
            </mesh>
          ))}
        </group>
      ))}
      {/* Bending shed: steel roof on posts with a bending table */}
      <group position={toScene(yard.at.x + 14, yard.at.y + 2)}>
        <mesh position={[0, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 0.15, 7]} />
          <meshStandardMaterial color="#b9bec2" metalness={0.5} roughness={0.5} />
        </mesh>
        {[-4.8, 4.8].flatMap((x) =>
          [-3.3, 3.3].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 2, z]} castShadow>
              <boxGeometry args={[0.15, 4, 0.15]} />
              <meshStandardMaterial color="#6d737a" />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[5, 1, 1.6]} />
          <meshStandardMaterial color="#3b6ea5" />
        </mesh>
      </group>
    </group>
  );
}

function Materials() {
  const pallets = useMemo(() => Array.from({ length: 12 }, (_, i) => toScene(52 + (i % 4) * 3.2, 30 + Math.floor(i / 4) * 3.2, 0.6)), []);
  const ply = useMemo(() => Array.from({ length: 4 }, (_, i) => toScene(64 + i * 4, -36, 0.5)), []);
  return (
    <group>
      {pallets.map((p, i) => (
        <mesh key={i} position={p} castShadow receiveShadow>
          <boxGeometry args={[2.4, 1.2, 2.4]} />
          <meshStandardMaterial color={i % 2 ? '#d7d1c4' : '#cfc8b9'} roughness={1} />
        </mesh>
      ))}
      {ply.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[2.6, 1, 1.4]} />
          <meshStandardMaterial color="#c9874a" />
        </mesh>
      ))}
      {/* Generator and water tank */}
      <mesh position={toScene(104, 26, 1.2)} castShadow>
        <boxGeometry args={[5, 2.4, 2.2]} />
        <meshStandardMaterial color="#2f6b46" />
      </mesh>
      <mesh position={toScene(104, 34, 2)} castShadow>
        <cylinderGeometry args={[1.8, 1.8, 4, 16]} />
        <meshStandardMaterial color="#e8e6e0" />
      </mesh>
    </group>
  );
}

/** The permanent rest shade: canopy, benches, fans and orange water coolers. */
function Shelter({ at }: { at: Zone }) {
  const p = toScene(at.at.x, at.at.y);
  return (
    <group position={p}>
      <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[16, 0.15, 10]} />
        <meshStandardMaterial color="#e9e4d4" />
      </mesh>
      {[-7.8, 0, 7.8].flatMap((x) =>
        [-4.8, 4.8].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.7, z]} castShadow>
            <boxGeometry args={[0.18, 3.4, 0.18]} />
            <meshStandardMaterial color="#7b8086" />
          </mesh>
        )),
      )}
      {[-3, 0, 3].map((z) => (
        <mesh key={z} position={[0, 0.45, z]} castShadow>
          <boxGeometry args={[12, 0.1, 0.6]} />
          <meshStandardMaterial color="#8a6b4a" />
        </mesh>
      ))}
      <Fan at={[-5, 0, -4]} />
      <Fan at={[5, 0, -4]} />
      <Cooler at={[7, 0, 3.5]} />
      <Cooler at={[6, 0, 3.5]} />
    </group>
  );
}

function Fan({ at }: { at: [number, number, number] }) {
  const blades = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 12;
  });
  return (
    <group position={at}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh ref={blades} position={[0, 1.8, 0.1]}>
        <circleGeometry args={[0.45, 3]} />
        <meshStandardMaterial color="#d5d9dc" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Cooler({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.5, 12]} />
        <meshStandardMaterial color="#e9762b" />
      </mesh>
      <mesh position={[0, 0.79, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.08, 12]} />
        <meshStandardMaterial color="#f4f1ea" />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.6, 0.25, 0.6]} />
        <meshStandardMaterial color="#6b6f74" />
      </mesh>
    </group>
  );
}

function Cabin({ at, label, cross }: { at: Zone; label: string; cross?: boolean }) {
  const p = toScene(at.at.x, at.at.y);
  return (
    <group position={p} name={label}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 2.8, 4]} />
        <meshStandardMaterial color="#f1f0eb" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[12.4, 0.15, 4.4]} />
        <meshStandardMaterial color="#c9cdd0" />
      </mesh>
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 1.6, 2.01]}>
          <boxGeometry args={[1.4, 0.9, 0.02]} />
          <meshStandardMaterial color="#4f7690" roughness={0.2} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[5.2, 2.35, -2.1]}>
        <boxGeometry args={[1.2, 0.7, 0.5]} />
        <meshStandardMaterial color="#9aa3aa" />
      </mesh>
      {cross && (
        <group position={[0, 2.2, 2.03]}>
          <mesh>
            <boxGeometry args={[1.6, 0.45, 0.02]} />
            <meshStandardMaterial color="#d93a3a" />
          </mesh>
          <mesh>
            <boxGeometry args={[0.45, 1.6, 0.02]} />
            <meshStandardMaterial color="#d93a3a" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Pop-up shade tent placed by an approved plan. */
function Tent({ at }: { at: Zone }) {
  const p = toScene(at.at.x, at.at.y, at.kind === 'elevated' ? at.height + 0.4 : 0);
  return (
    <group position={p}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <coneGeometry args={[7.6, 1.2, 4, 1, true]} />
        <meshStandardMaterial color="#f6f3ea" side={THREE.DoubleSide} />
      </mesh>
      {[-5, 5].flatMap((x) =>
        [-5, 5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.25, z]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.5]} />
            <meshStandardMaterial color="#666" />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Concrete mixer and boom pump at the tower during the pour. */
/** The mixer drives in from the east road, through the gate, to the pump, and leaves after the pour. */
const mixerRoad = new THREE.CurvePath<THREE.Vector3>();
mixerRoad.add(new THREE.LineCurve3(toScene(130, -220), toScene(130, -27)));
mixerRoad.add(new THREE.QuadraticBezierCurve3(toScene(130, -27), toScene(130, -17), toScene(120, -17)));
mixerRoad.add(new THREE.LineCurve3(toScene(120, -17), toScene(80, -14)));
mixerRoad.add(new THREE.LineCurve3(toScene(80, -14), toScene(58, -14)));
const DRIVE_MIN = 6;

function Mixer({ minute, arrives, leaves, pump }: { minute: number; arrives: number; leaves: number; pump:boolean }) {
  const truck = useRef<THREE.Group>(null);
  const controlled=useContext(PlaygroundContext);
  const crew=useContext(CrewLift);
  const space=controlled ?? crew;
  const progress = useRef<number | null>(null);
  const visible = minute >= arrives - DRIVE_MIN && minute <= leaves + DRIVE_MIN;
  // Route progress: 0 → 1 driving in, 1 while parked, 1 → 0 driving out.
  const t = minute < arrives ? (minute - (arrives - DRIVE_MIN)) / DRIVE_MIN : minute <= leaves ? 1 : 1 - (minute - leaves) / DRIVE_MIN;
  useFrame((_, dt) => {
    const vehicle = truck.current;
    if (space) space.groundEquipment.length=0;
    if (space && pump) space.groundEquipment.push(rect(50,-2,5.4,9));
    if (!vehicle) { progress.current = null; return; }
    const previous = progress.current;
    const current = previous === null || Math.abs(previous - t) > .3
      ? t : THREE.MathUtils.damp(previous, t, 2, dt);
    progress.current = current;
    vehicle.position.copy(mixerRoad.getPoint(current));
    const direction = mixerRoad.getTangent(current);
    vehicle.rotation.y = Math.atan2(direction.x, direction.z) + (minute > leaves ? Math.PI : 0);
    if(space) {
      const x=Math.abs(direction.x), z=Math.abs(direction.z);
      space.groundEquipment.push(rect(vehicle.position.x,vehicle.position.z,10*x+2.8*z,10*z+2.8*x));
    }
  });
  if (!visible) return null;
  return (
    <group ref={truck}>
      <Truck body="mixer" />
    </group>
  );
}

function PourSet({ active, deckHeight }: { active: boolean; deckHeight: number }) {
  const reach = 27; // horizontal reach from the pump to the middle of the deck
  const boomLength = Math.hypot(reach, deckHeight + 1);
  const boomAngle = Math.atan2(deckHeight + 1, reach);
  return (
    <group>
      {/* Boom pump with its arm reaching the deck */}
      <group position={toScene(50, 2)}>
        <Truck body="pump" />
        <mesh position={[0,2.15,0]} castShadow><cylinderGeometry args={[.83,1.02,1,16]}/><meshStandardMaterial color="#bd8e43"/></mesh>
        <group position={[0, 3, 0]} rotation-z={-boomAngle}>
          <mesh position={[-boomLength / 2, 0, 0]} castShadow>
            <boxGeometry args={[boomLength, 0.7, 0.7]} />
            <meshStandardMaterial color="#e2a62c" />
          </mesh>
        </group>
        {active && (
          <mesh position={[-reach, deckHeight + 2.5, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 3, 8]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        )}
      </group>
    </group>
  );
}
