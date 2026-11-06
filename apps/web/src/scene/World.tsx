// The surroundings of Saadiyat Tower: a fenced construction plot on Saadiyat Island with a
// second tower going up, a finished residential block across the road, villas, palms, the sea
// and distant cultural-district silhouettes. Static scenery only; nothing here is simulated.

import { useMemo } from 'react';
import { Crane } from './Machinery';
export { Crane } from './Machinery';
import * as THREE from 'three';
import { PALETTE, rand, toScene } from './common';

export const SITE = { minX: -30, maxX: 118, minY: -50, maxY: 108 };

export function World() {
  return (
    <group>
      <Ground />
      <Roads />
      <Sea />
      <Hoarding />
      <SiteOffices />
      <TowerB />
      <ResidentialBlock />
      <Villas />
      <Palms />
      <Skyline />
      <Vehicles />
    </group>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[40, -0.06, 0]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={1} />
      </mesh>
      {/* Compacted site pad inside the hoarding */}
      <mesh rotation-x={-Math.PI / 2} position={toScene((SITE.minX + SITE.maxX) / 2, (SITE.minY + SITE.maxY) / 2, 0)} receiveShadow>
        <planeGeometry args={[SITE.maxX - SITE.minX, SITE.maxY - SITE.minY]} />
        <meshStandardMaterial color={PALETTE.pad} roughness={1} />
      </mesh>
      {/* Haul track from the gate to the tower */}
      <mesh rotation-x={-Math.PI / 2} position={toScene(80, -12, 0.02)} receiveShadow>
        <planeGeometry args={[76, 9]} />
        <meshStandardMaterial color="#a8946f" roughness={1} />
      </mesh>
    </group>
  );
}

function Roads() {
  const dashes = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);
  return (
    <group>
      {/* East road (north–south) and south road (east–west) */}
      <mesh rotation-x={-Math.PI / 2} position={toScene(134, 20, 0.01)} receiveShadow>
        <planeGeometry args={[22, 520]} />
        <meshStandardMaterial color={PALETTE.asphalt} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={toScene(40, -66, 0.012)} receiveShadow>
        <planeGeometry args={[520, 22]} />
        <meshStandardMaterial color={PALETTE.asphalt} roughness={0.95} />
      </mesh>
      {dashes.map((i) => (
        <mesh key={`e${i}`} rotation-x={-Math.PI / 2} position={toScene(134, -230 + i * 13, 0.03)}>
          <planeGeometry args={[0.3, 5]} />
          <meshBasicMaterial color="#e8e1cf" />
        </mesh>
      ))}
      {dashes.map((i) => (
        <mesh key={`s${i}`} rotation-x={-Math.PI / 2} position={toScene(-220 + i * 13, -66, 0.03)}>
          <planeGeometry args={[5, 0.3]} />
          <meshBasicMaterial color="#e8e1cf" />
        </mesh>
      ))}
      {/* Kerbs */}
      <mesh position={toScene(123, 20, 0.12)} receiveShadow>
        <boxGeometry args={[0.6, 0.25, 520]} />
        <meshStandardMaterial color="#d9d4c7" />
      </mesh>
      <mesh position={toScene(40, -55, 0.12)} receiveShadow>
        <boxGeometry args={[520, 0.25, 0.6]} />
        <meshStandardMaterial color="#d9d4c7" />
      </mesh>
    </group>
  );
}

function Sea() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={toScene(0, 520, -0.02)}>
        <planeGeometry args={[2400, 700]} />
        <meshStandardMaterial color={PALETTE.sea} roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={toScene(0, 168, -0.01)}>
        <planeGeometry args={[2400, 26]} />
        <meshStandardMaterial color="#efe2c2" roughness={1} />
      </mesh>
    </group>
  );
}

