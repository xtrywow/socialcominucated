import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {MR} from './geo';
import {Mats} from './materials';

// One instanced draw for every lead (track, heap, falling), no shadow casting;
// three trailing instanced "ghost" passes = multi-sample motion blur; contact blobs instead of shadows.
export type LeadInst = {pos: THREE.Vector3; q: THREE.Quaternion; s: number; trail?: THREE.Vector3[]; blob?: boolean};

const MAX = 220;
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const BLOB_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.98, 0, 0));

export const Leads: React.FC<{items: LeadInst[]; M: Mats; ghosts?: boolean}> = ({items, M, ghosts: showGhosts = true}) => {
  const geo = useMemo(() => new THREE.SphereGeometry(MR, 22, 14), []);
  const ghostGeo = useMemo(() => new THREE.SphereGeometry(MR, 14, 9), []);
  const blobGeo = useMemo(() => new THREE.PlaneGeometry(MR * 3.2, MR * 3.2), []);
  const main = useRef<THREE.InstancedMesh>(null);
  const ghosts = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const blobs = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mm = main.current;
    if (!mm) return;
    const n = Math.min(MAX, items.length);
    let nb = 0;
    let ng = 0;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      _s.setScalar(it.s);
      _m.compose(it.pos, it.q, _s);
      mm.setMatrixAt(i, _m);
      // ghosts only for leads that actually move this frame (compact instance list)
      if (it.trail && it.trail[0].distanceTo(it.pos) > MR * 0.25) {
        for (let k = 0; k < 3; k++) {
          const tp = it.trail[k];
          _m.compose(tp, it.q, _s);
          ghosts[k].current!.setMatrixAt(ng, _m);
        }
        ng++;
      }
      if (it.blob && blobs.current) {
        _m.compose(new THREE.Vector3(it.pos.x, it.pos.y - MR * 0.86 * it.s, it.pos.z - MR * 0.5), BLOB_Q, _s);
        blobs.current.setMatrixAt(nb++, _m);
      }
    }
    mm.count = n;
    mm.instanceMatrix.needsUpdate = true;
    for (const g of ghosts) {
      g.current!.count = ng;
      g.current!.instanceMatrix.needsUpdate = true;
    }
    if (blobs.current) {
      blobs.current.count = nb;
      blobs.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh ref={blobs} args={[blobGeo, M.blob, MAX]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={main} args={[geo, M.marble, MAX]} frustumCulled={false} />
      {ghosts.map((g, k) => (
        <instancedMesh key={k} ref={g} args={[ghostGeo, M.ghost[k], MAX]} frustumCulled={false} renderOrder={4 + k} visible={showGhosts} />
      ))}
    </group>
  );
};
