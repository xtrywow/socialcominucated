import * as THREE from 'three';
import {FLOW, Mod} from './build';

export const COL = {
  navy: '#0A1628',
  navy2: '#13284A',
  gold: '#D4A853',
  gold2: '#F0D79A',
  slate: '#8A9BB5',
  ivory: '#ECE4D3',
};

// ---------------------------------------------------------------- canvas textures (browser only)
export const radialTexture = (stops: [number, string][], size = 128) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// lead surface: a seam + a meridian so the roll reads (spin highlight without a sprite)
const marbleMap = () => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(70,45,10,0.55)';
  g.fillRect(0, 30, 128, 4); // equator seam
  g.fillRect(0, 0, 3, 64); // meridian
  g.fillRect(64, 0, 3, 64);
  g.fillStyle = 'rgba(255,250,235,1)';
  g.fillRect(0, 28, 128, 1.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
};

// comet pulses for the current (scrolled along a tube's U)
const flowTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0.0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  gr.addColorStop(0.68, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.74, 'rgba(255,255,255,1)');
  gr.addColorStop(0.78, 'rgba(255,255,255,0.1)');
  gr.addColorStop(0.84, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// an accent that is cool slate while unpowered and turns into lit gold
export class PowerMat {
  mat: THREE.MeshPhysicalMaterial;
  private off = new THREE.Color(COL.slate);
  private on = new THREE.Color('#E9BC64');
  private emi = new THREE.Color('#F2B850');
  constructor(private glow = 0.55) {
    this.mat = new THREE.MeshPhysicalMaterial({color: this.off.clone(), roughness: 0.38, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 1});
    this.mat.emissive = this.emi.clone();
    this.mat.emissiveIntensity = 0;
  }
  set(p: number, boost = 1) {
    this.mat.color.copy(this.off).lerp(this.on, p);
    this.mat.metalness = 0.15 + 0.85 * p;
    this.mat.roughness = 0.38 - 0.16 * p;
    this.mat.emissiveIntensity = p * this.glow * boost;
  }
}

export type Mats = ReturnType<typeof makeMats>;
export const makeMats = () => {
  const navy = new THREE.MeshPhysicalMaterial({color: '#1c3a6c', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15});
  const navyMatte = new THREE.MeshStandardMaterial({color: '#21406f', roughness: 0.7, metalness: 0, envMapIntensity: 0.55});
  const plinth = new THREE.MeshPhysicalMaterial({color: '#18335f', roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9});
  const ivory = new THREE.MeshStandardMaterial({color: '#ece4d2', roughness: 0.6, envMapIntensity: 0.75});
  const ivoryBack = ivory.clone();
  ivoryBack.side = THREE.BackSide;
  const ivoryDark = new THREE.MeshStandardMaterial({color: '#d2c6ab', roughness: 0.55, envMapIntensity: 0.7});
  const gold = new THREE.MeshPhysicalMaterial({color: '#e2b866', metalness: 1, roughness: 0.2, envMapIntensity: 1.4});
  const slate = new THREE.MeshStandardMaterial({color: '#8a9bb5', roughness: 0.5, envMapIntensity: 0.6});
  const slateDim = new THREE.MeshStandardMaterial({color: '#a7b2c4', roughness: 0.6, envMapIntensity: 0.5});
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.03,
    metalness: 0,
    transmission: 1,
    thickness: 0.5,
    ior: 1.5,
    envMapIntensity: 1.0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    attenuationColor: new THREE.Color('#fff2d6'),
    attenuationDistance: 4,
  });
  const glassCheap = new THREE.MeshPhysicalMaterial({color: '#f4ecdd', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.3, clearcoat: 1, depthWrite: false});
  const map = marbleMap();
  const marble = new THREE.MeshPhysicalMaterial({color: '#f3c36c', metalness: 1, roughness: 0.14, envMapIntensity: 1.7, map, emissive: new THREE.Color('#d39a3c'), emissiveIntensity: 0.1});
  const ghost = [0.42, 0.24, 0.12].map((o) => {
    const g = marble.clone();
    g.transparent = true;
    g.opacity = o;
    g.depthWrite = false;
    return g;
  });
  const blob = new THREE.MeshBasicMaterial({
    map: radialTexture([
      [0, 'rgba(0,0,0,0.75)'],
      [0.45, 'rgba(0,0,0,0.35)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const glowTex = radialTexture(
    [
      [0, 'rgba(255,236,190,1)'],
      [0.16, 'rgba(255,214,140,0.6)'],
      [0.45, 'rgba(240,180,90,0.14)'],
      [1, 'rgba(212,168,83,0)'],
    ],
    128,
  );
  const halo = new THREE.ShaderMaterial({
    uniforms: {uColor: {value: new THREE.Color('#ffc870')}, uI: {value: 0}},
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uColor*uI*f, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const flowTex = flowTexture();
  const flow = new THREE.MeshBasicMaterial({map: flowTex, color: new THREE.Color('#ffd07a').multiplyScalar(2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0});
  const flowPlinth = flow.clone();
  flowPlinth.map = flowTex.clone();
  flowPlinth.map.repeat.set(4, 1);
  const ripple = new THREE.MeshBasicMaterial({color: new THREE.Color('#ffd27a').multiplyScalar(1.5), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide});
  const loadBar = new THREE.MeshBasicMaterial({color: new THREE.Color('#ffcf72').multiplyScalar(1.25), toneMapped: false});

  // per-module power state
  const accent = {} as Record<Mod, PowerMat>;
  const collar = {} as Record<Mod, THREE.MeshPhysicalMaterial>;
  const inlay = {} as Record<Mod, THREE.MeshBasicMaterial>;
  const haloM = {} as Record<Mod, THREE.ShaderMaterial>;
  for (const m of FLOW) {
    accent[m] = new PowerMat(0.5);
    collar[m] = new THREE.MeshPhysicalMaterial({color: '#b08a45', metalness: 1, roughness: 0.3, envMapIntensity: 1.3, emissive: new THREE.Color('#f5b94e'), emissiveIntensity: 0});
    inlay[m] = new THREE.MeshBasicMaterial({color: '#41516d', toneMapped: false});
    haloM[m] = halo.clone();
  }
  const railGold = gold.clone();
  return {navy, navyMatte, plinth, ivory, ivoryBack, ivoryDark, gold, slate, slateDim, glass, glassCheap, marble, ghost, blob, glowTex, flow, flowPlinth, ripple, loadBar, accent, collar, inlay, haloM, railGold};
};

const INLAY_OFF = new THREE.Color('#40506b');
const INLAY_ON = new THREE.Color('#ffd27c');
export const setModulePower = (M: Mats, m: Mod, p: number, flash: number, boost: number) => {
  M.accent[m].set(p, boost);
  const c = M.collar[m];
  c.color.set('#a98443').lerp(new THREE.Color('#f2c56e'), p);
  c.roughness = 0.32 - 0.12 * p;
  c.emissiveIntensity = (0.32 * p + 1.4 * flash) * boost;
  M.inlay[m].color.copy(INLAY_OFF).lerp(INLAY_ON, p).multiplyScalar(1 + p * 0.5 * boost + flash * 0.8);
  M.haloM[m].uniforms.uI.value = (0.55 * p + 0.9 * flash) * boost;
};