/** Blue-and-white site hoarding with a gate and guard hut on the east side. */
function Hoarding() {
  const h = 2.6;
  const panels = useMemo(() => {
    const out: { p: THREE.Vector3; w: number; turn: number }[] = [];
    const { minX, maxX, minY, maxY } = SITE;
    for (let x = minX; x < maxX; x += 6) {
      out.push({ p: toScene(x + 3, minY, h / 2), w: 6, turn: 0 });
      out.push({ p: toScene(x + 3, maxY, h / 2), w: 6, turn: 0 });
    }
    for (let y = minY; y < maxY; y += 6) {
      out.push({ p: toScene(minX, y + 3, h / 2), w: 6, turn: Math.PI / 2 });
      if (y + 6 > -26 && y < -8) continue; // gate gap on the east side
      out.push({ p: toScene(maxX, y + 3, h / 2), w: 6, turn: Math.PI / 2 });
    }
    return out;
  }, []);
  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={p.p} rotation-y={p.turn}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[p.w - 0.05, h, 0.08]} />
            <meshStandardMaterial color={PALETTE.hoarding} roughness={0.7} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.35, 0.05]}>
            <boxGeometry args={[p.w - 0.05, 0.5, 0.02]} />
            <meshStandardMaterial color={PALETTE.hoardingBlue} />
          </mesh>
        </group>
      ))}
      {/* Gate posts, boom barrier and guard hut */}
      <mesh position={toScene(SITE.maxX, -8, 1.6)} castShadow>
        <boxGeometry args={[0.5, 3.2, 0.5]} />
        <meshStandardMaterial color="#d6d0c2" />
      </mesh>
      <mesh position={toScene(SITE.maxX, -26, 1.6)} castShadow>
        <boxGeometry args={[0.5, 3.2, 0.5]} />
        <meshStandardMaterial color="#d6d0c2" />
      </mesh>
      <mesh position={toScene(SITE.maxX + 1, -17, 1.1)} rotation-x={Math.PI / 2}>
        <boxGeometry args={[0.15, 16, 0.15]} />
        <meshStandardMaterial color="#e5484d" />
      </mesh>
      <group position={toScene(SITE.maxX + 4, -31, 0)}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[3, 2.8, 3]} />
          <meshStandardMaterial color="#f3f1ec" />
        </mesh>
        <mesh position={[0, 2.9, 0]}>
          <boxGeometry args={[3.6, 0.2, 3.6]} />
          <meshStandardMaterial color="#1f5aa6" />
        </mesh>
      </group>
    </group>
  );
}

function Portacabin({ at, floors = 1, colour = '#f2f1ec', turn = 0 }: { at: THREE.Vector3; floors?: number; colour?: string; turn?: number }) {
  return (
    <group position={at} rotation-y={turn}>
      {Array.from({ length: floors }, (_, i) => (
        <group key={i} position={[0, i * 2.9, 0]}>
          <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[12, 2.8, 3.2]} />
            <meshStandardMaterial color={colour} roughness={0.6} />
          </mesh>
          {[-4, -1.3, 1.3, 4].map((x) => (
            <mesh key={x} position={[x, 1.6, 1.61]}>
              <boxGeometry args={[1.2, 0.9, 0.02]} />
              <meshStandardMaterial color="#4f7690" roughness={0.2} metalness={0.3} />
            </mesh>
          ))}
          <mesh position={[5, 2.2, -1.6]}>
            <boxGeometry args={[1.1, 0.6, 0.5]} />
            <meshStandardMaterial color="#9aa3aa" />
          </mesh>
        </group>
      ))}
      {floors > 1 && (
        <mesh position={[-6.6, 1.5, 0]} rotation-z={0.55} castShadow>
          <boxGeometry args={[0.9, 6.2, 1]} />
          <meshStandardMaterial color="#8d9399" />
        </mesh>
      )}
    </group>
  );
}

