// Named camera views. Changing the view (or its revision) flies the camera there smoothly;
// dragging or zooming hands control back to the viewer until the next change.

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { toScene } from './common';

export type CameraView = 'overview' | 'establishing' | 'deck' | 'yard' | 'facade' | 'welfare' | 'store' | 'gate' | 'first-aid';

const VIEWS: Record<CameraView, { target: THREE.Vector3; from: THREE.Vector3; distance: number }> = {
  establishing: { target: toScene(30, 20, 10), from: new THREE.Vector3(0.62, 0.32, 0.72), distance: 260 },
  overview: { target: toScene(42, 10, 8), from: new THREE.Vector3(0.6, 0.45, 0.66), distance: 165 },
  deck: { target: toScene(22, 14, 41), from: new THREE.Vector3(0.62, 0.55, 0.56), distance: 62 },
  yard: { target: toScene(84, 14, 0), from: new THREE.Vector3(0.45, 0.5, 0.74), distance: 50 },
  facade: { target: toScene(-3, 15, 16), from: new THREE.Vector3(-0.78, 0.3, 0.55), distance: 52 },
  welfare: { target: toScene(80, -18, 0), from: new THREE.Vector3(0.35, 0.48, 0.8), distance: 48 },
  store: { target: toScene(84, 36, 0), from: new THREE.Vector3(0.4, 0.5, 0.77), distance: 34 },
  gate: { target: toScene(54, -8, 6), from: new THREE.Vector3(0.75, 0.4, 0.52), distance: 70 },
  'first-aid': { target: toScene(100, -28, 0), from: new THREE.Vector3(0.3, 0.45, 0.84), distance: 30 },
};

export function CameraRig({ view, revision }: { view: CameraView; revision: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const flying = useRef(true);
  const destination = useRef(new THREE.Vector3());
  useEffect(() => {
    flying.current = true;
  }, [view, revision]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (flying.current = false);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, []);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (flying.current) {
      const v = VIEWS[view];
      destination.current.copy(v.from).normalize().multiplyScalar(v.distance).add(v.target);
      const k = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1, dt * 1.6);
      c.target.lerp(v.target, k);
      camera.position.lerp(destination.current, k);
      if (camera.position.distanceTo(destination.current) < 0.05) flying.current = false;
    }
    c.update();
    if (camera.position.y < 2) camera.position.y = 2;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={520} />;
}
