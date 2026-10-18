import React from 'react';
import * as THREE from 'three';
import {makeCamera, project} from '../camera';
import {Cam, Layout} from '../layout';
import {FLOW, machineLayout} from '../machine/build';
import {leadAt, lostAt, lostLeads, machineMatrix, partPose, releases} from '../machine/motion';

// QA overlay: safe area, projected machine bounds, lead stream bounds (text boxes get dashed outlines)
const rectOf = (pts: [number, number][]) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return {x0, y0, x1, y1};
};
export const Debug: React.FC<{f: number; lay: Layout; cam: Cam}> = ({f, lay, cam}) => {
  const {W, H} = lay;
  const camera = makeCamera(cam, W, H);
  const L = machineLayout();
  const mm = machineMatrix(f);
  const mpts: [number, number][] = [];
  for (const m of FLOW) {
    const b = L.bounds[m];
    const M = partPose(m, f).m.clone().premultiply(mm);
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) mpts.push(project(camera, new THREE.Vector3(x, y, z).applyMatrix4(M), W, H));
  }
  const lpts: [number, number][] = [];
  const R = releases();
  for (let i = 0; i < R.length; i++) {
    const s = leadAt(R[i], i, f);
    if (s) lpts.push(project(camera, s.pos.clone().applyMatrix4(mm), W, H));
  }
  for (const l of lostLeads()) {
    const s = lostAt(l, f);
    if (s) lpts.push(project(camera, s.pos, W, H));
  }
  // the whole feed arc (where leads can be) once the run is on
  if (f > 290) for (let d = 0; d < L.bellEntry; d += 0.1) lpts.push(project(camera, L.path.at(d).clone().applyMatrix4(mm), W, H));
  const inFrame = lpts.filter(([x, y]) => x > -50 && x < W + 50 && y > -50 && y < H + 50);
  const mr = rectOf(mpts);
  const lr = inFrame.length ? rectOf(inFrame) : null;
  const box = (r: {x0: number; y0: number; x1: number; y1: number}, c: string) => (
    <div style={{position: 'absolute', left: r.x0, top: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0, outline: `2px solid ${c}`}} />
  );
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: 'monospace', fontSize: 22, color: '#ff0'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: lay.safe[0], borderTop: '1px solid #0f0'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: lay.safe[1], borderTop: '1px solid #0f0'}} />
      {box(mr, '#f33')}
      {lr && box(lr, '#fa0')}
      {inFrame.map(([x, y], i) => (
        <div key={i} style={{position: 'absolute', left: x - 3, top: y - 3, width: 6, height: 6, background: '#fa0', borderRadius: 3}} />
      ))}
      <div style={{position: 'absolute', left: 12, bottom: 12, background: 'rgba(0,0,0,0.6)', padding: 6}}>
        f{f} machine y {mr.y0.toFixed(0)}..{mr.y1.toFixed(0)} x {mr.x0.toFixed(0)}..{mr.x1.toFixed(0)} {lr ? `leads y ${lr.y0.toFixed(0)}..${lr.y1.toFixed(0)} x ${lr.x0.toFixed(0)}..${lr.x1.toFixed(0)}` : ''}
      </div>
    </div>
  );
};