/** Site offices (two-storey), welfare cabins and portable toilets near the gate. */
function SiteOffices() {
  const toilets = [0, 1, 2, 3];
  return (
    <group>
      <Portacabin at={toScene(78, 52)} floors={2} />
      <Portacabin at={toScene(78, 68)} floors={2} colour="#ecebe5" />
      <group position={toScene(80, 61, 6)}>
        <mesh>
          <boxGeometry args={[6, 1.2, 0.1]} />
          <meshStandardMaterial color="#1f5aa6" />
        </mesh>
      </group>
      {toilets.map((i) => (
        <mesh key={i} position={toScene(110, 10 + i * 1.6, 1.2)} castShadow>
          <boxGeometry args={[1.3, 2.4, 1.3]} />
          <meshStandardMaterial color="#2f6fbf" />
        </mesh>
      ))}
    </group>
  );
}

/** Phase 2 tower next door, at level 6 with formwork and its own crane. */
function TowerB() {
  const levels = 6;
  const centre = toScene(20, 86);
  return (
    <group>
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={i} position={[centre.x, i * 3.5 + 0.2, centre.z]} castShadow receiveShadow>
          <boxGeometry args={[34, 0.45, 26]} />
          <meshStandardMaterial color={PALETTE.concrete} roughness={0.9} />
        </mesh>
      ))}
      {[-15, -6, 3, 12].flatMap((x) =>
        [-11, 0, 11].map((z) => (
          <mesh key={`${x}${z}`} position={[centre.x + x, (levels * 3.5) / 2, centre.z + z]} castShadow>
            <boxGeometry args={[0.7, levels * 3.5, 0.7]} />
            <meshStandardMaterial color={PALETTE.concreteDark} />
          </mesh>
        )),
      )}
      <mesh position={[centre.x - 9, levels * 3.5 + 4, centre.z]} castShadow>
        <boxGeometry args={[7, 8, 7]} />
        <meshStandardMaterial color={PALETTE.concreteDark} />
      </mesh>
      {/* Plywood formwork and props on the top deck */}
      <mesh position={[centre.x + 6, levels * 3.5 + 1.6, centre.z]} castShadow>
        <boxGeometry args={[18, 0.2, 20]} />
        <meshStandardMaterial color="#c9874a" />
      </mesh>
      <Crane at={toScene(-6, 92)} height={44} jib={46} turn={-0.6} />
    </group>
  );
}

/** Completed residential block across the west road: glass, balconies and a podium. */
function ResidentialBlock() {
  const floors = 18;
  const p = toScene(-78, 20);
  return (
    <group position={p}>
      <mesh position={[0, 4, 0]} castShadow receiveShadow>
        <boxGeometry args={[44, 8, 54]} />
        <meshStandardMaterial color="#e7dfd0" />
      </mesh>
      <mesh position={[0, 8 + (floors * 3.3) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[26, floors * 3.3, 34]} />
        <meshStandardMaterial color={PALETTE.glass} roughness={0.15} metalness={0.4} />
      </mesh>
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} position={[13.4, 8 + i * 3.3 + 0.2, 0]} castShadow>
          <boxGeometry args={[1.6, 0.25, 34]} />
          <meshStandardMaterial color="#f1ece2" />
        </mesh>
      ))}
      <mesh position={[0, 8 + floors * 3.3 + 1.2, 0]}>
        <boxGeometry args={[27, 2.4, 35]} />
        <meshStandardMaterial color="#f1ece2" />
      </mesh>
    </group>
  );
}

