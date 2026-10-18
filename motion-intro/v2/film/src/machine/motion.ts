import * as THREE from 'three';
import {FLOW, HEAP_ROW, HEAP_ROWS, LOCK_ORDER, machineLayout, MachineLayout, Mod, modEntry} from './build';
import {MR} from './geo';
import {BELL_ENTRY, END, FLIGHT, FPS, FREEZE, lockFrameAt, PLINTH_LOCK, ROOM, WOBBLE} from '../timeline';

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
  ads: {pos: [-1.2, 0.05, 0.5], rot: [0.12, 0.38, -0.38], spin: [0.012, 0.03, 0.018], bob: 0.07, ph: 0.3},
  social: {pos: [2.05, -0.2, -0.3], rot: [-0.18, -0.42, 0.42], spin: [-0.02, 0.025, 0.02], bob: 0.06, ph: 2.1},
  // (content sits 0.5 further back than before so the megaphone's outlet, and the hero lead, are in front of it)
  content: {pos: [-2.05, -0.45, -0.15], rot: [0.16, 0.48, 0.22], spin: [0.01, -0.02, 0.012], bob: 0.05, ph: 4.0},
  seo: {pos: [2.45, -0.35, 0.7], rot: [-0.16, -0.5, -0.36], spin: [-0.02, 0.03, -0.024], bob: 0.07, ph: 1.2},
  web: {pos: [-0.6, -0.45, -0.2], rot: [0.26, 0.34, 0.1], spin: [0.016, -0.025, 0.012], bob: 0.05, ph: 5.1},
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
  social: {toward: [-0.95, 0.25, 0.35], a: 150, b: 214},
  seo: {toward: [-1.05, 0.55, -0.3], a: 166, b: 226},
  web: {toward: [0.7, 0.55, 0.35], a: 182, b: 238},
};

// "parts make room": each part backs away from its own flight corridor. The browser lifts clear above the plinth
// (the base grows up out of the floor right under it on the hit, so the browser must hang above the plinth top for
// the whole window from 260 to its lock, and never covers the band flare on 270).
const ROOM_DIR: Record<Mod, [number, number, number]> = {
  ads: [-1, 0.45, 0],
  social: [1, 0.45, 0],
  content: [-1, 0.1, 0],
  seo: [1, 0.3, 0],
  web: [-0.5, 1, 0],
};
const ROOM_AMP: Record<Mod, number> = {ads: 0.35, social: 0.35, content: 0.35, seo: 0.35, web: 0.6};
// depth during the breath: parts ease toward the camera, except the megaphone, which leans back so the page can
// settle under its outlet in front of it
const ROOM_Z: Record<Mod, number> = {ads: -0.25, social: 0.18, content: 0.18, seo: 0.18, web: 0.18};
// flight arc per part (added at sin(pi p)): swing toward the camera (z) and over (y). The page comes in high and shallow
// so it settles onto the seo ramp from above instead of sweeping through the lens; the browser drops onto the plinth.
const ARC: Record<Mod, {z: number; y: number}> = {
  ads: {z: 0.75, y: 0.22},
  social: {z: 0.75, y: 0.22},
  content: {z: 0.35, y: 0.55},
  seo: {z: 0.75, y: 0.22},
  web: {z: 0.3, y: 0.3},
};

