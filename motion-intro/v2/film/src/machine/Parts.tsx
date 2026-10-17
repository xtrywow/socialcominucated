import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Channel, machineLayout, MachineLayout, Mod} from './build';
import {channelProfile, CR, CW, LIP, roundedRectPath, roundedRectShape, sweep} from './geo';
import {Mats} from './materials';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Geometry, built once per page
// ---------------------------------------------------------------------------
type ChGeo = {body: THREE.BufferGeometry; collars: {geo: THREE.BufferGeometry; at: THREE.Vector3}[]; inlay: THREE.BufferGeometry; halo: THREE.BufferGeometry};

let _geo: ReturnType<typeof buildGeo> | null = null;
export const machineGeo = () => {
  if (!_geo) _geo = buildGeo();
  return _geo;
};

const buildGeo = () => {
  const L = machineLayout();
  const prof = channelProfile();
  const collarProf = channelProfile(CR + CW - 0.006, 0.05, LIP + 0.02, 12);
  const chGeo = (c: Channel): ChGeo => {
    const body = sweep(c.pts, c.frames, prof, {capStart: c.capStart, capEnd: c.capEnd});
    const collars: ChGeo['collars'] = [];
    const nC = 3;
    if (c.collarStart) collars.push({geo: sweep(c.pts, c.frames, collarProf, {from: 0, to: nC, capStart: true, capEnd: true}), at: c.pts[0].clone()});
    if (c.collarEnd) collars.push({geo: sweep(c.pts, c.frames, collarProf, {from: c.pts.length - 1 - nC, to: c.pts.length - 1, capStart: true, capEnd: true}), at: c.pts[c.pts.length - 1].clone()});
    // the current: a thin line on the inner back wall (marbles ride in front of it)
    const inl = c.pts.map((p, i) => {
      const back = c.frames.S[i].z < 0 ? 1 : -1;
      const a = Math.PI + 0.5;
      return p
        .clone()
        .addScaledVector(c.frames.S[i], back * -Math.cos(a) * (CR - 0.004))
        .addScaledVector(c.frames.N[i], Math.sin(a) * (CR - 0.004));
    });
    const curve = new THREE.CatmullRomCurve3(inl.slice(2, -2));
    const segs = Math.max(8, Math.floor(inl.length * 0.7));
    const inlay = new THREE.TubeGeometry(curve, segs, 0.013, 5, false);
    const halo = new THREE.TubeGeometry(curve, segs, 0.055, 8, false);
    return {body, collars, inlay, halo};
  };
  const ch = {} as Record<Mod, ChGeo[]>;
  for (const m of ['ads', 'social', 'content', 'seo', 'web'] as Mod[]) ch[m] = L.ch[m].map(chGeo);

  // megaphone: straight cone + driver housing (not a trumpet flare)
  const {r0, r1, L: mL} = L.meg;
  const lp: THREE.Vector2[] = [];
  const lpo: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    const r = r0 + (r1 - r0) * u;
    lp.push(new THREE.Vector2(r, u * mL));
    lpo.push(new THREE.Vector2(r + 0.045, u * mL));
  }
  const megIn = new THREE.LatheGeometry(lp, 40);
  const megOut = new THREE.LatheGeometry(lpo, 40);

  // content page, RTL document: dog-ear on the top-LEFT
  const pg = L.page;
  const fold = pg.fold;
  const ps = new THREE.Shape();
  {
    const r = 0.1;
    ps.moveTo(pg.x0 + r, pg.y0);
    ps.lineTo(pg.x1 - r, pg.y0);
    ps.quadraticCurveTo(pg.x1, pg.y0, pg.x1, pg.y0 + r);
    ps.lineTo(pg.x1, pg.y1 - r);
    ps.quadraticCurveTo(pg.x1, pg.y1, pg.x1 - r, pg.y1);
    ps.lineTo(pg.x0 + fold, pg.y1);
    ps.lineTo(pg.x0, pg.y1 - fold);
    ps.lineTo(pg.x0, pg.y0 + r);
    ps.quadraticCurveTo(pg.x0, pg.y0, pg.x0 + r, pg.y0);
  }
  const pageGeo = new THREE.ExtrudeGeometry(ps, {depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4});
  const flapShape = new THREE.Shape();
  flapShape.moveTo(pg.x0 + fold, pg.y1);
  flapShape.lineTo(pg.x0 + fold, pg.y1 - fold + 0.06);
  flapShape.quadraticCurveTo(pg.x0 + fold, pg.y1 - fold, pg.x0 + fold - 0.06, pg.y1 - fold);
  flapShape.lineTo(pg.x0, pg.y1 - fold);
  flapShape.lineTo(pg.x0 + fold, pg.y1);
  const flapGeo = new THREE.ExtrudeGeometry(flapShape, {depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1});
  const flapShadow = new THREE.ShapeGeometry(flapShape);
  const head = pg.head;
  const headGeo = new THREE.ExtrudeGeometry(roundedRectShape(head[2] - head[0], head[3] - head[1], 0.06, (head[0] + head[2]) / 2, (head[1] + head[3]) / 2), {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  const lineGeos = pg.lines.map(([x0, y, x1]) =>
    new THREE.ExtrudeGeometry(roundedRectShape(x1 - x0, 0.07, 0.035, (x0 + x1) / 2, y), {depth: 0.02, bevelEnabled: false}),
  );

  // seo: light search card behind the ramp (so the lens never goes black)
  const sp = L.seo.panel;
  const seoPanel = new THREE.ExtrudeGeometry(roundedRectShape(sp[2] - sp[0], sp[3] - sp[1], 0.24, (sp[0] + sp[2]) / 2, (sp[1] + sp[3]) / 2), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });

  // browser
  const b = L.box;
  const fr = roundedRectShape(b.w, b.h, 0.2, b.cx, b.cy);
  const win = roundedRectPath(b.w - 0.24, b.h - b.bar - 0.12, 0.1, b.cx, b.cy - b.bar / 2);
  fr.holes.push(win);
  const frameGeo = new THREE.ExtrudeGeometry(fr, {depth: b.depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6});
  const backGeo = new THREE.ExtrudeGeometry(roundedRectShape(b.w - 0.1, b.h - 0.1, 0.16, b.cx, b.cy), {depth: 0.05, bevelEnabled: false, curveSegments: 6});
  const urlGeo = new THREE.ExtrudeGeometry(roundedRectShape(1.5, 0.15, 0.075, 0, 0), {depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2});
  const loadGeo = new THREE.BoxGeometry(1, 0.085, 0.02);
  loadGeo.translate(0.5, 0, 0);

  // chassis
  const pl = L.plinth;
  const stadium = (w: number, d: number) => roundedRectShape(w, d, d / 2 - 0.001, 0, 0);
  const plinthGeo = new THREE.ExtrudeGeometry(stadium(pl.w, pl.d), {depth: pl.h - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 16});
  plinthGeo.rotateX(Math.PI / 2); // extrude along -y
  plinthGeo.translate(0, -0.02, pl.zc);
  const bandShape = stadium(pl.w + 0.05, pl.d + 0.05);
  bandShape.holes.push(roundedRectPath(pl.w - 0.01, pl.d - 0.01, (pl.d - 0.01) / 2 - 0.001, 0, 0));
  const bandGeo = new THREE.ExtrudeGeometry(bandShape, {depth: 0.05, bevelEnabled: false, curveSegments: 16});
  bandGeo.rotateX(Math.PI / 2);
  bandGeo.translate(0, -0.17, pl.zc);
  // inlay light: a ring inset on the plinth top
  const ringPts: THREE.Vector3[] = [];
  {
    const w = pl.w - 0.34;
    const d = pl.d - 0.34;
    const r = d / 2;
    const half = w / 2 - r;
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // stadium perimeter param by angle-ish
      const cx = Math.cos(a) >= 0 ? half : -half;
      ringPts.push(V(cx + Math.cos(a) * r, 0.006, pl.zc + Math.sin(a) * r));
    }
  }
  const ringCurve = new THREE.CatmullRomCurve3(ringPts, true);
  const ringGeo = new THREE.TubeGeometry(ringCurve, 120, 0.02, 5, true);
  const ringFlowGeo = new THREE.TubeGeometry(ringCurve, 120, 0.034, 6, true);
  const pt = L.plate;
  const plateGeo = new THREE.ExtrudeGeometry(roundedRectShape(pt.x1 - pt.x0, pt.y1 - pt.y0, 0.32, (pt.x0 + pt.x1) / 2, (pt.y0 + pt.y1) / 2), {
    depth: pt.t,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 8,
  });
  plateGeo.translate(0, 0, pt.z);
  const railCurve = new THREE.CatmullRomCurve3(L.rail);
  const railGeo = new THREE.TubeGeometry(railCurve, 90, 0.034, 7, false);
  const railFlowGeo = new THREE.TubeGeometry(railCurve, 90, 0.05, 8, false);

  // heart badge (ownable "like" badge on the loop, no platform glyph)
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.12);
  hs.bezierCurveTo(-0.02, -0.1, -0.15, -0.02, -0.15, 0.05);
  hs.bezierCurveTo(-0.15, 0.12, -0.09, 0.15, -0.05, 0.15);
  hs.bezierCurveTo(-0.02, 0.15, 0, 0.12, 0, 0.1);
  hs.bezierCurveTo(0, 0.12, 0.02, 0.15, 0.05, 0.15);
  hs.bezierCurveTo(0.09, 0.15, 0.15, 0.12, 0.15, 0.05);
  hs.bezierCurveTo(0.15, -0.02, 0.02, -0.1, 0, -0.12);
  const heartGeo = new THREE.ExtrudeGeometry(hs, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 3, curveSegments: 8});
  // badge = rounded bubble with a little tail toward the loop corner
  const bubble = new THREE.Shape();
  {
    const r = 0.25;
    bubble.absarc(0, 0, r, -Math.PI * 0.62, Math.PI * 1.25, false);
    bubble.lineTo(-0.27, -0.27);
    bubble.closePath();
  }
  const bubbleGeo = new THREE.ExtrudeGeometry(bubble, {depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16});

  return {L, ch, megIn, megOut, pageGeo, flapGeo, flapShadow, headGeo, lineGeos, seoPanel, frameGeo, backGeo, urlGeo, loadGeo, plinthGeo, bandGeo, ringGeo, ringFlowGeo, plateGeo, railGeo, railFlowGeo, heartGeo, bubbleGeo};
};
export type MachineGeo = ReturnType<typeof buildGeo>;

