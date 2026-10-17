import * as THREE from 'three';
import {FLOW, LOCK_ORDER, machineLayout, MachineLayout, Mod, modEntry} from './build';
import {MR} from './geo';
import {BELL_ENTRY, FLIGHT, FPS, FREEZE, lockFrameAt, PLINTH_LOCK, ROOM, WOBBLE} from '../timeline';

// ---------------------------------------------------------------------------
// Deterministic choreography: every pose / lead position is a pure function of
// the frame number (no state), shared by the renderer and by events.ts.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// analytic under-damped spring 0 -> 1 (t in frames)
const springX = (t: number, w0: number, z: number) => {
  if (t <= 0) return 0;
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
};
// spring tuned so its first crossing of 1 happens after `frames` frames
const springFor = (frames: number, z = 0.5) => {
  const wdT = Math.PI - Math.atan(Math.sqrt(1 - z * z) / z);
  const wd = wdT / frames;
  const w0 = wd / Math.sqrt(1 - z * z);
  return {w0, z};
};
const FLY = springFor(FLIGHT, 0.42);
// magnet lock: spring in, hard stop at the first crossing
const lockProgress = (f: number, lock: number) => {
  const t = f - (lock - FLIGHT);
  if (t <= 0) return 0;
  if (t >= FLIGHT) return 1;
  return Math.min(1, springX(t, FLY.w0, FLY.z));
};

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------
type Scatter = {pos: [number, number, number]; rot: [number, number, number]; spin: [number, number, number]; bob: number; ph: number};
// offsets from the docked pose (machine space), rotations about each module pivot.
// Every unplugged hand-off end (gold collar) leans toward the empty centre.
export const SCATTER: Record<Mod, Scatter> = {
  ads: {pos: [-0.45, -1.25, 0.9], rot: [0.18, 0.42, 0.3], spin: [0.012, 0.03, 0.018], bob: 0.07, ph: 0.3},
  social: {pos: [1.25, -1.05, -0.5], rot: [-0.22, -0.5, -0.32], spin: [-0.02, 0.025, 0.02], bob: 0.06, ph: 2.1},
  content: {pos: [-0.85, -0.3, 0.55], rot: [0.28, 0.42, 0.16], spin: [0.01, -0.02, 0.012], bob: 0.05, ph: 4.0},
  seo: {pos: [1.25, 0.45, 1.05], rot: [-0.22, -0.55, 0.42], spin: [-0.02, 0.03, -0.024], bob: 0.07, ph: 1.2},
  web: {pos: [-0.35, 1.0, -0.35], rot: [0.3, 0.42, -0.08], spin: [0.016, -0.025, 0.012], bob: 0.05, ph: 5.1},
};

// drift clock: normal speed, then slows to a near-standstill under «ولی نمی‌فروشی.» (quiet music dip)
const driftClock = (f: number) => {
  const a = 205;
  const b = 232;
  if (f <= a) return f / FPS;
  const slow = 0.28;
  if (f <= b) {
    // ease from 1 to `slow`
    const u = (f - a) / (b - a);
    return (a + (b - a) * (u - (1 - slow) * (u * u) / 2)) / FPS;
  }
  const atB = (a + (b - a) * (1 - (1 - slow) / 2)) / FPS;
  return atB + ((f - b) * slow) / FPS;
};

// near-misses during the tension beat (5-7 s): a part drifts at its neighbour's open end and slides past
const NEAR: Partial<Record<Mod, {toward: [number, number, number]; a: number; b: number}>> = {
  social: {toward: [-0.85, 0.55, 0.45], a: 150, b: 214},
  seo: {toward: [-0.55, 0.5, -0.5], a: 168, b: 226},
  web: {toward: [0.35, -0.3, 0.3], a: 182, b: 236},
};

export type PartPose = {m: THREE.Matrix4; p: number; locked: boolean; since: number};
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const ID_Q = new THREE.Quaternion();

export const lockFrame = (m: Mod) => lockFrameAt(LOCK_ORDER.indexOf(m));

