import * as THREE from 'three';
import {bez, computeFrames, CR, CW, dirDeg, FrameMode, Frames, MR, Polyline, Turtle} from './geo';

// ---------------------------------------------------------------------------
// The assembled machine, in MACHINE SPACE (units). Pure data: no React, no DOM,
// so events.ts / scripts can import it in node.
//   y up, plinth top at y = 0, channel plane z = 0, camera looks from +z.
//   Flow (top -> bottom): ads (megaphone) -> social (loop) -> content (page)
//   -> seo (lens ramp) -> web (browser that collects the leads).
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export type Mod = 'ads' | 'social' | 'content' | 'seo' | 'web';
export const FLOW: Mod[] = ['ads', 'social', 'content', 'seo', 'web'];
// assembly order: bottom -> top (the machine is built up from the plinth)
export const LOCK_ORDER: Mod[] = ['web', 'seo', 'content', 'social', 'ads'];

export type Channel = {
  pts: THREE.Vector3[];
  frames: Frames;
  capStart: boolean;
  capEnd: boolean;
  collarStart: boolean;
  collarEnd: boolean;
};

export type SectionId = Mod | 'feed' | 'gap';
export type Section = {id: SectionId; d0: number; d1: number};
export type Handoff = {from: Mod; to: Mod; d0: number; d1: number; pos: THREE.Vector3};

export type MachineLayout = {
  ch: Record<Mod, Channel[]>;
  path: Polyline;
  sections: Section[];
  handoffs: Handoff[];
  impacts: number[]; // path distances where a falling lead lands on the next track (energy loss)
  bellEntry: number; // distance where the lead enters the megaphone bell
  meg: {D: THREE.Vector3; axis: THREE.Vector3; down: THREE.Vector3; L: number; r0: number; r1: number};
  loop: {x0: number; x1: number; y0: number; y1: number; z: number; heart: THREE.Vector3};
  page: {x0: number; x1: number; y0: number; y1: number; z: number; fold: number; head: [number, number, number, number]; lines: [number, number, number][]};
  seo: {panel: [number, number, number, number]; z: number; lens: THREE.Vector3; r: number; handleAng: number};
  box: {cx: number; cy: number; w: number; h: number; z0: number; depth: number; top: number; port: THREE.Vector3; bar: number};
  heap: THREE.Vector3[];
  plinth: {w: number; d: number; h: number; zc: number};
  plate: {x0: number; x1: number; y0: number; y1: number; z: number; t: number};
  rail: THREE.Vector3[];
  pivots: Record<Mod, THREE.Vector3>;
  // F1: where a lead leaves each (unconnected) module: point + direction, machine space
  outlets: Record<Mod, {p: THREE.Vector3; dir: THREE.Vector3}>;
  bounds: Record<Mod, THREE.Box3>;
  all: THREE.Box3;
};

const UPM: FrameMode = {mode: 'up', tilt: 0.62};

const mkChannel = (pts: THREE.Vector3[], fm: FrameMode, o: Partial<Channel> = {}): Channel => ({
  pts,
  frames: computeFrames(pts, fm),
  capStart: true,
  capEnd: true,
  collarStart: false,
  collarEnd: false,
  ...o,
});

// marble centre line of a channel: bottom of the U
const centres = (c: Channel) => c.pts.map((p, i) => p.clone().addScaledVector(c.frames.N[i], -(CR - MR)));

let _cache: MachineLayout | null = null;
export const machineLayout = (): MachineLayout => {
  if (_cache) return _cache;
  _cache = build();
  return _cache;
};