// ---------------------------------------------------------------------------
// Renderers (machine space)
// ---------------------------------------------------------------------------
export const Channels: React.FC<{g: ChGeo[]; M: Mats; m: Mod; collarScale: number; powered: boolean}> = ({g, M, m, collarScale, powered}) => (
  <>
    {g.map((c, i) => (
      <group key={i}>
        <mesh geometry={c.body} material={M.navy} castShadow receiveShadow />
        {c.collars.map((cg, j) => (
          <group key={j} position={cg.at} scale={collarScale}>
            <mesh geometry={cg.geo} position={[-cg.at.x, -cg.at.y, -cg.at.z]} material={M.collar[m]} castShadow />
          </group>
        ))}
        <mesh geometry={c.inlay} material={M.inlay[m]} />
        {powered && <mesh geometry={c.halo} material={M.haloM[m]} renderOrder={5} />}
      </group>
    ))}
  </>
);

export const Megaphone: React.FC<{G: MachineGeo; M: Mats}> = ({G, M}) => {
  const {D, axis, down, L: mL, r1} = G.L.meg;
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis), [axis]);
  const handlePos = D.clone().addScaledVector(axis, 0.42).addScaledVector(down, 0.42);
  const hq = useMemo(() => new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), down.clone().addScaledVector(axis, -0.25).normalize()), [down, axis]);
  const driverC = D.clone().addScaledVector(axis, -0.15);
  return (
    <group>
      <group position={D} quaternion={q}>
        <mesh geometry={G.megIn} material={M.ivoryBack} receiveShadow />
        <mesh geometry={G.megOut} material={M.navy} castShadow receiveShadow />
        {/* bell rim (accent) */}
        <mesh position={[0, mL, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.accent.ads.mat} castShadow>
          <torusGeometry args={[r1 + 0.03, 0.04, 12, 56]} />
        </mesh>
      </group>
      {/* driver housing: a squat cylinder, closed at the back */}
      <group position={driverC} quaternion={q}>
        <mesh material={M.navy} castShadow receiveShadow>
          <cylinderGeometry args={[0.31, 0.31, 0.36, 36]} />
        </mesh>
        <mesh position={[0, -0.18, 0]} scale={[1, 0.32, 1]} material={M.navy} castShadow>
          <sphereGeometry args={[0.31, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.accent.ads.mat}>
          <torusGeometry args={[0.315, 0.024, 10, 40]} />
        </mesh>
      </group>
      {/* spout: driver underside -> outlet channel */}
      <mesh position={[D.x + 0.05, D.y - 0.26, -0.03]} material={M.navy} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.2, 20]} />
      </mesh>
      {/* pistol grip + trigger */}
      <mesh position={handlePos} quaternion={hq} material={M.navy} castShadow>
        <capsuleGeometry args={[0.075, 0.3, 6, 14]} />
      </mesh>
      <mesh position={handlePos.clone().addScaledVector(axis, 0.11).addScaledVector(down, -0.08)} quaternion={hq} material={M.accent.ads.mat}>
        <boxGeometry args={[0.05, 0.13, 0.05]} />
      </mesh>
    </group>
  );
};