const scatterPose = (L: MachineLayout, m: Mod, f: number) => {
  const sc = SCATTER[m];
  const t = driftClock(f);
  const bob = Math.sin(t * 1.05 + sc.ph) * sc.bob;
  const pos = V(sc.pos[0] + Math.sin(t * 0.37 + sc.ph) * 0.07, sc.pos[1] + bob, sc.pos[2] + Math.cos(t * 0.31 + sc.ph) * 0.06);
  const rot = V(sc.rot[0] + Math.sin(t * 0.5 + sc.ph) * sc.spin[0] * 3, sc.rot[1] + Math.sin(t * 0.33 + sc.ph) * sc.spin[1] * 3, sc.rot[2] + Math.sin(t * 0.41 + sc.ph * 2) * sc.spin[2] * 3);
  const nm = NEAR[m];
  if (nm) {
    const u = clamp01((f - nm.a) / (nm.b - nm.a));
    // approach, almost touch, slide past and back off
    const k = Math.sin(Math.PI * u) * (1 - 0.35 * u);
    pos.x += nm.toward[0] * k;
    pos.y += nm.toward[1] * k;
    pos.z += nm.toward[2] * k;
    rot.z += 0.08 * Math.sin(Math.PI * 2 * u) * (u < 1 ? 1 : 0);
  }
  // parts make room: everyone backs away from the centre so no flight crosses another part
  const room = smooth(ROOM[0], ROOM[1] - 4, f);
  if (room > 0) {
    const piv = L.pivots[m];
    const out = V(piv.x - 0.0, (piv.y - 3.4) * 0.35, 0).add(V(sc.pos[0], 0, 0));
    if (out.lengthSq() < 1e-4) out.set(1, 0, 0);
    out.normalize();
    pos.addScaledVector(out, 0.55 * room);
    pos.z += 0.35 * room;
    // anticipation: rotate a little toward the docked orientation
    rot.multiplyScalar(1 - 0.25 * room);
  }
  return {pos, rot};
};

export const partPose = (m: Mod, f: number): PartPose => {
  const L = machineLayout();
  const lock = lockFrame(m);
  const p = lockProgress(f, lock);
  const piv = L.pivots[m];
  let pos: THREE.Vector3;
  if (p >= 1) {
    pos = V();
    _q.identity();
  } else {
    const s = scatterPose(L, m, Math.min(f, lock - FLIGHT));
    // sprung arc: swing out toward the camera and over, so nothing passes through the stack
    pos = s.pos.clone().multiplyScalar(1 - p);
    const arc = Math.sin(Math.PI * p);
    pos.z += arc * 0.75;
    pos.y += arc * 0.22;
    _q.setFromEuler(_e.set(s.rot.x, s.rot.y, s.rot.z));
    _q.slerp(ID_Q, p);
  }
  // lock squash (tiny) along the module's vertical
  const since = f - lock;
  const sq = since >= 0 && since < 10 ? 0.035 * Math.exp(-since / 3) * Math.cos(since * 0.9) : 0;
  const m4 = new THREE.Matrix4()
    .makeTranslation(piv.x + pos.x, piv.y + pos.y, piv.z + pos.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(_q2.copy(_q)))
    .multiply(new THREE.Matrix4().makeScale(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5))
    .multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z));
  return {m: m4, p, locked: p >= 1, since};
};

// whole machine: one damped wobble-and-settle after the last click (rocks on the plinth's bottom edge)
export const wobbleAngle = (f: number) => {
  const t = f - WOBBLE.start;
  if (t <= 0) return 0;
  return WOBBLE.amp * Math.exp(-t / WOBBLE.tau) * Math.sin((2 * Math.PI * t) / WOBBLE.period);
};
export const machineMatrix = (f: number) => {
  const L = machineLayout();
  const th = wobbleAngle(f);
  const pivotY = -L.plinth.h;
  const pivotX = th > 0 ? -L.plinth.w / 2 : L.plinth.w / 2; // rock on the edge
  return new THREE.Matrix4()
    .makeTranslation(pivotX, pivotY, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(th))
    .multiply(new THREE.Matrix4().makeTranslation(-pivotX, -pivotY, 0));
};

