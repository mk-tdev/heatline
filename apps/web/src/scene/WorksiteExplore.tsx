import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlaygroundContext, clamp, walkPosition } from './explorationState';

type Mode = 'walk' | 'lift' | 'crane';
interface Tour { x: number; z: number; deck: boolean; yaw: number; pitch: number; mode: Mode; destination: number }

/** A disposable visual sandbox. Only onClose crosses back into the application. */
export function WorksiteExplore({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const machinery = useRef({ lift: .4, slew: 2.6, trolley: 30, cable: 24 });
  const tour = useRef<Tour>({ x: 49, z: 14, deck: false, yaw: .25, pitch: 0, mode: 'walk', destination: .4 });
  const keys = useRef(new Set<string>());
  const [mode, setMode] = useState<Mode>('walk');
  const [near, setNear] = useState('');
  const [floor, setFloor] = useState('Ground');
  const [locked, setLocked] = useState(false);
  const [movement, setMovement] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const leaveMachine = () => {
    const t = tour.current;
    if (t.mode === 'lift' && Math.abs(machinery.current.lift - t.destination) > .1) return;
    if (t.mode === 'crane') { t.x = 54; t.z = -29; t.deck = false; }
    else if (t.mode === 'lift') { t.deck = machinery.current.lift > 20; t.x = t.deck ? 37 : 47; t.z = -9; }
    t.mode = 'walk'; t.pitch = 0; keys.current.clear(); setMode('walk');
  };
  const enter = (next: 'lift' | 'crane') => {
    tour.current.mode = next; keys.current.clear(); setMode(next);
    if (next === 'lift') { tour.current.yaw = -Math.PI / 2; tour.current.pitch = -.08; tour.current.destination = tour.current.deck ? 42.4 : .4; machinery.current.lift = tour.current.destination; }
  };
  const close = () => { keys.current.clear(); onClose(); };
  useEffect(() => {
    const app = document.querySelector<HTMLElement>('.app');
    const oldInert = app?.inert;
    const previous = document.activeElement as HTMLElement | null;
    if (app) app.inert = true;
    exit.current?.focus();
    return () => { if (app) app.inert = oldInert ?? false; previous?.focus(); };
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Capture before the simulator's Space handler; never control its playback.
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (e.code === 'Tab') {
        const buttons = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        const first = buttons?.[0], last = buttons?.[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        return;
      }
      if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space'].includes(e.code)) {
        // Let focused UI buttons retain Space activation without reaching the app.
        if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
        e.preventDefault(); e.stopImmediatePropagation(); keys.current.add(e.code);
        if (e.code === 'KeyE' && !e.repeat && tour.current.mode === 'walk') {
          if (near === 'lift') enter('lift'); else if (near === 'crane') enter('crane');
        }
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  });
  const held = (label: string, key: string) => <button onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(key); }} onPointerUp={() => keys.current.delete(key)} onPointerCancel={() => keys.current.delete(key)} onLostPointerCapture={() => keys.current.delete(key)} onBlur={() => keys.current.delete(key)} onKeyDown={e => { if (e.code === 'Enter' || e.code === 'Space') keys.current.add(key); }} onKeyUp={() => keys.current.delete(key)}>{label}</button>;
  return createPortal(<div className="worksite-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" ref={panel}>
    <PlaygroundContext.Provider value={machinery.current}>
      <Canvas shadows camera={{ fov: 72, near: .08, far: 2500 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        {children}
        <Walker tour={tour.current} machinery={machinery.current} keys={keys.current} onNear={setNear} onFloor={setFloor} onMoving={setLocked} />
      </Canvas>
    </PlaygroundContext.Provider>
    <header className="tour-header"><div><span className="tour-dot"/><strong id="tour-title">Explore on foot</strong><p>Free exploration · separate from your shift</p></div><button ref={exit} onClick={close}>Back to shift <kbd>Esc</kbd></button></header>
    <span className="tour-crosshair" aria-hidden="true">+</span>
    <div className="tour-location" aria-live="polite">{mode === 'crane' ? 'Tower crane · operator view' : mode === 'lift' ? `Construction lift · ${floor}` : tour.current.deck ? 'Level 12 · rooftop walk' : 'Saadiyat Tower · ground walk'}</div>
    <section className="tour-controls">
      {mode === 'walk' ? <>
        <h2>Walk</h2><p><kbd>W A S D</kbd> walk · <kbd>Shift</kbd> move faster · drag to look · arrow keys turn and walk</p>
        {movement && <div className="tour-buttons" id="tour-movement">{held('Forward','KeyW')}{held('Back','KeyS')}{held('Turn left','ArrowLeft')}{held('Turn right','ArrowRight')}</div>}
        <div className="tour-buttons">
          <button aria-expanded={movement} aria-controls="tour-movement" onClick={() => setMovement(!movement)}>Movement {movement ? '−' : '+'}</button>
          {near && <button className="tour-primary" onClick={() => enter(near as 'lift' | 'crane')}>{near === 'lift' ? 'Board the lift' : 'Enter crane cab'} <kbd>E</kbd></button>}
          <button onClick={() => { tour.current.x = tour.current.deck ? 37 : 47; tour.current.z = -9; tour.current.yaw = Math.PI / 2; }}>Lift entrance</button>
          {!tour.current.deck && <button onClick={() => { tour.current.x = 54; tour.current.z = -29; tour.current.yaw = .6; }}>Crane base</button>}
        </div>
      </> : mode === 'lift' ? <>
        <h2>Lift</h2><p>Choose a floor. Step out when you arrive.</p>
        <div className="tour-buttons"><button disabled={locked} onClick={() => { tour.current.destination = .4; }}>Ground floor</button><button disabled={locked} onClick={() => { tour.current.destination = 42.4; }}>Level 12</button><button className="tour-primary" disabled={locked} onClick={leaveMachine}>{locked ? 'Lift travelling…' : 'Step out'}</button></div>
      </> : <>
        <h2>Crane</h2><p><kbd>A / D</kbd> rotate · <kbd>W / S</kbd> trolley · <kbd>Q / E</kbd> raise / lower hook</p>
        <div className="tour-buttons">{held('↶ Rotate','KeyA')}{held('Rotate ↷','KeyD')}{held('Trolley out','KeyW')}{held('Trolley in','KeyS')}{held('Raise hook','KeyQ')}{held('Lower hook','KeyE')}<button className="tour-primary" onClick={leaveMachine}>Back to ground</button></div>
        <small>Hold buttons or keys to operate.</small>
      </>}
    </section>
  </div>, document.body);
}

function Walker({ tour, machinery, keys, onNear, onFloor, onMoving }: { tour: Tour; machinery: { lift: number; slew: number; trolley: number; cable: number }; keys: Set<string>; onNear: (s: string) => void; onFloor: (s: string) => void; onMoving: (v: boolean) => void }) {
  const { camera, gl } = useThree();
  const last = useRef('');
  useEffect(() => {
    const canvas = gl.domElement;
    let drag = false;
    const down = (e: PointerEvent) => { drag = true; canvas.setPointerCapture(e.pointerId); };
    const up = () => { drag = false; };
    const move = (e: PointerEvent) => { if (drag && tour.mode !== 'crane') { tour.yaw -= e.movementX * .004; tour.pitch = clamp(tour.pitch - e.movementY * .004, -1.2, 1.2); } };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('pointermove', move);
    return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('pointermove', move); };
  }, [gl, tour]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05);
    const axis = (a: string, b: string) => Number(keys.has(a)) - Number(keys.has(b));
    if (tour.mode === 'crane') {
      machinery.slew += axis('KeyA','KeyD') * dt * .35;
      machinery.trolley = clamp(machinery.trolley + axis('KeyW','KeyS') * dt * 8, 8, 52);
      machinery.cable = clamp(machinery.cable + axis('KeyE','KeyQ') * dt * 8, 4, 55);
      camera.position.set(50 + Math.cos(machinery.slew) * 3 + Math.sin(machinery.slew) * 3.5, 63.5, -34 - Math.sin(machinery.slew) * 3 + Math.cos(machinery.slew) * 3.5);
      camera.lookAt(50 + Math.cos(machinery.slew) * machinery.trolley, 64.5 - machinery.cable, -34 - Math.sin(machinery.slew) * machinery.trolley);
    } else {
      tour.yaw += axis('ArrowLeft','ArrowRight') * dt * 1.6;
      if (tour.mode === 'lift') {
        machinery.lift = THREE.MathUtils.damp(machinery.lift, tour.destination, .65, dt);
        if (Math.abs(machinery.lift - tour.destination) < .05) machinery.lift = tour.destination;
        camera.position.set(43.7, machinery.lift + 1.7, -9);
      } else {
        const f = clamp(axis('KeyW','KeyS') + axis('ArrowUp','ArrowDown'), -1, 1), side = axis('KeyD','KeyA');
        const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 12 : 5) * dt / Math.max(1, Math.hypot(f, side));
        const next = walkPosition(tour.x + (-Math.sin(tour.yaw) * f + Math.cos(tour.yaw) * side) * speed, tour.z + (-Math.cos(tour.yaw) * f - Math.sin(tour.yaw) * side) * speed, tour.deck, tour);
        tour.x = next.x; tour.z = next.z;
        camera.position.set(tour.x, tour.deck ? 44.1 : 1.8, tour.z);
      }
      camera.rotation.set(tour.pitch, tour.yaw, 0, 'YXZ');
    }
    const near = tour.mode === 'walk' ? Math.hypot(tour.x - (tour.deck ? 37 : 47), tour.z + 9) < 5 ? 'lift' : !tour.deck && Math.hypot(tour.x - 54, tour.z + 29) < 6 ? 'crane' : '' : '';
    const moving = Math.abs(machinery.lift - tour.destination) > .1;
    const floor = moving ? `${Math.round((machinery.lift - .4) / 3.5)} floors up` : machinery.lift > 20 ? 'Level 12' : 'Ground';
    const signature = `${near}|${floor}|${moving}|${tour.deck}`;
    if (signature !== last.current) { last.current = signature; onNear(near); onFloor(floor); onMoving(moving); }
  });
  return null;
}
