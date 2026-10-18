// Collision guard for the choreography (src/machine/motion.ts), computed from the same pose functions the renderer uses.
//  1. part vs part (ads, social, content, seo, web + plinth + backplate) on every frame of the scatter / make-room /
//     snap (0..LAST_LOCK+10): fails when two parts interpenetrate deeper than they do when docked;
//  2. every F1 lost lead (rendered radius MR * size * 1.3) vs every part it does not belong to, plus plinth and
//     backplate, from the moment it leaves its own track: fails on any penetration.
// Shapes: analytic boxes / stadium for the big flat bodies (browser frame, page sheet, seo card, plinth, plate) and
// sphere samples along the channels, the megaphone cone, the lens ring + handle and the social badge.
// `render.sh collide` (exit 1 on failure). Optional args: from to.
import * as THREE from 'three';
import {FLOW, machineLayout, Mod} from '../src/machine/build';
import {CR, CW, MR} from '../src/machine/geo';
import {lostAt, lostLeads, partPose, plateRise, plinthRise} from '../src/machine/motion';
import {FPS, LAST_LOCK, PLINTH_LOCK} from '../src/timeline';

const L = machineLayout();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Sph = {p: THREE.Vector3; r: number};
type Box = {min: THREE.Vector3; max: THREE.Vector3; round: number};
type Part = {spheres: Sph[]; boxes: Box[]; samples: Sph[]; lbox: THREE.Box3};

const densify = (pts: THREE.Vector3[], step = 0.05) => {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / step));
    for (let k = 0; k < n; k++) out.push(pts[i].clone().lerp(pts[i + 1], k / n));
  }
  out.push(pts[pts.length - 1].clone());
  return out;
};
const boxSdf = (b: Box, p: THREE.Vector3) => {
  const cx = (b.min.x + b.max.x) / 2;
  const cy = (b.min.y + b.max.y) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const qx = Math.abs(p.x - cx) - (b.max.x - b.min.x) / 2;
  const qy = Math.abs(p.y - cy) - (b.max.y - b.min.y) / 2;
  const qz = Math.abs(p.z - cz) - (b.max.z - b.min.z) / 2;
  const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return out + Math.min(Math.max(qx, qy, qz), 0);
};
const boxSurface = (b: Box, st = 0.08): Sph[] => {
  const out: Sph[] = [];
  const n = (a: number, c: number) => Math.max(1, Math.ceil((c - a) / st));
  const nx = n(b.min.x, b.max.x);
  const ny = n(b.min.y, b.max.y);
  const nz = n(b.min.z, b.max.z);
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= ny; j++)
      for (let k = 0; k <= nz; k++) {
        if (i !== 0 && i !== nx && j !== 0 && j !== ny && k !== 0 && k !== nz) continue;
        out.push({p: V(b.min.x + ((b.max.x - b.min.x) * i) / nx, b.min.y + ((b.max.y - b.min.y) * j) / ny, b.min.z + ((b.max.z - b.min.z) * k) / nz), r: 0});
      }
  return out;
};
const mkPart = (spheres: Sph[], boxes: Box[]): Part => {
  const samples = [...spheres, ...boxes.flatMap((b) => boxSurface(b))];
  const lbox = new THREE.Box3();
  for (const s of spheres) lbox.expandByPoint(s.p.clone().addScalar(s.r)).expandByPoint(s.p.clone().subScalar(s.r));
  for (const b of boxes) lbox.expandByPoint(b.min).expandByPoint(b.max);
  return {spheres, boxes, samples, lbox};
};
const tubeR = CR + CW;
const parts = {} as Record<Mod, Part>;
{
  const ch = (m: Mod) => L.ch[m].flatMap((c) => densify(c.pts).map((p) => ({p, r: tubeR})));
  // megaphone: cone surface + bell rim
  const cone: Sph[] = [];
  {
    const {D, axis, down, L: len, r0, r1} = L.meg;
    const zax = new THREE.Vector3().crossVectors(axis, down).normalize();
    for (let u = 0; u <= 1.0001; u += 0.08)
      for (let a = 0; a < 360; a += 20) {
        const rad = r0 + (r1 - r0) * u;
        const t = (a * Math.PI) / 180;
        cone.push({p: D.clone().addScaledVector(axis, len * u).addScaledVector(down, Math.cos(t) * rad).addScaledVector(zax, Math.sin(t) * rad), r: u > 0.95 ? 0.07 : 0.035});
      }
    // driver housing behind the cone
    cone.push({p: D.clone().addScaledVector(axis, -0.12), r: 0.27});
  }
  parts.ads = mkPart([...ch('ads'), ...cone], []);
  parts.social = mkPart([...ch('social'), {p: L.loop.heart.clone(), r: 0.3}], []);
  const pg = L.page;
  parts.content = mkPart(ch('content'), [{min: V(pg.x0, pg.y0, pg.z - 0.094), max: V(pg.x1, pg.y1, pg.z), round: 0}]);
  const sp = L.seo.panel;
  const lensRing: Sph[] = [];
  {
    const {lens, r, handleAng} = L.seo;
    for (let a = 0; a < 360; a += 8) {
      const t = (a * Math.PI) / 180;
      lensRing.push({p: lens.clone().add(V(Math.cos(t) * r, Math.sin(t) * r, 0)), r: 0.052});
    }
    lensRing.push({p: lens.clone(), r: 0.09}); // glass (flattened sphere): its thickest point
    const dir = V(Math.cos(handleAng), Math.sin(handleAng), 0);
    for (let k = 0; k <= 6; k++) lensRing.push({p: lens.clone().addScaledVector(dir, r + 0.04 + (0.6 * k) / 6), r: 0.088});
  }
  parts.seo = mkPart([...ch('seo'), ...lensRing], [{min: V(sp[0] - 0.015, sp[1] - 0.015, L.seo.z - 0.09), max: V(sp[2] + 0.015, sp[3] + 0.015, L.seo.z)}].map((b) => ({...b, round: 0})));
  const b = L.box;
  parts.web = mkPart([], [{min: V(b.cx - b.w / 2 - 0.03, b.cy - b.h / 2 - 0.03, b.z0 - 0.03), max: V(b.cx + b.w / 2 + 0.03, b.cy + b.h / 2 + 0.03, b.z0 + b.depth + 0.03), round: 0}]);
}