// plinth + backplate spring up on the hit
export const plinthRise = (f: number) => {
  const p = lockProgress(f, PLINTH_LOCK);
  return {y: (1 - p) * -2.4, s: lerp(0.7, 1, p), visible: f >= PLINTH_LOCK - FLIGHT, p};
};
const PLATE = springFor(9, 0.38);
export const plateRise = (f: number) => {
  const t = f - PLINTH_LOCK;
  if (t <= 0) return 0;
  return springX(t, PLATE.w0, PLATE.z);
};
// collar growth on lock: small overshoot
const COLLAR = springFor(5, 0.35);
export const collarGrow = (m: Mod, f: number) => {
  const t = f - lockFrame(m) + 2;
  if (t <= 0) return 0.82;
  return lerp(0.82, 1, springX(t, COLLAR.w0, COLLAR.z));
};
// joint flash on lock (seam of light)
export const lockFlash = (m: Mod, f: number) => {
  const t = f - lockFrame(m);
  if (t < 0) return 0;
  return Math.exp(-t / 6) * (t < 1 ? t : 1);
};
export const rippleAt = (f: number) => {
  const t = f - WOBBLE.start;
  if (t < 0 || t > 75) return -1;
  return t / 75;
};

// ---------------------------------------------------------------------------
// Leads (marbles)
// ---------------------------------------------------------------------------
export const G = 46; // effective gravity (units / s^2) along the track
const DRAG = 0.02; // per unit length
const V_MIN = 4.8;
const V_MAX = 13;
const IMPACT = 0.8;
export type Profile = {ds: number; n: number; t: Float64Array; v: Float64Array; total: number; length: number};
let _prof: Profile | null = null;
export const profile = (): Profile => {
  if (_prof) return _prof;
  const L = machineLayout();
  const ds = 0.01;
  const n = Math.ceil(L.path.length / ds) + 1;
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  // launch speed so that the lob just reaches its apex with ~4.2 u/s left
  let maxY = -1e9;
  for (let d = 0; d < L.bellEntry; d += ds) maxY = Math.max(maxY, L.path.at(d).y);
  const y0 = L.path.at(0).y;
  let vv = Math.sqrt(4.2 * 4.2 + 2 * G * (maxY - y0));
  const impacts = [...L.impacts];
  let prevY = y0;
  const tmp = V();
  for (let i = 0; i < n; i++) {
    const d = Math.min(L.path.length, i * ds);
    const y = L.path.at(d, tmp).y;
    if (i > 0) {
      let v2 = vv * vv - 2 * G * (y - prevY);
      const inFeed = d < L.bellEntry;
      if (!inFeed) v2 *= 1 - DRAG * ds;
      vv = Math.sqrt(Math.max(0, v2));
      if (!inFeed) vv = Math.min(V_MAX, Math.max(V_MIN, vv));
      if (Math.abs(d - L.bellEntry) < ds * 0.5) vv *= 0.5;
      while (impacts.length && d >= impacts[0]) {
        impacts.shift();
        vv *= IMPACT;
        vv = Math.max(V_MIN, vv);
      }
      t[i] = t[i - 1] + ds / Math.max(0.5, vv);
    }
    v[i] = vv;
    prevY = y;
  }
  _prof = {ds, n, t, v, total: t[n - 1], length: L.path.length};
  return _prof;
};
// distance along the path after `age` seconds
export const distAt = (age: number) => {
  const P = profile();
  if (age <= 0) return 0;
  if (age >= P.total) return P.length;
  let lo = 0;
  let hi = P.n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P.t[mid] <= age) lo = mid;
    else hi = mid;
  }
  const u = (age - P.t[lo]) / (P.t[hi] - P.t[lo] || 1);
  return (lo + u) * P.ds;
};
export const timeAt = (d: number) => {
  const P = profile();
  const i = Math.max(0, Math.min(P.n - 1, Math.floor(d / P.ds)));
  return P.t[i];
};
export const speedAt = (d: number) => {
  const P = profile();
  return P.v[Math.max(0, Math.min(P.n - 1, Math.round(d / P.ds)))];
};

export type Release = {f: number; size: number; seed: number; first: boolean};
let _rel: Release[] | null = null;
export const releases = (): Release[] => {
  if (_rel) return _rel;
  const L = machineLayout();
  const tb = timeAt(L.bellEntry) * FPS;
  const first = BELL_ENTRY - tb;
  const r = rng(77);
  const out: Release[] = [{f: first, size: 1.0, seed: 1, first: true}];
  let f = first + 9;
  let i = 1;
  while (f < FREEZE - 4) {
    const burst = f < first + 66;
    out.push({f, size: 0.96 + r() * 0.08, seed: i + 1, first: false});
    i++;
    // irregular spacing: little clusters, then breathing gaps (never a regular rivet row)
    const cl = r();
    if (burst) f += cl < 0.5 ? 2.3 + r() * 0.5 : 3.0 + r() * 1.6;
    else f += cl < 0.3 ? 3.0 + r() * 0.8 : cl < 0.8 ? 5.0 + r() * 3.5 : 9 + r() * 6;
  }
  _rel = out;
  return out;
};