export const roomAt = (f: number) => {
  const u = clamp01((f - ROOM[0]) / (ROOM[1] - ROOM[0]));
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
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
  // parts make room: everyone backs away from the centre so no flight crosses another part.
  // A held breath, not a move: half the old amplitude on a slow sine ease over the whole window, so the
  // run-up never competes with the hit.
  const room = roomAt(f);
  if (room > 0) {
    const out = V(...ROOM_DIR[m]).normalize();
    pos.addScaledVector(out, ROOM_AMP[m] * room);
    pos.z += ROOM_Z[m] * room;
    // anticipation: rotate a little toward the docked orientation
    rot.multiplyScalar(1 - 0.15 * room);
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
    pos.z += arc * ARC[m].z;
    pos.y += arc * ARC[m].y;
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

// plinth + backplate spring up on the hit: the base grows up out of the floor right under the machine
// (it no longer rises from below frame, so it never enters the 9:16 caption zone) and slams to a stop on 270
export const plinthRise = (f: number) => {
  const p = lockProgress(f, PLINTH_LOCK);
  return {y: (1 - p) * -0.5, s: lerp(0.32, 1, p), sy: lerp(0.45, 1, p), visible: f >= PLINTH_LOCK - FLIGHT, p};
};
// the hit itself: gold band + inlay ignite with a 2-3 frame flare (then settle until the current arrives)
export const hitFlash = (f: number) => {
  const t = f - PLINTH_LOCK;
  if (t < 0) return 0;
  return Math.exp(-t / 2.2);
};
// 1-2 px camera kick on the hit (screen px, + = down): impact, rebound, gone by +5
export const hitKick = (f: number) => {
  const t = Math.round(f) - PLINTH_LOCK;
  if (t < 0 || t > 4) return 0;
  return 2 * Math.pow(-0.5, t);
};
// the backplate "spine" grows in steps as each part locks onto it
const PLATE = springFor(6, 0.4);
const PLATE_STEPS: [number, number][] = [
  [PLINTH_LOCK, 0.18],
  [lockFrameAt(0), 0.3],
  [lockFrameAt(1), 0.45],
  [lockFrameAt(2), 0.8],
  [lockFrameAt(3), 1.0],
];
export const plateRise = (f: number) => {
  let h = 0;
  let prev = 0;
  for (const [at, to] of PLATE_STEPS) {
    const t = f - at + 2;
    if (t > 0) h += (to - prev) * springX(t, PLATE.w0, PLATE.z);
    prev = to;
  }
  // the last step settles without overshooting the top: the spine never grows into the megaphone's bell as it locks
  return Math.min(1, h);
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
// speed left at the top of the lob into the bell: brisk enough that leads 4+ frames apart stay >= 3 diameters apart
const APEX_V = 6.4;
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
  // launch speed so that the lob just reaches its apex with APEX_V u/s left
  let maxY = -1e9;
  for (let d = 0; d < L.bellEntry; d += ds) maxY = Math.max(maxY, L.path.at(d).y);
  const y0 = L.path.at(0).y;
  let vv = Math.sqrt(APEX_V * APEX_V + 2 * G * (maxY - y0));
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

// A release: `f` = launch frame (machine clock), `bell` = frame it enters the bell. Every lead is its own lob: feed speed
// factor `fs` (the off-frame lob takes timeAt(bellEntry) / fs), arc height `arcH` and depth `arcZ` (added on the feed
// arc only, fading out before the bell). After the bell all leads share the track profile.
export type Release = {f: number; bell: number; size: number; seed: number; first: boolean; fs: number; arcH: number; arcZ: number};
// last release (machine clock): nothing is left on the off-frame feed arc when the clock stops at the freeze
// (machineTime(FREEZE) = 815; the slowest lob takes ~24 frames), so the cover frame has no lead cut by the frame edge
export const RELEASE_STOP = 772;
// The pathfinder is alone in the machine until it has lit the content page (~355): the first general lead is launched
// then and enters the bell at FLOW_START; the flow proper opens on the «یه سیستم» beat (TXT.system = 387).
export const FLOW_START = 375;
const FLOW_OPEN = 387;
// bell-arrival spacing never drops below MIN_GAP frames: >= 3 lead diameters centre-to-centre where the lob is slowest
// (its top, APEX_V), so the incoming arc never reads as a bead chain
export const MIN_GAP = 4.0;
const feedSec = () => timeAt(machineLayout().bellEntry);
let _rel: Release[] | null = null;
export const releases = (): Release[] => {
  if (_rel) return _rel;
  const tb = feedSec();
  const r = rng(77);
  const out: Release[] = [{f: BELL_ENTRY - tb * FPS, bell: BELL_ENTRY, size: 1.0, seed: 1, first: true, fs: 1, arcH: 0, arcZ: 0}];
  // lead-in: two loners between the pathfinder's beat and the beat, then the flow: pairs and short runs at
  // MIN_GAP..+1, breathing gaps of 7-9 and 11-15 frames (irregular, so no ramp ever carries an even row)
  const bells: number[] = [FLOW_START, FLOW_START + 6.5];
  let b = FLOW_OPEN;
  while (b < RELEASE_STOP + 30) {
    bells.push(b);
    const x = r();
    // the opening (until ~16 s) breathes most: pairs, short runs and real gaps; through the night the flow is
    // steadier (it never stops), and after ~22 s it thins out for the end card
    const phase = b < 470 ? 0 : b < 650 ? 1 : 2;
    const P1 = [0.6, 0.68, 0.4][phase];
    const P2 = [0.87, 0.95, 0.75][phase];
    if (x < P1) b += MIN_GAP + r() * r() * 2.2;
    else if (x < P2) b += 6.5 + r() * 1.6;
    else b += 10.5 + r() * 3.5;
  }
  let prevF = -1e9;
  for (let i = 0; i < bells.length; i++) {
    // +-13 % lob speed -> launch frames jitter by about +-3. Launches stay >= MIN_GAP apart as well: the gap between two
    // lobs changes linearly along the arc, so >= MIN_GAP at both launch and bell keeps it everywhere (no overtaking)
    let fs = 0.87 + 0.26 * r();
    const room = bells[i] - prevF - MIN_GAP;
    if ((tb / fs) * FPS > room) {
      fs = Math.min(1.13, (tb * FPS) / room);
      if ((tb / fs) * FPS > room) bells[i] = prevF + MIN_GAP + (tb / fs) * FPS;
    }
    const f = bells[i] - (tb / fs) * FPS;
    prevF = f;
    const size = 0.95 + r() * 0.1;
    const arcH = -0.18 + r() * 0.5; // the visible lob is ~2.5 u tall: about -7 % .. +13 %
    const arcZ = (r() - 0.5) * 0.4;
    if (f >= RELEASE_STOP) break;
    out.push({f, bell: bells[i], size, seed: i + 2, first: false, fs, arcH, arcZ});
  }
  _rel = out;
  return out;
};
// real seconds since launch -> seconds on the shared track profile (the feed part runs at the lead's own speed)
export const profAge = (rel: Release, f: number) => {
  const a = (f - rel.f) / FPS;
  const tb = feedSec();
  return a * rel.fs < tb ? a * rel.fs : a - tb / rel.fs + tb;
};
// inverse: profile seconds -> real seconds since launch
export const realAge = (rel: Release, pa: number) => {
  const tb = feedSec();
  return pa < tb ? pa / rel.fs : pa - tb + tb / rel.fs;
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

// ---------------------------------------------------------------------------
// Browser heap. A lead drops through the dark slot under the gold intake collar, falls inside the bezel, comes out of
// the chute under the window's top edge, lands on the mound (two settle bounces) and rolls down its slope into its
// slot. Everything stays inside the window: the mound is capped (HEAP_ROWS) and so are the landings.
// ---------------------------------------------------------------------------
const G_HEAP = 30; // visual gravity for the short drop (u/s^2)
const V_DROP = 2.4; // speed through the slot (u/s, downward)
const B1 = 0.16;
const B2 = 0.09;
export const HEAP_SETTLE = B1 + B2; // seconds of bouncing after the first contact (then the roll into the slot)
type HeapPlan = {slot: THREE.Vector3; land: THREE.Vector3; tf: number; tr: number};
let _plan: HeapPlan[] | null = null;
const heapPlan = (): HeapPlan[] => {
  if (_plan) return _plan;
  const L = machineLayout();
  const port = L.box.port;
  const rest = MR * 2 * 0.87; // centre-to-centre height of a lead resting on another
  const capY = L.box.innerBottom + MR + (HEAP_ROWS - 1) * HEAP_ROW; // a landing is never higher than the top row
  const surf = (k: number, x: number) => {
    let y = L.box.innerBottom + MR;
    for (let j = 0; j < k; j++) {
      const s = L.heap[j];
      if (Math.abs(s.x - x) < MR * 1.3) y = Math.max(y, s.y + rest);
    }
    return y;
  };
  _plan = L.heap.map((slot, k) => {
    let land: THREE.Vector3;
    if (Math.abs(slot.x - port.x) < MR * 1.4 && surf(k, slot.x) <= slot.y + 0.02) {
      land = slot.clone(); // its slot is right under the chute: it lands in place
    } else {
      // land on the mound under the chute; once the peak is at the cap, deflect onto the slope
      let x = port.x;
      let y = surf(k, x);
      while (y > capY + 0.01 && x > slot.x) {
        x -= MR;
        y = surf(k, x);
      }
      land = V(x, Math.min(y, capY), 0.02);
    }
    const h = Math.max(0.05, port.y + 0.08 - land.y);
    const tf = (-V_DROP + Math.sqrt(V_DROP * V_DROP + 2 * G_HEAP * h)) / G_HEAP;
    const tr = 0.06 + 0.42 * Math.sqrt(land.distanceTo(slot));
    return {slot, land, tf, tr};
  });
  return _plan;
};
export const heapCapacity = () => machineLayout().heap.length;
// the address bar's gold loading bar completes as the night ends (just before the end-card cut)
let _full = 0;
export const heapFull = () => (_full ||= Math.max(1, heapCount(END - 6)));

export const leadAt = (rel: Release, idx: number, f: number): LeadState | null => {
  const L = machineLayout();
  const P = profile();
  if (f < rel.f) return null;
  const age = profAge(rel, f);
  const q = new THREE.Quaternion();
  if (age < P.total) {
    const d = distAt(age);
    const pos = L.path.at(d).clone();
    pos.y += hopAt(L, d);
    if (d < L.bellEntry) {
      // its own lob: higher / lower and nearer / further, blended out before the bell mouth
      const u = d / L.bellEntry;
      const k = Math.sin(Math.PI * u) * (1 - smooth(0.72, 0.98, u));
      pos.y += rel.arcH * k;
      pos.z += rel.arcZ * k;
    }
    rollQ(L, d, rel.seed, q);
    return {pos, q, scale: rel.size, phase: 'track', d, first: rel.first, idx};
  }
  const k = idx;
  const tau = age - P.total;
  const port = L.box.port;
  if (k >= L.heap.length) {
    // the window is full (end card only): it still drops into the slot and is simply gone inside the bezel
    const y = port.y + 0.08 - V_DROP * tau - 0.5 * G_HEAP * tau * tau;
    if (y < L.box.top - 0.32) return null;
    q.setFromAxisAngle(V(0, 0, 1), (L.path.length + tau * 5) / MR);
    return {pos: V(port.x, y, 0), q, scale: rel.size, phase: 'fall', d: L.path.length, first: rel.first, idx};
  }
  const H = heapPlan()[k];
  if (tau < H.tf) {
    // straight down the chute (x = port), deflected onto the slope only in the last part of the drop
    const y0 = port.y + 0.08;
    const y = Math.max(H.land.y, y0 - V_DROP * tau - 0.5 * G_HEAP * tau * tau);
    const u = clamp01((y0 - y) / Math.max(1e-3, y0 - H.land.y));
    const side = smooth(0.62, 1, u);
    const pos = V(lerp(port.x, H.land.x, side), y, lerp(0, H.land.z, side));
    q.setFromAxisAngle(V(0, 0, 1), (L.path.length + tau * 5) / MR);
    return {pos, q, scale: rel.size, phase: 'fall', d: L.path.length, first: rel.first, idx};
  }
  const r = rng(1000 + rel.seed);
  const spin = r() * 6.28;
  const s = tau - H.tf;
  // two decaying settle bounces where it lands, then it rolls down the mound into its slot (decelerating)
  let by = 0;
  if (s < B1) by = 0.075 * Math.sin((Math.PI * s) / B1);
  else if (s < B1 + B2) by = 0.022 * Math.sin((Math.PI * (s - B1)) / B2);
  const travel = H.land.distanceTo(H.slot);
  const rs = s - HEAP_SETTLE;
  const u = travel < 1e-3 || rs >= H.tr ? 1 : rs <= 0 ? 0 : 1 - Math.pow(1 - rs / H.tr, 2);
  const pos = H.land.clone().lerp(H.slot, u);
  pos.y += by;
  q.setFromAxisAngle(V(0, 0, 1), spin - ((travel * u) / MR) * Math.sign(H.slot.x - H.land.x || -1));
  return {pos, q, scale: rel.size, phase: 'heap', d: L.path.length, first: rel.first, idx};
};

// first contact with the heap (seconds after release)
export const landingAge = (idx: number) => {
  const L = machineLayout();
  if (idx >= L.heap.length) return Infinity;
  return realAge(releases()[idx], profile().total) + heapPlan()[idx].tf;
};

// how full the browser looks (drives the gold loading bar)
export const heapCount = (f: number) => {
  const R = releases();
  let n = 0;
  for (let i = 0; i < R.length; i++) {
    if (f >= R[i].f && (f - R[i].f) / FPS >= landingAge(i)) n++;
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
  // hero: rattles out of the unplugged megaphone during «تبلیغ هم می‌کنی...». It spills toward the camera (drift z 2.0)
  // so it falls in FRONT of the page and the browser, never through them (render.sh collide checks every lost lead)
  out.push({mod: 'ads', f: 98, v: 3.6, size: 1.1, drift: [1.1, 2.0], spin: 1, roll: 2.6, hero: true});
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
    f += 8 + r() * 13;
    i++;
  }
  _lost = out;
  return out;
};

const G_FALL = 9.5;
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
  if (pos.y < -4 || tt > 3.2) return null;
  void P;
  return {pos, q, scale: lead.size, exitF: fe};
};

export {FLOW};
