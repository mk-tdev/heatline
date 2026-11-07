// The 3D scene: the district, Saadiyat Tower, its people and the light of a real afternoon.
// Engine coordinates are metres with x east and y north; see common.ts for the mapping.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MinuteRecord, Plan, Scenario, Zone } from '@heatline/contracts';
import { heatZone } from '@heatline/rules';
import { LabelProjector, anchors } from './labels';
import { World } from './World';
import { Life } from './Life';
import { SiteA } from './SiteA';
import { Person, lookFor, poseFor } from './Person';
import { CameraRig, type CameraView } from './CameraRig';
import { toScene } from './common';
import { CrewHoist, CrewLift } from './crewTransit';
import { WorksiteExplore } from './WorksiteExplore';
import type { Line } from '../dialogue';

export const CREW_COLOURS: Record<string, string> = { A: '#4c9be8', B: '#f08a24', C: '#2fb39a' };
const ZONE_CHIP: Record<string, string> = { unrestricted: '#3aa76d', low: '#b8c43a', medium: '#e8a33d', high: '#e5484d' };

export interface SiteProps {
  scenario: Scenario;
  record: MinuteRecord;
  plan: Plan | null;
  pourProgress: number;
  pourActive: boolean;
  truckOnSite: boolean;
  truckLeaves: number;
  dust: boolean;
  selectedWorker: string;
  redFlagWorkers: string[];
  view: CameraView;
  viewRevision: number;
  showLabels: boolean;
  speech?: Line[];
}

const labelPoint = (zone: Zone) => (zone.id === 'facade' ? toScene(zone.at.x - 7, zone.at.y, 31) : zone.id === 'deck' ? toScene(zone.at.x, zone.at.y, zone.height + 9) : toScene(zone.at.x, zone.at.y, zone.height + 7));