export const SocialDeco: React.FC<{G: MachineGeo; M: Mats}> = ({G, M}) => {
  const h = G.L.loop.heart;
  return (
    <group position={[h.x + 0.16, h.y + 0.14, h.z - 0.05]} rotation={[0, -0.12, 0]}>
      <mesh geometry={G.bubbleGeo} material={M.navy} castShadow />
      <mesh geometry={G.heartGeo} position={[0, -0.01, 0.12]} material={M.accent.social.mat} />
    </group>
  );
};

export const ContentDeco: React.FC<{G: MachineGeo; M: Mats}> = ({G, M}) => {
  const pg = G.L.page;
  return (
    <group>
      <mesh geometry={G.pageGeo} position={[0, 0, pg.z - 0.082]} material={M.ivory} castShadow receiveShadow />
      {/* dog-ear: the folded flap (paper back side) lifted off the page, with its shadow */}
      <mesh geometry={G.flapShadow} position={[0.035, -0.035, pg.z + 0.003]}>
        <meshBasicMaterial color="#0a1628" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group position={[pg.x0 + pg.fold, pg.y1, pg.z + 0.004]} rotation={[0.0, 0.18, 0]}>
        <mesh geometry={G.flapGeo} position={[-(pg.x0 + pg.fold), -pg.y1, 0]} material={M.ivoryDark} castShadow />
      </group>
      <mesh geometry={G.headGeo} position={[0, 0, pg.z - 0.012]} material={M.accent.content.mat} castShadow />
      {G.lineGeos.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0, pg.z - 0.01]} material={M.slate} />
      ))}
    </group>
  );
};