// part SDF in its own (docked) space
const partSdf = (P: Part, p: THREE.Vector3) => {
  let d = 1e9;
  for (const b of P.boxes) d = Math.min(d, boxSdf(b, p));
  for (const s of P.spheres) {
    const dx = p.x - s.p.x;
    const dy = p.y - s.p.y;
    const dz = p.z - s.p.z;
    const g = Math.sqrt(dx * dx + dy * dy + dz * dz) - s.r;
    if (g < d) d = g;
  }
  return d;
};
// chassis SDFs (machine space) at frame f; null when not on screen yet
const plinthSdf = (f: number) => {
  const rise = plinthRise(f);
  if (!rise.visible) return null;
  const pl = L.plinth;
  return (p: THREE.Vector3) => {
    const x = p.x / rise.s;
    const z = p.z / rise.s;
    const y = (p.y - rise.y) / rise.sy;
    const a = pl.w / 2 - pl.d / 2;
    const dx = Math.max(Math.abs(x) - a, 0);
    const d2 = Math.hypot(dx, z - pl.zc) - pl.d / 2;
    const dy = Math.max(y, -pl.h - y);
    const o = Math.hypot(Math.max(d2, 0), Math.max(dy, 0)) + Math.min(Math.max(d2, dy), 0);
    return o * Math.min(rise.s, rise.sy);
  };
};
const plateSdf = (f: number) => {
  const h = plateRise(f);
  if (h <= 0.001 || f < PLINTH_LOCK - 12) return null;
  const pt = L.plate;
  const box: Box = {min: V(pt.x0 - 0.02, pt.y0, pt.z - 0.02), max: V(pt.x1 + 0.02, pt.y0 + (pt.y1 - pt.y0) * h, pt.z + pt.t + 0.02), round: 0};
  return (p: THREE.Vector3) => boxSdf(box, p);
};

