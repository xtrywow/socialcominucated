import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---- channel dimensions (world units) ----
export const MR = 0.12; // marble radius
export const CR = 0.162; // channel inner radius
export const CW = 0.046; // wall thickness
export const LIP = 0.04; // straight wall above the semicircle

// ---------------------------------------------------------------------------
// Turtle: builds dense polylines out of lines and arcs.
// ---------------------------------------------------------------------------
export class Turtle {
  p: THREE.Vector3;
  h: THREE.Vector3;
  pts: THREE.Vector3[];
  step = 0.04;
  constructor(p: THREE.Vector3, h: THREE.Vector3) {
    this.p = p.clone();
    this.h = h.clone().normalize();
    this.pts = [this.p.clone()];
  }
  mark() {
    return this.pts.length - 1;
  }
  slice(from: number, to = this.pts.length - 1) {
    return this.pts.slice(from, to + 1).map((q) => q.clone());
  }
  line(len: number, dz = 0) {
    const n = Math.max(2, Math.ceil(len / this.step));
    for (let i = 0; i < n; i++) {
      this.p.addScaledVector(this.h, len / n);
      this.p.z += dz / n;
      this.pts.push(this.p.clone());
    }
    return this;
  }
  // rotate heading about +Z (in the wall plane) by deg, along an arc of radius r
  arcZ(deg: number, r: number, dz = 0) {
    return this.arc(V(0, 0, 1), deg, r, dz);
  }
  // rotate heading about world Y (horizontal turn) by deg, while dropping dy
  arcY(deg: number, r: number, dy = 0) {
    const ang = THREE.MathUtils.degToRad(deg);
    const L = Math.abs(ang) * r;
    const n = Math.max(4, Math.ceil(L / this.step));
    for (let i = 0; i < n; i++) {
      this.h.applyAxisAngle(UP, ang / n);
      this.p.addScaledVector(this.h, L / n);
      this.p.y += dy / n;
      this.pts.push(this.p.clone());
    }
    return this;
  }
  arc(axis: THREE.Vector3, deg: number, r: number, dz = 0) {
    const ang = THREE.MathUtils.degToRad(deg);
    const L = Math.abs(ang) * r;
    const n = Math.max(4, Math.ceil(L / this.step));
    for (let i = 0; i < n; i++) {
      this.h.applyAxisAngle(axis, ang / n);
      this.p.addScaledVector(this.h, L / n);
      this.p.z += dz / n;
      this.pts.push(this.p.clone());
    }
    return this;
  }
  jump(to: THREE.Vector3, h: THREE.Vector3) {
    this.p.copy(to);
    this.h.copy(h).normalize();
    this.pts.push(this.p.clone());
    return this;
  }
}

export const dirDeg = (deg: number, dz = 0) => {
  const a = THREE.MathUtils.degToRad(deg);
  return V(Math.cos(a), Math.sin(a), dz).normalize();
};

// ---------------------------------------------------------------------------
// Frames along a polyline
// ---------------------------------------------------------------------------
export type FrameMode = ({mode: 'up'} | {mode: 'plane'; side: THREE.Vector3}) & {tilt?: number};
export type Frames = {T: THREE.Vector3[]; S: THREE.Vector3[]; N: THREE.Vector3[]};

export const computeFrames = (pts: THREE.Vector3[], fm: FrameMode): Frames => {
  const T: THREE.Vector3[] = [];
  const S: THREE.Vector3[] = [];
  const N: THREE.Vector3[] = [];
  let prevSide = V(0, 0, 1);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    let s: THREE.Vector3;
    if (fm.mode === 'up') {
      s = t.clone().cross(UP);
      if (s.lengthSq() < 1e-4) s = prevSide.clone();
      s.normalize();
    } else {
      s = fm.side.clone().addScaledVector(t, -fm.side.dot(t)).normalize();
    }
    prevSide = s.clone();
    let n = s.clone().cross(t).normalize();
    if (fm.tilt) {
      // bank the channel so its opening leans towards the camera (+Z)
      const txn = t.clone().cross(n);
      const th = fm.tilt * Math.sign(txn.z || 1);
      n = n.clone().multiplyScalar(Math.cos(th)).addScaledVector(txn, Math.sin(th)).normalize();
      s = t.clone().cross(n).normalize();
    }
    T.push(t);
    S.push(s);
    N.push(n);
  }
  return {T, S, N};
};

