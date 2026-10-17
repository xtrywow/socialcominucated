import * as THREE from 'three';

// Procedural product-photography environment: dark navy room with softbox strips.
// Cool rim strips (back left / back right) give the navy parts a readable edge against the navy wall.
export const buildStudioEnv = (gl: THREE.WebGLRenderer) => {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({color: new THREE.Color('#1b2a46'), side: THREE.BackSide}));
  scene.add(room);
  const box = (w: number, h: number, color: string, k: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide}));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  box(14, 6, '#fff4e4', 2.6, [0, 10, 2]); // overhead softbox
  box(2.2, 11, '#ffffff', 4.6, [8, 2, 7]); // key strip, front right
  box(1.8, 11, '#f3c46e', 2.4, [-9, 1, 4]); // warm strip, left
  box(2.0, 12, '#a9c4ff', 3.4, [-8, 3, -8]); // cool rim strip, back left
  box(2.0, 12, '#9fb7e6', 2.4, [9, 3, -7]); // cool rim strip, back right
  box(22, 10, '#6a4a22', 0.7, [0, -10, 2]); // warm floor bounce
  box(18, 12, '#c79b55', 0.5, [0, 1, 15]); // warm card behind camera (gold body colour)
  box(3, 1.2, '#ffffff', 2.0, [4, 6, 12]); // crisp front kicker
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  return rt.texture;
};