const mats = (f: number) => {
  const o = {} as Record<Mod, {m: THREE.Matrix4; inv: THREE.Matrix4; wbox: THREE.Box3}>;
  for (const m of FLOW) {
    const M = partPose(m, f).m;
    o[m] = {m: M, inv: M.clone().invert(), wbox: parts[m].lbox.clone().applyMatrix4(M)};
  }
  return o;
};
// min gap between parts A and B: A's samples against B's SDF and vice versa
const tmp = V();
const gapAB = (A: Mod, B: Mod, T: ReturnType<typeof mats>) => {
  let g = 1e9;
  for (const [X, Y] of [
    [A, B],
    [B, A],
  ] as [Mod, Mod][]) {
    const wb = T[Y].wbox.clone().expandByScalar(0.3);
    for (const s of parts[X].samples) {
      tmp.copy(s.p).applyMatrix4(T[X].m);
      if (!wb.containsPoint(tmp)) continue;
      tmp.applyMatrix4(T[Y].inv);
      const d = partSdf(parts[Y], tmp) - s.r;
      if (d < g) g = d;
    }
  }
  return g;
};
const gapChassis = (A: Mod, T: ReturnType<typeof mats>, sdf: ((p: THREE.Vector3) => number) | null) => {
  if (!sdf) return 1e9;
  let g = 1e9;
  for (const s of parts[A].samples) {
    tmp.copy(s.p).applyMatrix4(T[A].m);
    const d = sdf(tmp) - s.r;
    if (d < g) g = d;
  }
  return g;
};

const f0 = +(process.argv[2] ?? 0);
const f1 = +(process.argv[3] ?? LAST_LOCK + 10);
const DOCK = LAST_LOCK + 40;
const TD = mats(DOCK);
const base: Record<string, number> = {};
const pairs: [Mod, Mod][] = [];
for (let i = 0; i < FLOW.length; i++) for (let j = i + 1; j < FLOW.length; j++) pairs.push([FLOW[i], FLOW[j]]);
for (const [a, b] of pairs) base[a + '|' + b] = gapAB(a, b, TD);
for (const m of FLOW) {
  base[m + '|plinth'] = gapChassis(m, TD, plinthSdf(DOCK));
  base[m + '|plate'] = gapChassis(m, TD, plateSdf(DOCK));
}
const TOL = 0.02;
let fails = 0;
const worst: Record<string, {g: number; f: number}> = {};
const note = (k: string, g: number, f: number) => {
  if (!worst[k] || g < worst[k].g) worst[k] = {g, f};
};
for (let f = f0; f <= f1; f++) {
  const T = mats(f);
  const hits: string[] = [];
  const chk = (k: string, g: number) => {
    note(k, g, f);
    if (g < -TOL && g < base[k] - TOL) hits.push(`${k} ${g.toFixed(3)} (docked ${base[k].toFixed(3)})`);
  };
  for (const [a, b] of pairs) chk(a + '|' + b, gapAB(a, b, T));
  const ps = plinthSdf(f);
  const pp = plateSdf(f);
  for (const m of FLOW) {
    chk(m + '|plinth', gapChassis(m, T, ps));
    chk(m + '|plate', gapChassis(m, T, pp));
  }
  if (hits.length) {
    fails++;
    console.log('f' + f, hits.join('; '));
  }
}
// lost leads
let lostFails = 0;
let lostWorst = 1e9;
for (let f = f0; f <= Math.min(f1, 300); f++) {
  const T = mats(f);
  const ps = plinthSdf(f);
  const pp = plateSdf(f);
  for (const ld of lostLeads()) {
    const st = lostAt(ld, f);
    if (!st) continue;
    const t = (f - ld.f) / FPS;
    if (t < ld.roll / ld.v + 0.05) continue; // still riding its own track
    const r = MR * st.scale * 1.3;
    const test = (k: string, g: number) => {
      lostWorst = Math.min(lostWorst, g);
      if (g < -0.005) {
        lostFails++;
        if (lostFails <= 40) console.log(`f${f} lost lead (${ld.mod}@${ld.f}${ld.hero ? ', hero' : ''}) inside ${k} by ${(-g).toFixed(3)}`);
      }
    };
    for (const m of FLOW) {
      if (m === ld.mod) continue;
      tmp.copy(st.pos).applyMatrix4(T[m].inv);
      test(m, partSdf(parts[m], tmp) - r);
    }
    if (ps) test('plinth', ps(st.pos) - r);
    if (pp) test('plate', pp(st.pos) - r);
  }
}
const tight = Object.entries(worst)
  .filter(([, v]) => v.g < 0.05)
  .map(([k, v]) => `${k} ${v.g.toFixed(3)}@f${v.f} (docked ${base[k].toFixed(3)})`);
console.log(`parts f${f0}-${f1}: ${fails} frame(s) with interpenetration; closest pairs: ${tight.join('; ') || 'none < 0.05'}`);
console.log(`lost leads: ${lostFails} penetration sample(s); smallest clearance ${lostWorst.toFixed(3)}`);
process.exit(fails || lostFails ? 1 : 0);
