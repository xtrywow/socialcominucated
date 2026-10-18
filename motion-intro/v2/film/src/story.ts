import {Cam, Layout, lerpCam} from './layout';
import {clamp01, easeInOut, hitKick, smooth} from './machine/motion';
import {CAM_PUSH, END, NIGHT} from './timeline';

// camera over the whole film (pure; also used by the debug overlay)
export const camAt = (lay: Layout, f: number): Cam => {
  const C = lay.cams;
  if (f >= END) {
    // cut on the hit to a closer end framing, then a quick pull back that settles by ~24.1 s
    const u = clamp01((f - END) / 34);
    const e = 1 - Math.pow(1 - u, 3);
    return lerpCam(C.endA, C.endB, e);
  }
  // F1: very slow drift; snap: push-in + ~15 deg orbit
  const push = easeInOut(clamp01((f - CAM_PUSH[0]) / (CAM_PUSH[1] - CAM_PUSH[0])));
  let c = lerpCam(C.f1, C.run, push);
  if (f < CAM_PUSH[1]) {
    const drift = (f / 258) * 2.5;
    c = {...c, yaw: c.yaw - drift * (1 - push)};
  }
  const late = smooth(450, END - 4, f);
  c = lerpCam(c, C.late, late);
  const k = hitKick(f);
  if (k) c = {...c, anchor: [c.anchor[0], c.anchor[1] + k]};
  return c;
};

export const nightAt = (f: number) => smooth(NIGHT[0], NIGHT[1], f);