// ---------------------------------------------------------------------------
// U-channel profile (s, n, normal_s, normal_n), closed loop, CCW
// ---------------------------------------------------------------------------
type PP = {s: number; n: number; ns: number; nn: number};
export const channelProfile = (ri = CR, wall = CW, lip = LIP, seg = 14): PP[] => {
  const ro = ri + wall;
  const out: PP[] = [];
  // inner surface: from left lip top down around the bottom to right lip top (normals point to the axis)
  out.push({s: -ri, n: lip, ns: 1, nn: 0});
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI + (i / seg) * Math.PI; // 180..360
    const s = Math.cos(a) * ri;
    const n = Math.sin(a) * ri;
    out.push({s, n, ns: -Math.cos(a), nn: -Math.sin(a)});
  }
  out.push({s: ri, n: lip, ns: -1, nn: 0});
  // right lip: half circle over the top from inner to outer
  const lc = (ri + ro) / 2;
  const lr = wall / 2;
  for (let i = 1; i < 4; i++) {
    const a = Math.PI - (i / 4) * Math.PI; // 180 -> 0
    out.push({s: lc + Math.cos(a) * lr, n: lip + Math.sin(a) * lr, ns: Math.cos(a), nn: Math.sin(a)});
  }
  out.push({s: ro, n: lip, ns: 1, nn: 0});
  // outer surface back around the bottom
  for (let i = 0; i <= seg; i++) {
    const a = 2 * Math.PI - (i / seg) * Math.PI; // 360..180
    out.push({s: Math.cos(a) * ro, n: Math.sin(a) * ro, ns: Math.cos(a), nn: Math.sin(a)});
  }
  out.push({s: -ro, n: lip, ns: -1, nn: 0});
  for (let i = 1; i < 4; i++) {
    const a = (i / 4) * Math.PI; // 0 -> 180 around left lip centre
    out.push({s: -lc + Math.cos(a) * lr, n: lip + Math.sin(a) * lr, ns: Math.cos(a), nn: Math.sin(a)});
  }
  return out;
};

// ---------------------------------------------------------------------------
// Sweep a profile along a polyline with frames. Analytic normals, end caps.
// ---------------------------------------------------------------------------
export const sweep = (
  pts: THREE.Vector3[],
  fr: Frames,
  prof: PP[],
  opts: {capStart?: boolean; capEnd?: boolean; from?: number; to?: number} = {},
) => {
  const from = opts.from ?? 0;
  const to = opts.to ?? pts.length - 1;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const P = prof.length;
  const rows = to - from + 1;
  const tmp = V();
  for (let i = from; i <= to; i++) {
    const p = pts[i];
    const s = fr.S[i];
    const n = fr.N[i];
    for (const q of prof) {
      tmp.copy(p).addScaledVector(s, q.s).addScaledVector(n, q.n);
      pos.push(tmp.x, tmp.y, tmp.z);
      const nn = s.clone().multiplyScalar(q.ns).addScaledVector(n, q.nn).normalize();
      nor.push(nn.x, nn.y, nn.z);
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let j = 0; j < P; j++) {
      const j2 = (j + 1) % P;
      const a = r * P + j;
      const b = (r + 1) * P + j;
      const c = (r + 1) * P + j2;
      const d = r * P + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  // orientation check: geometric normal of a bottom-outer quad vs analytic normal
  const geo = new THREE.BufferGeometry();
  const check = () => {
    const j = Math.floor(P * 0.75);
    const r = Math.floor((rows - 1) / 2);
    const A = V().fromArray(pos, (r * P + j) * 3);
    const B = V().fromArray(pos, ((r + 1) * P + j) * 3);
    const D = V().fromArray(pos, (r * P + ((j + 1) % P)) * 3);
    const gn = B.clone().sub(A).cross(D.clone().sub(A));
    const an = V().fromArray(nor, (r * P + j) * 3);
    return gn.dot(an) >= 0;
  };
  if (!check()) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1];
      idx[k + 1] = idx[k + 2];
      idx[k + 2] = t;
    }
  }
  // caps
  const cap = (i: number, sign: number) => {
    const contour = prof.map((q) => new THREE.Vector2(q.s, q.n));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const base = pos.length / 3;
    const p = pts[i];
    const s = fr.S[i];
    const n = fr.N[i];
    const t = fr.T[i].clone().multiplyScalar(sign);
    for (const q of prof) {
      tmp.copy(p).addScaledVector(s, q.s).addScaledVector(n, q.n);
      pos.push(tmp.x, tmp.y, tmp.z);
      nor.push(t.x, t.y, t.z);
    }
    for (const tri of tris) {
      const A = V().fromArray(pos, (base + tri[0]) * 3);
      const B = V().fromArray(pos, (base + tri[1]) * 3);
      const C = V().fromArray(pos, (base + tri[2]) * 3);
      const gn = B.clone().sub(A).cross(C.clone().sub(A));
      if (gn.dot(t) >= 0) idx.push(base + tri[0], base + tri[1], base + tri[2]);
      else idx.push(base + tri[0], base + tri[2], base + tri[1]);
    }
  };
  if (opts.capStart) cap(from, -1);
  if (opts.capEnd) cap(to, 1);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
};

// polyline arc-length resampling helper
export class Polyline {
  pts: THREE.Vector3[];
  cum: number[];
  length: number;
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(d: number, out = V()) {
    const L = this.length;
    const x = Math.max(0, Math.min(L, d));
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= x) lo = mid;
      else hi = mid;
    }
    const seg = this.cum[hi] - this.cum[lo] || 1;
    return out.copy(this.pts[lo]).lerp(this.pts[hi], (x - this.cum[lo]) / seg);
  }
  tangent(d: number) {
    const a = this.at(d - 0.02);
    const b = this.at(d + 0.02);
    return b.sub(a).normalize();
  }
}

// quadratic bezier as polyline (for free flight / drops)
export const bez = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, n = 24) => {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push(V(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z));
  }
  return out;
};

export const roundedRectShape = (w: number, h: number, r: number, cx = 0, cy = 0) => {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

export const roundedRectPath = (w: number, h: number, r: number, cx = 0, cy = 0) => {
  const p = new THREE.Path();
  const x = cx - w / 2;
  const y = cy - h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
};
