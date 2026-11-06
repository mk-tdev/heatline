// Screen-space labels without extra React roots: 3D components register an anchor, a projector
// inside the canvas maps anchors to screen positions every frame, and plain DOM elements outside
// the canvas are moved there. (drei's <Html> creates a React root per label, which misbehaved.)

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Anchor {
  object?: THREE.Object3D;
  point?: THREE.Vector3;
  lift: number;
}

export const anchors = new Map<string, Anchor>();
const scratch = new THREE.Vector3();

export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const [id, a] of anchors) {
      const el = document.getElementById(`lbl-${id}`);
      if (!el) continue;
      if (a.object) a.object.getWorldPosition(scratch);
      else if (a.point) scratch.copy(a.point);
      else continue;
      scratch.y += a.lift;
      scratch.project(camera);
      const visible = scratch.z < 1 && Math.abs(scratch.x) < 1.2 && Math.abs(scratch.y) < 1.2;
      el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const x = ((scratch.x + 1) / 2) * size.width;
      const y = ((1 - scratch.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}
