import * as THREE from 'three';
import {Cam} from './layout';

// Orbit camera + lens shift that pins the target to `anchor` (px) on screen.
export const camPose = (c: Cam, H: number) => {
  const fovR = THREE.MathUtils.degToRad(c.fov);
  const dist = H / (2 * c.ppu * Math.tan(fovR / 2));
  const yaw = THREE.MathUtils.degToRad(c.yaw);
  const pitch = THREE.MathUtils.degToRad(c.pitch);
  const pos = new THREE.Vector3(
    c.target[0] + dist * Math.sin(yaw) * Math.cos(pitch),
    c.target[1] + dist * Math.sin(pitch),
    c.target[2] + dist * Math.cos(yaw) * Math.cos(pitch),
  );
  return {pos, dist};
};

export const applyCam = (camera: THREE.PerspectiveCamera, c: Cam, W: number, H: number) => {
  const {pos, dist} = camPose(c, H);
  camera.position.copy(pos);
  camera.fov = c.fov;
  camera.aspect = W / H;
  camera.near = Math.max(0.5, dist - 30);
  camera.far = dist + 40;
  camera.up.set(0, 1, 0);
  camera.lookAt(c.target[0], c.target[1], c.target[2]);
  camera.setViewOffset(W, H, W / 2 - c.anchor[0], H / 2 - c.anchor[1], W, H);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

export const makeCamera = (c: Cam, W: number, H: number) => {
  const cam = new THREE.PerspectiveCamera(c.fov, W / H, 0.5, 200);
  applyCam(cam, c, W, H);
  return cam;
};

export const project = (cam: THREE.PerspectiveCamera, p: THREE.Vector3, W: number, H: number) => {
  const v = p.clone().project(cam);
  return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H] as [number, number];
};
