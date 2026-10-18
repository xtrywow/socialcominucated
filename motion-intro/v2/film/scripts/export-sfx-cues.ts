// Screen positions for the sound designer: where each sound-worthy event sits on screen (both layouts).
// `render.sh cues` writes build/sfx-cues.json (used by the SFX synth to pan by screen x).
import * as THREE from 'three';
import {makeCamera, project} from '../src/camera';
import {LAYOUTS, LayoutId} from '../src/layout';
import {FLOW, LOCK_ORDER, machineLayout, Mod} from '../src/machine/build';
import {distAt, landingAge, realAge, leadAt, lockFrame, lostAt, lostLeads, machineMatrix, partPose, powerFrame, profile, releases} from '../src/machine/motion';
import {camAt} from '../src/story';
import {FPS, FREEZE, machineTime, PLINTH_LOCK, videoFrameOf} from '../src/timeline';
import {FLIGHT} from '../src/timeline';

const L = machineLayout();
const P = profile();
const R = releases();

// screen x (0..1) of a world point at video frame f
const sx = (id: LayoutId, f: number, p: THREE.Vector3) => {
  const lay = LAYOUTS[id];
  const cam = makeCamera(camAt(lay, f), lay.W, lay.H);
  const [x, y] = project(cam, p, lay.W, lay.H);
  return {x: +(x / lay.W).toFixed(3), y: +(y / lay.H).toFixed(3)};
};
const both = (f: number, p: THREE.Vector3) => ({'9x16': sx('9x16', f, p), '16x9': sx('16x9', f, p)});

const partCentre = (m: Mod, f: number) => {
  const b = L.bounds[m].getCenter(new THREE.Vector3());
  return b.applyMatrix4(partPose(m, f).m).applyMatrix4(machineMatrix(f));
};

const parts = LOCK_ORDER.map((m) => {
  const lock = lockFrame(m);
  const launch = lock - FLIGHT;
  // flight path samples (whoosh panning)
  const path = [] as {f: number; '9x16': {x: number; y: number}; '16x9': {x: number; y: number}}[];
  for (let f = launch - 2; f <= lock; f++) path.push({f, ...both(f, partCentre(m, f))});
  return {mod: m, lock, launch, atLock: both(lock, partCentre(m, lock)), path, powerOn: powerFrame(m), atPower: both(powerFrame(m), partCentre(m, powerFrame(m)))};
});

const lost = lostLeads().map((l) => {
  const st0 = lostAt(l, l.f);
  const exitF = st0 ? st0.exitF : l.f;
  const st = lostAt(l, Math.ceil(exitF)) ?? st0;
  return {mod: l.mod, start: l.f, exit: +exitF.toFixed(2), size: l.size, hero: !!l.hero, pos: st ? both(Math.ceil(exitF), st.pos) : null};
});

const hops = [] as {f: number; lead: number; size: number; h: string; pos: unknown}[];
const lands = [] as {f: number; lead: number; size: number; pos: unknown}[];
for (let i = 0; i < R.length; i++) {
  for (const h of L.handoffs) {
    const mid = (h.d0 + h.d1) / 2;
    let lo = 0;
    let hi = P.total;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (distAt(m) < mid) lo = m;
      else hi = m;
    }
    const f = videoFrameOf(R[i].f + realAge(R[i], lo) * FPS);
    if (f < FREEZE) hops.push({f: +f.toFixed(2), lead: i, size: R[i].size, h: `${h.from}>${h.to}`, pos: both(Math.round(f), h.pos.clone().applyMatrix4(machineMatrix(Math.round(f))))});
  }
  const la = landingAge(i);
  if (Number.isFinite(la)) {
    const f = videoFrameOf(R[i].f + la * FPS);
    if (f < FREEZE) {
      const st = leadAt(R[i], i, machineTime(Math.round(f)));
      lands.push({f: +f.toFixed(2), lead: i, size: R[i].size, pos: st ? both(Math.round(f), st.pos) : null});
    }
  }
}
hops.sort((a, b) => a.f - b.f);
lands.sort((a, b) => a.f - b.f);

const plinth = both(PLINTH_LOCK, new THREE.Vector3(0, -L.plinth.h, 0));
process.stdout.write(JSON.stringify({fps: FPS, flow: FLOW, plinth: {f: PLINTH_LOCK, pos: plinth}, parts, lost, hops, lands}, null, 1) + '\n');