export const SeoDeco: React.FC<{G: MachineGeo; M: Mats; refract: boolean}> = ({G, M, refract}) => {
  const {lens, r, handleAng, z} = G.L.seo;
  const a = handleAng;
  const dir = V(Math.cos(a), Math.sin(a), 0);
  const hStart = lens.clone().addScaledVector(dir, r + 0.04);
  const hLen = 0.6;
  const hMid = hStart.clone().addScaledVector(dir, hLen * 0.5);
  const hq = useMemo(() => new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir), [a]);
  return (
    <group>
      <mesh geometry={G.seoPanel} position={[0, 0, z - 0.075]} material={M.ivory} receiveShadow />
      <mesh position={lens} material={M.accent.seo.mat} castShadow>
        <torusGeometry args={[r, 0.052, 14, 64]} />
      </mesh>
      <mesh position={lens} scale={[1, 1, 0.22]} material={refract ? M.glass : M.glassCheap} renderOrder={refract ? 0 : 6}>
        <sphereGeometry args={[r - 0.012, 40, 20]} />
      </mesh>
      <mesh position={[lens.x - r * 0.38, lens.y + r * 0.4, lens.z + 0.1]} rotation={[0, 0, 0.6]}>
        <torusGeometry args={[r * 0.66, 0.012, 6, 24, 0.9]} />
        <meshBasicMaterial color="#fff6e0" transparent opacity={0.65} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={hMid} quaternion={hq} material={M.navy} castShadow>
        <capsuleGeometry args={[0.075, hLen - 0.1, 6, 14]} />
      </mesh>
      <mesh position={hStart.clone().addScaledVector(dir, 0.04)} quaternion={hq} material={M.accent.seo.mat} castShadow>
        <cylinderGeometry args={[0.088, 0.088, 0.1, 20]} />
      </mesh>
    </group>
  );
};