export type LeadState = {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  scale: number;
  phase: 'track' | 'fall' | 'heap';
  d: number;
  first: boolean;
  idx: number;
};

const hopAt = (L: MachineLayout, d: number) => {
  for (const h of L.handoffs) {
    if (d > h.d0 && d < h.d1) {
      const u = (d - h.d0) / (h.d1 - h.d0);
      return 0.085 * Math.sin(Math.PI * u);
    }
  }
  return 0;
};

const UP = V(0, 1, 0);
const rollQ = (L: MachineLayout, d: number, seed: number, out: THREE.Quaternion) => {
  const tan = L.path.tangent(d);
  const ax = tan.clone().cross(UP);
  if (ax.lengthSq() < 1e-4) ax.set(0, 0, 1);
  ax.normalize();
  // angle = distance / radius (true rolling)
  out.setFromAxisAngle(ax, -(d / MR) + seed * 2.1);
  return out;
};

// heap landing: fall from the port into slot k, then two settling bounces
const heapFall = (L: MachineLayout, k: number) => {
  const slot = L.heap[k];
  const port = L.box.port;
  const dy = port.y + 0.08 - slot.y;
  const tf = Math.sqrt((2 * Math.max(0.05, dy)) / G) * 1.15;
  return {slot, tf, dy};
};
export const HEAP_SETTLE = 0.42; // seconds of bouncing after the first contact

export const leadAt = (rel: Release, idx: number, f: number): LeadState | null => {
  const L = machineLayout();
  const P = profile();
  const age = (f - rel.f) / FPS;
  if (age < 0) return null;
  const q = new THREE.Quaternion();
  if (age < P.total) {
    const d = distAt(age);
    const pos = L.path.at(d).clone();
    pos.y += hopAt(L, d);
    rollQ(L, d, rel.seed, q);
    return {pos, q, scale: rel.size, phase: 'track', d, first: rel.first, idx};
  }
  const k = idx;
  if (k >= L.heap.length) return null;
  const {slot, tf} = heapFall(L, k);
  const tau = age - P.total;
  const port = L.box.port;
  const r = rng(1000 + rel.seed);
  if (tau < tf) {
    const u = tau / tf;
    const pos = V(lerp(port.x, slot.x, Math.sqrt(u)), lerp(port.y + 0.08, slot.y, u * u), lerp(port.z, slot.z, u));
    q.setFromAxisAngle(V(0, 0, 1), (L.path.length + tau * 5) / MR);
    return {pos, q, scale: rel.size, phase: 'fall', d: L.path.length, first: rel.first, idx};
  }
  const s = tau - tf;
  let by = 0;
  // two decaying bounces
  const b1 = 0.16;
  const b2 = 0.09;
  if (s < b1) by = 0.075 * Math.sin((Math.PI * s) / b1);
  else if (s < b1 + b2) by = 0.022 * Math.sin((Math.PI * (s - b1)) / b2);
  const roll = s < HEAP_SETTLE ? (1 - s / HEAP_SETTLE) * 0.03 : 0;
  const pos = V(slot.x + roll * (r() - 0.5), slot.y + by, slot.z);
  q.setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
  return {pos, q, scale: rel.size, phase: 'heap', d: L.path.length, first: rel.first, idx};
};

// first contact with the heap (seconds after release)
export const landingAge = (idx: number) => {
  const L = machineLayout();
  if (idx >= L.heap.length) return Infinity;
  return profile().total + heapFall(L, idx).tf;
};

// how full the browser looks (drives the gold loading bar)
export const heapCount = (f: number) => {
  const R = releases();
  let n = 0;
  for (let i = 0; i < R.length; i++) {
    if ((f - R[i].f) / FPS >= landingAge(i)) n++;
  }
  return n;
};

