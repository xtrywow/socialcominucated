// Guard for the back wall (src/machine/Scene.tsx <Wall>): for every frame of both layouts
//  - no wall corner may sit near the camera plane: clip w ~ 0 makes SwiftShader clip the triangle into garbage
//    (the old 220x220 wall had w = 0.002 at 9:16 f152 -> a one-frame wall flash);
//  - the wall must still cover the whole frame (the half extents the cameras need must stay below the wall's).
// `render.sh wallcheck` (args: wall half x, half y; default = planeGeometry [120, 80] / 2)
import * as THREE from 'three';
import {makeCamera} from '../src/camera';
import {LAYOUTS} from '../src/layout';
import {camAt} from '../src/story';
import {FREEZE} from '../src/timeline';

const C = new THREE.Vector3(0.2, 3.6, -5);
const hx = +(process.argv[2] || 60);
const hy = +(process.argv[3] || 40);
let ok = true;
for (const id of ['9x16', '16x9'] as const) {
  const lay = LAYOUTS[id];
  let worst = {w: 1e9, f: -1};
  let needX = 0;
  let needY = 0;
  for (let f = 0; f < 900; f++) {
    const cam = makeCamera(camAt(lay, Math.min(f, FREEZE)), lay.W, lay.H);
    const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const v = new THREE.Vector4(C.x + sx * hx, C.y + sy * hy, C.z, 1).applyMatrix4(vp);
      if (v.w < worst.w) worst = {w: v.w, f};
      const dir = new THREE.Vector3(sx, sy, 0.5).unproject(cam).sub(cam.position).normalize();
      const hit = cam.position.clone().addScaledVector(dir, (C.z - cam.position.z) / dir.z);
      needX = Math.max(needX, Math.abs(hit.x - C.x));
      needY = Math.max(needY, Math.abs(hit.y - C.y));
    }
  }
  const pass = worst.w > 2 && needX < hx && needY < hy;
  ok = ok && pass;
  console.log(`${id}: min corner clip w ${worst.w.toFixed(2)} (frame ${worst.f}), cameras need half extents x ${needX.toFixed(1)} y ${needY.toFixed(1)} (wall ${hx} x ${hy}) -> ${pass ? 'OK' : 'FAIL'}`);
}
process.exit(ok ? 0 : 1);