function Villas() {
  const villas = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ x: -110 + i * 34, y: -100 - (i % 2) * 10, turn: rand(i) * 0.2 })), []);
  return (
    <group>
      {villas.map((v, i) => (
        <group key={i} position={toScene(v.x, v.y)} rotation-y={v.turn}>
          <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[16, 6.4, 12]} />
            <meshStandardMaterial color="#f4efe4" />
          </mesh>
          <mesh position={[3, 7.6, 0]} castShadow>
            <boxGeometry args={[9, 2.4, 10]} />
            <meshStandardMaterial color="#efe8da" />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 10]}>
            <planeGeometry args={[14, 6]} />
            <meshStandardMaterial color="#5fb3c4" roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Palm({ at, height = 9, seed = 0 }: { at: THREE.Vector3; height?: number; seed?: number }) {
  const lean = (rand(seed) - 0.5) * 0.12;
  const fronds = Array.from({ length: 8 }, (_, i) => i);
  return (
    <group position={at} rotation-z={lean}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, height, 7]} />
        <meshStandardMaterial color="#8b7351" roughness={1} />
      </mesh>
      {fronds.map((i) => (
        <mesh key={i} position={[0, height, 0]} rotation={[0.9, (i / fronds.length) * Math.PI * 2 + seed, 0]} castShadow>
          <boxGeometry args={[0.5, 0.06, 4.2]} />
          <meshStandardMaterial color={i % 2 ? '#4f7a3a' : '#5d8a44'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Palms() {
  const spots = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let y = -180; y <= 220; y += 16) out.push(toScene(147, y), toScene(121, y + 8));
    for (let x = -200; x <= 240; x += 16) if (x < SITE.minX - 4 || x > SITE.maxX + 8) out.push(toScene(x, -78));
    for (let x = -200; x <= 240; x += 18) out.push(toScene(x + 6, -53));
    return out.filter((p) => !(p.x > SITE.minX - 2 && p.x < SITE.maxX + 3 && -p.z > SITE.minY - 2 && -p.z < SITE.maxY + 2));
  }, []);
  return (
    <group>
      {spots.map((p, i) => (
        <Palm key={i} at={p} height={8 + rand(i) * 3} seed={i} />
      ))}
    </group>
  );
}

/** Low, hazy silhouettes far away so the island doesn't end at the hoarding. */
function Skyline() {
  const towers = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        x: -900 + i * 70 + rand(i) * 30,
        y: -620 - rand(i + 50) * 160,
        h: 40 + rand(i + 9) * 150,
        w: 18 + rand(i + 3) * 22,
      })),
    [],
  );
  return (
    <group>
      {towers.map((t, i) => (
        <mesh key={i} position={toScene(t.x, t.y, t.h / 2)}>
          <boxGeometry args={[t.w, t.h, t.w]} />
          <meshStandardMaterial color="#c8cfd4" roughness={1} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* A low museum dome on the cultural district's shoreline to the west */}
      <mesh position={toScene(-520, 230, 0)} scale={[1, 0.28, 1]}>
        <sphereGeometry args={[90, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d7dade" roughness={0.8} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Vehicles() {
  const pickups = useMemo(() => Array.from({ length: 6 }, (_, i) => toScene(94 + (i % 3) * 5.5, 44 + Math.floor(i / 3) * 9)), []);
  return (
    <group>
      {pickups.map((p, i) => (
        <group key={i} position={p} rotation-y={Math.PI / 2}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[2, 1, 5.2]} />
            <meshStandardMaterial color={i % 2 ? '#f4f4f2' : '#dfe2e4'} />
          </mesh>
          <mesh position={[0, 1.65, 0.6]} castShadow>
            <boxGeometry args={[1.9, 0.8, 2.2]} />
            <meshStandardMaterial color="#e9ecee" />
          </mesh>
        </group>
      ))}
      {/* Labour bus waiting on the south road */}
      <group position={toScene(62, -62)} rotation-y={0}>
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[11, 2.8, 2.6]} />
          <meshStandardMaterial color="#f2f0ea" />
        </mesh>
        <mesh position={[0, 2.1, 1.31]}>
          <boxGeometry args={[9.5, 0.9, 0.02]} />
          <meshStandardMaterial color="#3b5568" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.9, 1.31]}>
          <boxGeometry args={[11, 0.35, 0.02]} />
          <meshStandardMaterial color="#e3a72f" />
        </mesh>
      </group>
    </group>
  );
}