export const WebPiece: React.FC<{G: MachineGeo; M: Mats; load: number}> = ({G, M, load}) => {
  const b = G.L.box;
  const barY = b.cy + b.h / 2 - b.bar / 2 - 0.05;
  const x0 = b.cx - b.w / 2 + 0.3;
  const front = b.z0 + b.depth + 0.03;
  const urlX = b.cx + 0.28;
  return (
    <group>
      <mesh geometry={G.backGeo} position={[0, 0, b.z0 - 0.02]} material={M.ivory} receiveShadow />
      <mesh geometry={G.frameGeo} position={[0, 0, b.z0]} material={M.navy} castShadow receiveShadow />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[x0 + i * 0.21, barY, front + 0.01]} rotation={[Math.PI / 2, 0, 0]} material={M.accent.web.mat}>
          <cylinderGeometry args={[0.058, 0.058, 0.03, 20]} />
        </mesh>
      ))}
      {/* address pill: slate track, gold loading bar fills as leads arrive */}
      <mesh geometry={G.urlGeo} position={[urlX, barY, front - 0.005]} material={M.slateDim} />
      {load > 0.003 && <mesh geometry={G.loadGeo} position={[urlX - 0.7, barY, front + 0.022]} scale={[1.4 * Math.min(1, load), 1, 1]} material={M.loadBar} />}
      {/* intake port collar on top */}
      <mesh position={[b.port.x, b.top + 0.035, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.collar.web} castShadow>
        <torusGeometry args={[CR + 0.03, 0.04, 10, 36]} />
      </mesh>
    </group>
  );
};

export const Chassis: React.FC<{G: MachineGeo; M: Mats; rise: {y: number; s: number; visible: boolean}; plate: number; power: number; phase: number}> = ({G, M, rise, plate, power, phase}) => {
  if (!rise.visible) return null;
  const pt = G.L.plate;
  M.flow.opacity = power;
  (M.flow.map as THREE.Texture).offset.x = phase;
  M.flowPlinth.opacity = power;
  (M.flowPlinth.map as THREE.Texture).offset.x = phase * 0.6;
  return (
    <group>
      <group position={[0, rise.y, 0]} scale={[rise.s, 1, rise.s]}>
        <mesh geometry={G.plinthGeo} material={M.plinth} castShadow receiveShadow />
        <mesh geometry={G.bandGeo} material={M.gold} />
        <mesh geometry={G.ringGeo} material={M.inlay.web} />
        {power > 0.01 && <mesh geometry={G.ringFlowGeo} material={M.flowPlinth} />}
      </group>
      {plate > 0.001 && (
        <group position={[0, pt.y0, 0]} scale={[1, Math.max(0.001, plate), 1]}>
          <group position={[0, -pt.y0, 0]}>
            <mesh geometry={G.plateGeo} material={M.navyMatte} receiveShadow />
            <mesh geometry={G.railGeo} material={M.railGold} />
            {power > 0.01 && <mesh geometry={G.railFlowGeo} material={M.flow} />}
          </group>
        </group>
      )}
    </group>
  );
};

export type {ChGeo, MachineLayout};