const build = (): MachineLayout => {
  // ------------------------------------------------------------ WEB (browser)
  const box = {cx: 0.05, w: 3.6, h: 1.55, y0: 0.1, z0: -0.32, depth: 0.58, bar: 0.34};
  const boxTop = box.y0 + box.h;
  const boxCy = box.y0 + box.h / 2;
  const port = V(box.cx + box.w / 2 - 0.44, boxTop + 0.02, 0);

  // ------------------------------------------------------------ SEO ramp (left -> right)
  const SEO_Y = 2.66;
  const seoStart = V(-1.86, SEO_Y, 0);
  const tS = new Turtle(seoStart, dirDeg(-3.0));
  tS.line(3.05);
  const seoCh = mkChannel(tS.slice(0), UPM, {collarStart: true, collarEnd: true});
  const seoEnd = tS.p.clone();

  // ------------------------------------------------------------ CONTENT: three switchback grooves on a page
  const RAMP = 2.8;
  const SL = 3.3;
  const r3s = V(1.4, SEO_Y + 0.75, 0);
  // build bottom-up so the stack sits right above the seo ramp
  const r3e = r3s.clone().add(dirDeg(180 + SL).multiplyScalar(RAMP));
  const r2e = V(r3s.x - 0.15, r3s.y + 0.5, 0);
  const r2s = r2e.clone().add(dirDeg(180 - SL).multiplyScalar(RAMP));
  // ramp 1 ends on the left above ramp 2's start; it starts on the right
  const r1e = V(r2s.x + 0.15, r2s.y + 0.5, 0);
  const r1s = r1e.clone().add(dirDeg(SL).multiplyScalar(RAMP));
  const t1 = new Turtle(r1s, dirDeg(180 + SL));
  t1.line(RAMP);
  const t2 = new Turtle(r2s, dirDeg(-SL));
  t2.line(RAMP);
  const t3 = new Turtle(r3s, dirDeg(180 + SL));
  t3.line(RAMP);
  const ramp1 = mkChannel(t1.slice(0), UPM, {collarStart: true});
  const ramp2 = mkChannel(t2.slice(0), UPM);
  const ramp3 = mkChannel(t3.slice(0), UPM, {collarEnd: true});

  const pageX0 = Math.min(r1e.x, r2s.x, r3e.x) + 0.2;
  const pageX1 = Math.max(r1s.x, r2e.x, r3s.x) - 0.2;
  const pageY1 = r1s.y + 0.62;
  const pageY0 = r3e.y - 0.36;
  const page = {
    x0: pageX0,
    x1: pageX1,
    y0: pageY0,
    y1: pageY1,
    z: -0.215,
    fold: 0.58,
    // RTL headline bar: right-aligned under the top edge
    head: [pageX1 - 1.55, r1s.y + 0.27, pageX1 - 0.22, r1s.y + 0.44] as [number, number, number, number],
    lines: [] as [number, number, number][],
  };
  // short "text" hairlines (RTL: flush right, ragged left), between the grooves
  {
    page.lines.push([pageX1 - 1.0, pageY0 + 0.2, pageX1 - 0.22]);
    page.lines.push([pageX1 - 1.9, pageY0 + 0.2 - 0.0, pageX1 - 1.15]);
  }

  // ------------------------------------------------------------ SOCIAL: rounded-square loop
  const LS = 0.52; // side
  const LR = 0.29; // corner radius
  const LOOP_DZ = 0.46;

  // ------------------------------------------------------------ ADS: megaphone (cone, not a flare)
  const D = V(-1.12, r1s.y + 1.52, -0.05); // driver centre (rear of the cone)
  const axis = dirDeg(147); // driver -> bell, up-left
  const L = 1.12;
  const r0 = 0.25;
  const r1 = 0.6;
  const down = V(-axis.y, axis.x, 0);
  if (down.y > 0) down.negate();

  // outlet: drops out of the driver's underside and turns to run right into the loop
  const outStart = V(D.x + 0.06, D.y - 0.36, 0);
  const tA = new Turtle(outStart, dirDeg(-62));
  tA.line(0.06).arcZ(62, 0.32).line(0.3);
  const adsCh = mkChannel(tA.slice(0), UPM, {collarEnd: true});
  const E = tA.p.clone(); // hand-off ads -> social

  const tL = new Turtle(E, dirDeg(0));
  const a = LS + LR + 0.14;
  const loopLen = 4 * (Math.PI / 2) * LR + 3 * LS;
  const k = LOOP_DZ / loopLen;
  tL.line(a);
  tL.arcZ(90, LR, k * (Math.PI / 2) * LR).line(LS, k * LS);
  tL.arcZ(90, LR, k * (Math.PI / 2) * LR).line(LS, k * LS);
  tL.arcZ(90, LR, k * (Math.PI / 2) * LR).line(LS, k * LS);
  tL.arcZ(90, LR, k * (Math.PI / 2) * LR);
  const exitX = r1s.x - 0.08;
  tL.line(exitX - tL.p.x);
  const socialCh = mkChannel(tL.slice(0), {mode: 'plane', side: V(0, 0, 1), tilt: 0.4}, {collarStart: true, collarEnd: true});
  const loopX1 = E.x + a + LR;
  const loopX0 = loopX1 - (LS + 2 * LR);
  const loop = {x0: loopX0, x1: loopX1, y0: E.y, y1: E.y + LS + 2 * LR, z: LOOP_DZ / 2, heart: V(loopX1 - 0.02, E.y + LS + 2 * LR + 0.02, LOOP_DZ + 0.12)};

  // ------------------------------------------------------------ marble path
  const megBottom = (u: number) => {
    const rad = r0 + (r1 - r0) * u;
    return D.clone().addScaledVector(axis, L * u).addScaledVector(down, rad - MR - 0.035);
  };
  const P: THREE.Vector3[] = [];
  const sections: Section[] = [];
  let acc = 0;
  const pushPts = (id: SectionId, pts: THREE.Vector3[]) => {
    const d0 = acc;
    for (const p of pts) {
      if (P.length) acc += p.distanceTo(P[P.length - 1]);
      P.push(p);
    }
    sections.push({id, d0, d1: acc});
    return {d0, d1: acc};
  };
  // feed: a lead is lobbed in from off-frame left on a ballistic arc into the bell
  const bellIn = megBottom(0.92).add(V(0, 0.16, 0));
  const launch = V(bellIn.x - 3.1, bellIn.y - 1.2, 0.35);
  const apex = V((launch.x + bellIn.x) / 2 + 0.25, bellIn.y + 0.95, 0.2);
  const feed: THREE.Vector3[] = [];
  for (let x = launch.x - 1.6; x < launch.x; x += 0.2) feed.push(V(x, launch.y - (launch.x - x) * 0.9, launch.z));
  feed.push(...bez(launch, apex, bellIn, 30));
  pushPts('feed', feed);
  const bellEntry = acc;
  const cone: THREE.Vector3[] = [];
  for (let u = 0.86; u >= 0.0; u -= 0.05) cone.push(megBottom(u));
  const aCent = centres(adsCh);
  const coneDrop = bez(megBottom(0), V(megBottom(0).x + 0.02, (megBottom(0).y + aCent[0].y) / 2, -0.02), aCent[0], 8).slice(1, -1);
  const impacts: number[] = [];
  pushPts('ads', [...cone, ...coneDrop]);
  impacts.push(acc + 0.02);
  const adsSec = pushPts('ads', aCent);
  const handoffs: Handoff[] = [];
  const sCent = centres(socialCh);
  // ads -> social: the two collars meet at E, the lead hops the seam
  const hA = acc;
  const sSec = pushPts('social', sCent);
  handoffs.push({from: 'ads', to: 'social', d0: hA - 0.18, d1: hA + 0.18, pos: E.clone()});
  void adsSec;
  void sSec;
  const drop = (a0: THREE.Vector3, b0: THREE.Vector3, h: THREE.Vector3, n = 12) =>
    bez(a0, a0.clone().addScaledVector(h, 0.22).add(V(0, 0.05, 0)), b0, n).slice(1, -1);
  const c1 = centres(ramp1);
  const c2 = centres(ramp2);
  const c3 = centres(ramp3);
  const cs = centres(seoCh);
  // social -> content
  {
    const from = acc;
    pushPts('gap', drop(P[P.length - 1], c1[0], dirDeg(0)));
    impacts.push(acc + 0.02);
    handoffs.push({from: 'social', to: 'content', d0: from - 0.05, d1: from + 0.45, pos: P[P.length - 1].clone()});
  }
  pushPts('content', c1);
  pushPts('content', drop(c1[c1.length - 1], c2[0], dirDeg(180 + SL)));
  impacts.push(acc + 0.02);
  pushPts('content', c2);
  pushPts('content', drop(c2[c2.length - 1], c3[0], dirDeg(-SL)));
  impacts.push(acc + 0.02);
  pushPts('content', c3);
  {
    const from = acc;
    pushPts('gap', drop(c3[c3.length - 1], cs[0], dirDeg(180 + SL)));
    impacts.push(acc + 0.02);
    handoffs.push({from: 'content', to: 'seo', d0: from - 0.05, d1: from + 0.4, pos: c3[c3.length - 1].clone()});
  }
  pushPts('seo', cs);
  {
    const from = acc;
    const last = cs[cs.length - 1];
    pushPts('gap', bez(last, last.clone().add(V(0.14, 0.04, 0)), port.clone().add(V(0, 0.08, 0)), 10).slice(1));
    handoffs.push({from: 'seo', to: 'web', d0: from - 0.05, d1: from + 0.35, pos: last.clone()});
  }
  const path = new Polyline(P);

  // ------------------------------------------------------------ heap slots inside the browser window
  const heap: THREE.Vector3[] = [];
  {
    const innerBottom = box.y0 + 0.13;
    const innerLeft = box.cx - box.w / 2 + 0.2;
    const innerRight = box.cx + box.w / 2 - 0.2;
    const d = MR * 2.04;
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let row = 0; row < 5; row++) {
      for (const zz of [0.11, -0.1]) {
        const off = (row % 2) * MR + (zz > 0 ? MR * 0.5 : 0);
        for (let x = innerLeft + MR + off; x < innerRight - MR; x += d) {
          // heap profile: tallest under the port, sloping away to the left
          const dist = Math.abs(x - port.x);
          const maxRows = 1 + Math.floor(Math.max(0, 4.6 - dist * 1.25));
          if (row >= Math.min(5, maxRows)) continue;
          heap.push(V(x + (rnd() - 0.5) * 0.025, innerBottom + MR + row * MR * 1.74 + (rnd() - 0.5) * 0.012, zz + (rnd() - 0.5) * 0.03));
        }
      }
    }
    heap.sort((p, q) => {
      const kp = (p.y - innerBottom) * 2.4 + Math.abs(p.x - port.x) * 1.0 + (p.z < 0 ? -0.05 : 0);
      const kq = (q.y - innerBottom) * 2.4 + Math.abs(q.x - port.x) * 1.0 + (q.z < 0 ? -0.05 : 0);
      return kp - kq;
    });
  }

  // ------------------------------------------------------------ chassis: plinth, backplate, gold rail
  const plinth = {w: 4.7, d: 1.55, h: 0.42, zc: -0.12};
  const plate = {x0: -2.02, x1: 2.0, y0: 0.0, y1: loop.y0 + 0.62, z: -0.6, t: 0.12};
  const rail: THREE.Vector3[] = [];
  {
    const zr = plate.z + plate.t + 0.02;
    const xr = plate.x1 - 0.12;
    const top = plate.y1 - 0.12;
    // from the megaphone mount along the top edge, round the corner, down the spine to the plinth
    const tR = new Turtle(V(D.x + 0.15, top, zr), V(1, 0, 0));
    tR.step = 0.08;
    tR.line(xr - 0.3 - (D.x + 0.15)).arcZ(-90, 0.3).line(top - 0.3 - 0.06);
    rail.push(...tR.pts);
  }

  // ------------------------------------------------------------ bookkeeping
  const pivots: Record<Mod, THREE.Vector3> = {
    ads: D.clone().addScaledVector(axis, 0.4),
    social: V((loop.x0 + loop.x1) / 2, (loop.y0 + loop.y1) / 2, 0.2),
    content: V((page.x0 + page.x1) / 2, (page.y0 + page.y1) / 2, 0),
    seo: V((seoStart.x + seoEnd.x) / 2, SEO_Y, 0),
    web: V(box.cx, boxCy, 0),
  };
  const lastOf = (c: Channel) => ({p: centres(c)[c.pts.length - 1], dir: c.frames.T[c.pts.length - 1].clone()});
  const outlets: MachineLayout['outlets'] = {
    ads: lastOf(adsCh),
    social: lastOf(socialCh),
    content: lastOf(ramp3),
    seo: lastOf(seoCh),
    web: {p: port.clone(), dir: V(0, -1, 0)},
  };
  const bb = (pts: THREE.Vector3[], pad = 0.2) => new THREE.Box3().setFromPoints(pts).expandByScalar(pad);
  const megPts = [D.clone().addScaledVector(axis, -0.35), D.clone().addScaledVector(axis, L).addScaledVector(down, r1), D.clone().addScaledVector(axis, L).addScaledVector(down, -r1), D.clone().addScaledVector(down, 0.6)];
  const bounds: Record<Mod, THREE.Box3> = {
    ads: bb([...adsCh.pts, ...megPts], 0.2),
    social: bb([...socialCh.pts, V(loop.x0, loop.y1, 0), loop.heart], 0.25),
    content: bb([V(page.x0, page.y0, 0), V(page.x1, page.y1, 0), ...ramp1.pts, ...ramp3.pts], 0.2),
    seo: bb([...seoCh.pts, V(-1.95, 2.25, 0), V(1.5, 2.95, 0.6)], 0.15),
    web: bb([V(box.cx - box.w / 2, box.y0, 0), V(box.cx + box.w / 2, boxTop, 0.3)], 0.1),
  };
  const all = new THREE.Box3();
  for (const m of FLOW) all.union(bounds[m]);
  all.expandByPoint(V(-plinth.w / 2, -plinth.h, 0)).expandByPoint(V(plinth.w / 2, -plinth.h, 0));

  return {
    ch: {ads: [adsCh], social: [socialCh], content: [ramp1, ramp2, ramp3], seo: [seoCh], web: []},
    path,
    sections,
    handoffs,
    impacts,
    bellEntry,
    meg: {D, axis, down, L, r0, r1},
    loop,
    page,
    seo: {panel: [-2.0, SEO_Y - 0.36, 1.58, SEO_Y + 0.26], z: -0.24, lens: V(-0.62, SEO_Y + 0.02, 0.5), r: 0.4, handleAng: -0.85},
    box: {cx: box.cx, cy: boxCy, w: box.w, h: box.h, z0: box.z0, depth: box.depth, top: boxTop, port, bar: box.bar},
    heap,
    plinth,
    plate,
    rail,
    pivots,
    outlets,
    bounds,
    all,
  };
};

export const sectionAt = (L: MachineLayout, d: number): SectionId => {
  for (const s of L.sections) if (d >= s.d0 && d < s.d1) return s.id;
  return 'web';
};

// first distance at which the path enters a module (for power-on as the first lead passes)
export const modEntry = (L: MachineLayout, m: Mod) => {
  if (m === 'web') return L.path.length;
  const s = L.sections.find((x) => x.id === m);
  return s ? s.d0 : 0;
};
export {CW};