// module power-on: as the first lead (pathfinder) enters each module
export const powerFrame = (m: Mod) => {
  const L = machineLayout();
  const first = releases()[0];
  const d = m === 'web' ? L.path.length - 0.05 : modEntry(L, m) + 0.02;
  return first.f + timeAt(d) * FPS;
};
export const powerOf = (m: Mod, f: number) => {
  const pf = powerFrame(m);
  return smooth(pf - 1, pf + 9, f);
};
export const powerFlash = (m: Mod, f: number) => {
  const t = f - powerFrame(m);
  if (t < 0) return 0;
  return Math.exp(-t / 7) * Math.min(1, t / 1.5);
};

// ---------------------------------------------------------------------------
// F1 lost leads: they roll out of an unconnected module's open end and fall away
// ---------------------------------------------------------------------------
export type Lost = {mod: Mod; f: number; v: number; size: number; drift: [number, number]; spin: number; roll: number; hero?: boolean};
const outletD = (L: MachineLayout, m: Mod) => {
  if (m === 'ads') return L.handoffs[0].d0 + 0.18;
  if (m === 'social') return L.handoffs[1].d0 + 0.05;
  if (m === 'content') return L.handoffs[2].d0 + 0.05;
  return L.handoffs[3].d0 + 0.05;
};
let _lost: Lost[] | null = null;
export const lostLeads = (): Lost[] => {
  if (_lost) return _lost;
  const r = rng(4242);
  const out: Lost[] = [];
  // hero: rattles out of the unplugged megaphone during «تبلیغ هم می‌کنی...»
  out.push({mod: 'ads', f: 100, v: 2.6, size: 1.08, drift: [0.15, 0.25], spin: 1, roll: 2.2, hero: true});
  const mods: Mod[] = ['social', 'content', 'seo', 'social', 'content', 'seo'];
  let f = 6;
  let i = 0;
  while (f < 258) {
    const m = mods[(i * 5 + Math.floor(r() * 3)) % mods.length];
    // keep the quiet dip (219-252) sparse
    const quiet = f > 214 && f < 250;
    if (!quiet || r() < 0.3) {
      out.push({mod: m, f, v: 2.2 + r() * 1.6, size: 0.82 + r() * 0.32, drift: [(r() - 0.5) * 0.9, (r() - 0.3) * 0.9], spin: (r() - 0.5) * 4, roll: 0.35 + r() * 0.5});
    }
    f += 11 + r() * 17;
    i++;
  }
  _lost = out;
  return out;
};

const G_FALL = 16;
export const lostAt = (lead: Lost, f: number): {pos: THREE.Vector3; q: THREE.Quaternion; scale: number; exitF: number} | null => {
  const L = machineLayout();
  const P = profile();
  const t = (f - lead.f) / FPS;
  if (t < 0) return null;
  const dOut = outletD(L, lead.mod);
  // hero: rides down the cone and the outlet, rattling, before it drops off the open end
  const rollT = lead.roll / lead.v;
  const q = new THREE.Quaternion();
  if (t < rollT) {
    const d = dOut - lead.v * (rollT - t);
    const local = L.path.at(d).clone();
    if (lead.hero) {
      const rat = Math.sin(t * 40) * 0.028 * (1 - t / rollT) + Math.sin(t * 23) * 0.012;
      local.addScaledVector(L.meg.down, rat * 0.4);
      local.z += rat;
    }
    const M = partPose(lead.mod, f).m;
    local.applyMatrix4(M);
    rollQ(L, d, lead.spin, q);
    const sIn = lead.hero ? 1 : smooth(0, 0.12, t);
    return {pos: local, q, scale: lead.size * sIn, exitF: lead.f + rollT * FPS};
  }
  const fe = lead.f + rollT * FPS;
  const M = partPose(lead.mod, fe).m;
  const p0 = L.path.at(dOut).clone().applyMatrix4(M);
  const tan = L.path.tangent(dOut).transformDirection(M);
  const tt = t - rollT;
  const vel = tan.multiplyScalar(lead.v);
  const pos = p0
    .clone()
    .addScaledVector(vel, tt)
    .add(V(lead.drift[0] * tt, -0.5 * G_FALL * tt * tt, lead.drift[1] * tt));
  q.setFromAxisAngle(V(0.3, 0.2, 1).normalize(), (dOut + lead.v * tt) / MR + lead.spin * tt * 3);
  if (pos.y < -6 || tt > 2.4) return null;
  void P;
  return {pos, q, scale: lead.size, exitF: fe};
};

export {FLOW};