export function Site(props: SiteProps) {
  const [playground, setPlayground] = useState<SiteProps | null>(null);
  const labelled = useMemo(() => props.scenario.zones.filter((z) => z.kind === 'outdoor' || z.kind === 'elevated'), [props.scenario]);
  useEffect(() => {
    for (const z of labelled) anchors.set(`z-${z.id}`, { point: labelPoint(z), lift: 0 });
    return () => labelled.forEach((z) => anchors.delete(`z-${z.id}`));
  }, [labelled]);
  return (
    <>
      <Canvas frameloop={playground ? 'never' : 'always'} shadows camera={{ position: [260, 120, 260], fov: 38, near: 1, far: 4000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <SceneContents {...props} />
        <LabelProjector />
        <CameraRig view={props.view} revision={props.viewRevision} />
      </Canvas>
      <button className="explore-entry" onClick={() => setPlayground(structuredClone(props))}>Explore on foot <span>Walk · lift · crane</span></button>
      {playground && <WorksiteExplore onClose={() => setPlayground(null)}><SceneContents {...playground} sandbox /></WorksiteExplore>}
      <div className="labels" style={{ visibility: props.showLabels ? 'visible' : 'hidden' }}>
        {labelled.map((z) => {
          const c = props.record.zones.find((x) => x.zone === z.id)!;
          const hz = heatZone(c.wbgt);
          return (
            <div key={z.id} id={`lbl-z-${z.id}`} className="zone-label">
              <span className="zone-dot" style={{ background: ZONE_CHIP[hz] }} />
              <strong>{z.label}</strong>
              <span>
                Est. WBGT {c.wbgt.toFixed(1)}°C · {hz} risk
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
        {(props.speech ?? []).map((l) => {
          const who = props.scenario.workers.find((w) => w.id === l.speaker);
          return (
            <div key={l.id} id={`lbl-say-${l.speaker}`} className="say" style={{ display: 'none' }}>
              <div className="say-bubble">
                <div className="say-native" dir="auto" lang={l.language}>
                  {l.native}
                </div>
                {l.language !== 'en' && <div className="say-english">{l.english}</div>}
                <div className="say-who">{who?.name ?? l.speaker}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SceneContents({ scenario, record, plan, pourProgress, pourActive, truckOnSite, truckLeaves, dust, selectedWorker, redFlagWorkers, sandbox = false }: SiteProps & { sandbox?: boolean }) {
  const lift = useMemo(() => new CrewHoist(), []);
  useFrame((_,dt) => { if(!sandbox) lift.tick(Math.min(dt,.1)); }, -2);
  const env = record.env;
  const sunDir = useMemo(() => {
    const az = (env.sunAzimuth * Math.PI) / 180;
    const el = (Math.max(env.sunElevation, 3) * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  }, [env.sunAzimuth, env.sunElevation]);
  const warmth = THREE.MathUtils.clamp(1 - env.sunElevation / 55, 0, 1);
  const sunColour = useMemo(() => new THREE.Color().lerpColors(new THREE.Color('#fff2dc'), new THREE.Color('#ffb066'), warmth), [warmth]);
  const sky = useMemo(() => {
    const base = new THREE.Color().lerpColors(new THREE.Color('#bdd5e6'), new THREE.Color('#f0c28e'), warmth * 0.75);
    return dust ? base.lerp(new THREE.Color('#d6b98a'), 0.7) : base;
  }, [warmth, dust]);
  const zones = useMemo(() => new Map(scenario.zones.map((z) => [z.id, z])), [scenario]);

  const spots = useMemo(() => layoutPeople(scenario, record, zones), [scenario, record, zones]);
  // In the last minutes of the shift everyone walks to the labour bus (except anyone in first aid).
  const homeTime = record.minute >= scenario.end - 6;

  return (
    <CrewLift.Provider value={sandbox ? null : lift}>
      <color attach="background" args={[sky.getStyle()]} />
      <DustFog colour={sky} dust={dust} />
      <hemisphereLight args={['#fff1dc', '#b8925c', dust ? 0.75 : 0.55]} />
      <SunLight direction={sunDir} colour={sunColour} intensity={dust ? 1.1 : 2.7} />
      <World />
      <Life />
      <SiteA scenario={scenario} minute={record.minute} plan={plan} pourProgress={pourProgress} pourActive={pourActive} truckOnSite={truckOnSite} truckLeaves={truckLeaves} />
      {scenario.workers.map((w, i) => {
        const t = record.truth.find((x) => x.worker === w.id)!;
        const role = w.id === 'ahmed' ? 'foreman' : w.id === 'suresh' ? 'lead' : 'worker';
        const atBus = homeTime && t.zone !== 'first-aid';
        const spot = atBus ? { at: toScene(54 + (i % 10) * 0.9, -56 - Math.floor(i / 10) * 1.1), facing: Math.PI } : spots.get(w.id)!;
        return (
          <Person
            key={w.id}
            slot={i}
            anchor={!sandbox}
            id={w.id}
            target={spot.at}
            facing={spot.facing}
            look={lookFor(w.id, i, role, w.crew)}
            pose={atBus ? 'stand' : poseFor(t.activity, t.zone)}
            selected={w.id === selectedWorker}
            redFlag={redFlagWorkers.includes(w.id)}
            crewColour={CREW_COLOURS[w.crew] ?? '#888'}
          />
        );
      })}
    </CrewLift.Provider>
  );
}

/** The crew frozen at one minute of the shift, for the walk-around playground (no lift, no labels). */
export function StaticCrew({ scenario, record }: { scenario: Scenario; record: MinuteRecord }) {
  const spots = useMemo(() => layoutPeople(scenario, record, new Map(scenario.zones.map((z) => [z.id, z]))), [scenario, record]);
  return (
    <>
      {scenario.workers.map((w, i) => {
        const t = record.truth.find((x) => x.worker === w.id)!;
        const spot = spots.get(w.id)!;
        const role = w.id === 'ahmed' ? 'foreman' : w.id === 'suresh' ? 'lead' : 'worker';
        return <Person key={w.id} id={w.id} slot={i} anchor={false} target={spot.at} facing={spot.facing} look={lookFor(w.id, i, role, w.crew)} pose={poseFor(t.activity, t.zone)} crewColour={CREW_COLOURS[w.crew] ?? '#888'} />;
      })}
    </>
  );
}

function DustFog({ colour, dust }: { colour: THREE.Color; dust: boolean }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!scene.fog) scene.fog = new THREE.Fog(colour, 420, 1700);
  }, [scene, colour]);
  useFrame((_, dt) => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const near = dust ? 40 : 420;
    const far = dust ? 320 : 1700;
    fog.near += (near - fog.near) * Math.min(1, dt);
    fog.far += (far - fog.far) * Math.min(1, dt);
    fog.color.lerp(colour, Math.min(1, dt));
  });
  return null;
}

function SunLight({ direction, colour, intensity }: { direction: THREE.Vector3; colour: THREE.Color; intensity: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(45, 0, -15);
    return o;
  }, []);
  useFrame(() => {
    if (!light.current) return;
    light.current.position.copy(target.position).addScaledVector(direction, 300);
    light.current.target = target;
    light.current.intensity += (intensity - light.current.intensity) * 0.05;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        color={colour}
        intensity={intensity}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={10}
        shadow-camera-far={700}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />
    </>
  );
}

/** Where each person stands, sits or lies this minute, given their zone and what they are doing. */
function layoutPeople(scenario: Scenario, record: MinuteRecord, zones: Map<string, Zone>) {
  const out = new Map<string, { at: THREE.Vector3; facing: number }>();
  const byZone = new Map<string, string[]>();
  for (const t of record.truth) byZone.set(t.zone, [...(byZone.get(t.zone) ?? []), t.worker]);
  const t = scenario.tower;
  for (const [zoneId, ids] of byZone) {
    const zone = zones.get(zoneId)!;
    ids.forEach((id, i) => {
      let at: THREE.Vector3;
      let facing = 0;
      switch (zoneId) {
        case 'deck': {
          const cols = 5;
          at = toScene(t.minX + 6 + (i % cols) * 7, t.minY + 5 + Math.floor(i / cols) * 14, t.height + 0.55);
          facing = (i % 3) * 1.4;
          break;
        }
        case 'facade': {
          const boards = [7, 10.5, 14, 17.5];
          at = toScene(-3.1, 4 + (i % 6) * 4.4, boards[i % boards.length]! + 0.1);
          facing = Math.PI / 2;
          break;
        }
        case 'yard': {
          at = toScene(zone.at.x - 12 + (i % 5) * 6 + 1.2, zone.at.y - 9 + Math.floor(i / 5) * 18 + ((i % 2) - 0.5) * 2.4);
          facing = i % 2 ? Math.PI / 2 : -Math.PI / 2;
          break;
        }
        case 'shelter': {
          const row = [-3, 0, 3][i % 3]!;
          at = toScene(zone.at.x - 5 + Math.floor(i / 3) * 1.4, zone.at.y - row - 0.85);
          facing = Math.PI;
          break;
        }
        default: {
          // Cabins and first aid: in front of the door (the figure stays visible).
          at = toScene(zone.at.x - 4 + i * 1.3, zone.at.y - 3.2);
          facing = Math.PI;
        }
      }
      out.set(id, { at, facing });
    });
  }
  return out;
}
