import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {applyCam} from '../camera';
import {Cam} from '../layout';
import {nightAt} from '../story';
import {END, FPS, LAST_LOCK, NIGHT, PLINTH_LOCK} from '../timeline';
import {FLOW, machineLayout, Mod} from './build';
import {MR} from './geo';
import {LeadInst, Leads} from './Leads';
import {makeMats, Mats, setModulePower, setPlinthPower} from './materials';
import {
  clamp01,
  collarGrow,
  lerp,
  leadAt,
  lockFlash,
  lostAt,
  lostLeads,
  machineMatrix,
  partPose,
  plateRise,
  plinthRise,
  powerFlash,
  powerOf,
  releases,
  rippleAt,
  smooth,
  heapFull,
  heapCount,
  hitFlash,
} from './motion';
import {Channels, Chassis, ContentDeco, machineGeo, Megaphone, SeoDeco, SocialDeco, WebPiece} from './Parts';
import {buildStudioEnv} from './studio';
import {Post} from './Post';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const QUALITY = {pointLights: false};

const CameraRig: React.FC<{cam: Cam}> = ({cam}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    applyCam(camera, cam, size.width, size.height);
  }, [camera, cam, size.width, size.height]);
  return null;
};

const Env: React.FC<{intensity: number}> = ({intensity}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const tex = useMemo(() => buildStudioEnv(gl), [gl]);
  scene.environment = tex;
  scene.environmentIntensity = intensity;
  return null;
};

// a pool of additive glow sprites (bloom stand-ins on emissive gold only)
// nd = no depth test: for flares hugging a curved surface (a depth-tested camera-facing quad would be sliced into
// hard stripes where it cuts through the plinth's rounded front)
type Glow = {p: THREE.Vector3; s: number; o: number; sx?: number; nd?: boolean};
const Glows: React.FC<{items: Glow[]; tex: THREE.Texture}> = ({items, tex}) => {
  const pool = useMemo(
    () =>
      Array.from({length: 48}, (_, i) =>
        new THREE.SpriteMaterial({map: tex, color: new THREE.Color('#ffc66a'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: i % 2 === 0, transparent: true, toneMapped: false}),
      ),
    [tex],
  );
  // even slots depth-tested, odd slots not
  let a = 0;
  let b = 1;
  return (
    <>
      {items.map((g, i) => {
        if (g.o <= 0.004) return null;
        const k = g.nd ? b : a;
        if (k >= pool.length) return null;
        if (g.nd) b += 2;
        else a += 2;
        pool[k].opacity = Math.min(1, g.o);
        return <sprite key={i} position={g.p} scale={[g.sx ?? g.s, g.s, 1]} material={pool[k]} renderOrder={8} />;
      })}
    </>
  );
};

// lens clip: magnified copies are cut to the lens disc (no transmission pass needed)
const lensUniforms = {c: {value: new THREE.Vector3()}, n: {value: new THREE.Vector3(0, 0, 1)}, r: {value: 0.38}};
const clipped = <T extends THREE.Material>(base: T): T => {
  const m = base.clone() as T;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLensC = lensUniforms.c;
    sh.uniforms.uLensN = lensUniforms.n;
    sh.uniforms.uLensR = lensUniforms.r;
    sh.vertexShader =
      'varying vec3 vWP;\n' +
      sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n vec4 wpp = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\n wpp = instanceMatrix * wpp;\n#endif\n vWP = (modelMatrix * wpp).xyz;',
      );
    sh.fragmentShader =
      'uniform vec3 uLensC; uniform vec3 uLensN; uniform float uLensR; varying vec3 vWP;\n' +
      sh.fragmentShader.replace('void main() {', 'void main() {\n vec3 dd = vWP - uLensC; vec3 pp = dd - dot(dd,uLensN)*uLensN; if (length(pp) > uLensR) discard;');
  };
  m.customProgramCacheKey = () => 'lensclip-' + base.type;
  return m;
};

// back wall: deep navy, lifted locally behind the machine (separation for navy-on-navy on a dim phone).
// "Around the clock" (16-23 s): the whole wall grades day -> night together (no angular wipe: a wipe needs a
// start edge, and at 12 o'clock that edge reads as a seam / render bug), while a soft beam of cool light sweeps once
// round the machine like a clock hand. The beam is periodic and smooth on both sides (cos^n lobes: 0 at +-pi, equal
// at the hand), so there is no edge anywhere, and its intensity eases in and out to exactly 0.
const wallMat = new THREE.ShaderMaterial({
  uniforms: {
    uInD: {value: new THREE.Color()},
    uOutD: {value: new THREE.Color()},
    uInN: {value: new THREE.Color()},
    uOutN: {value: new THREE.Color()},
    uHandC: {value: new THREE.Color('#5f7fb8')},
    uC: {value: new THREE.Vector2(0.2, 3.4)},
    uR: {value: new THREE.Vector2(6.5, 7.5)},
    uNight: {value: 0}, // global day -> night grade (0..1)
    uSweep: {value: 0}, // clockwise angle of the hand from 12 o'clock (rad), 0..2pi
    uHand: {value: 0}, // hand intensity
  },
  vertexShader: `varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP = w.xy; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 uInD; uniform vec3 uOutD; uniform vec3 uInN; uniform vec3 uOutN; uniform vec3 uHandC;
    uniform vec2 uC; uniform vec2 uR; uniform float uNight; uniform float uSweep; uniform float uHand; varying vec2 vP;
    const float TAU = 6.2831853;
    const float PI = 3.1415927;
    void main(){
      vec2 q = vP - uC;
      vec2 d = q / uR; float k = clamp(1.0-length(d),0.0,1.0); k = k*k*(3.0-2.0*k);
      vec3 col = mix(mix(uOutD, uInD, k), mix(uOutN, uInN, k), uNight);
      float r = length(q);
      float radial = smoothstep(0.6, 2.6, r) * (1.0 - smoothstep(8.0, 15.0, r));
      // the hand: signed angle to it (clockwise from 12 o'clock, wrapped to -pi..pi)
      float th = atan(q.x, q.y);
      float dh = mod(th - uSweep + PI, TAU) - PI;
      float c = 0.5 + 0.5 * cos(dh);
      float lead = pow(c, 12.0); // leading side: ~0.4 rad soft falloff (no edge reads as a line, even after encoding)
      float trail = pow(c, 2.2); // afterglow behind it: ~0.95 rad
      float hand = (dh > 0.0 ? lead : trail) * radial * uHand;
      col += uHandC * hand * 0.28;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
  depthWrite: true,
});
// floor: shadow-only plane. The shadow fades out with distance from the plinth (back toward the wall and out to the
// sides), so the long key-light wedge never reaches the wall and leaves no hard floor/wall "horizon" line.
const floorShadow = new THREE.ShadowMaterial({color: new THREE.Color('#01050c'), opacity: 0.38, depthWrite: false});
floorShadow.onBeforeCompile = (sh) => {
  sh.vertexShader = 'varying vec2 vFl;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFl = position.xy;');
  sh.fragmentShader =
    'varying vec2 vFl;\n' +
    sh.fragmentShader.replace(
      'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
      // plane local y = -machine z (behind the machine = +y); the wall stands at machine z = -5
      'float fl = (1.0 - smoothstep(0.9, 3.4, vFl.y)) * (1.0 - smoothstep(2.8, 6.0, abs(vFl.x)));\n gl_FragColor = vec4( color, opacity * fl * ( 1.0 - getShadowMask() ) );',
    );
};
floorShadow.customProgramCacheKey = () => 'floorShadowFade';
const TAU = Math.PI * 2;
const MOON = new THREE.Color('#9DB7FF');
const PAPER_NIGHT = new THREE.Color('#c6d0df');
const IVORY_NIGHT = new THREE.Color('#d8e0ed');
const IVORY_DARK_NIGHT = new THREE.Color('#b3becf');
const Wall: React.FC<{f: number; end: number}> = ({f, end}) => {
  const U = wallMat.uniforms;
  U.uInD.value.set('#25436f').lerp(new THREE.Color('#132846'), end);
  U.uOutD.value.set('#0c1a33').lerp(new THREE.Color('#081224'), end);
  U.uInN.value.set('#142749').lerp(new THREE.Color('#132846'), end);
  U.uOutN.value.set('#050d1e').lerp(new THREE.Color('#081224'), end);
  const u = clamp01((f - NIGHT[0]) / (NIGHT[1] - NIGHT[0]));
  U.uNight.value = nightAt(f);
  // a clock hand: one steady turn from 12 o'clock, with a gentle start and stop; its light fades in over ~20 frames
  // and out over ~30 to exactly 0 (no one-frame pop at either end)
  U.uSweep.value = (u * u * (3 - 2 * u) * 0.35 + u * 0.65) * TAU;
  U.uHand.value = end ? 0 : smooth(0, 0.12, u) * (1 - smooth(0.8, 1, u));
  return (
    // Sized to cover every camera of both layouts (needs ~45 x 25 half-extents) while keeping all four corners well in
    // front of the camera (clip w >= 7 on every frame; render.sh wallcheck). The old 220x220 plane put a corner on the
    // camera plane (w = 0.002 at 9:16 f152) and SwiftShader's clipper drew garbage triangles: a one-frame wall flash.
    <mesh position={[0.2, 3.6, -5]} material={wallMat}>
      <planeGeometry args={[120, 80]} />
    </mesh>
  );
};

export const Scene: React.FC<{f: number; cam: Cam; W: number; H: number; q?: string}> = ({f, cam, q = ''}) => {
  const G = machineGeo();
  const L = machineLayout();
  const M: Mats = useMemo(() => makeMats(), []);
  // under the lens the groove reads light (paper) so the magnified leads never sit on near-black
  const magMats = useMemo(() => ({navy: clipped(M.paper), inlay: clipped(M.inlay.seo), marble: clipped(M.marble)}), [M]);
  const night = nightAt(f);
  const isEnd = f >= END;
  const boost = 1 + 0.7 * night;

  // ---------------------------------------------------------------- power + flashes
  const pw = {} as Record<Mod, number>;
  for (const m of FLOW) {
    pw[m] = powerOf(m, f);
    setModulePower(M, m, pw[m], Math.max(powerFlash(m, f), lockFlash(m, f) * 0.7), boost);
  }
  const flash = hitFlash(f);
  setPlinthPower(M, flash, smooth(PLINTH_LOCK, PLINTH_LOCK + 6, f), pw.web, boost);
  magMats.inlay.color.copy(M.inlay.seo.color);
  M.marble.emissiveIntensity = 0.1 + 0.18 * night;
  // paper at night: moonlit cool-neutral, not khaki (the warm env strips and gold glow must not wash it)
  M.paper.color.set('#e2d7bf').lerp(PAPER_NIGHT, night);
  M.ivory.color.set('#ece4d2').lerp(IVORY_NIGHT, night);
  M.ivoryDark.color.set('#d2c6ab').lerp(IVORY_DARK_NIGHT, night);
  M.paper.envMapIntensity = 0.85 * (1 - 0.5 * night);
  M.ivory.envMapIntensity = 0.75 * (1 - 0.22 * night);
  M.ivoryDark.envMapIntensity = 0.7 * (1 - 0.5 * night);
  M.haloM.content.uniforms.uI.value *= 1 - 0.75 * night;
  // the magnified copies under the lens follow the live materials (and the lead stays readable at night)
  magMats.navy.color.copy(M.paper.color);
  magMats.navy.envMapIntensity = M.paper.envMapIntensity;
  magMats.marble.emissiveIntensity = 0.12 + 0.4 * night;
  const powerAll = pw.web;
  const anyPower = pw.ads;

  // ---------------------------------------------------------------- poses
  const poses = useMemo(() => {
    const o = {} as Record<Mod, {pos: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; locked: boolean}>;
    for (const m of FLOW) {
      const pp = partPose(m, f);
      const pos = V();
      const q = new THREE.Quaternion();
      const s = V();
      pp.m.decompose(pos, q, s);
      o[m] = {pos, q, s, locked: pp.locked};
    }
    return o;
  }, [f]);
  const mm = machineMatrix(f);
  const mPos = V();
  const mQ = new THREE.Quaternion();
  const mS = V();
  mm.decompose(mPos, mQ, mS);
  const rise = plinthRise(f);
  const plate = plateRise(f);

  // ---------------------------------------------------------------- leads
  const leads: LeadInst[] = [];
  const mag: LeadInst[] = [];
  const glows: Glow[] = [];
  const R = releases();
  const lensC = L.seo.lens;
  const MAG = 1.42;
  const magZ = lensC.z - 0.14;
  let pathfinder: THREE.Vector3 | null = null;
  for (let i = 0; i < R.length; i++) {
    if (R[i].f > f) continue; // launch order is not arrival order (each lob has its own speed)
    const st = leadAt(R[i], i, f);
    if (!st) continue;
    const moving = st.phase !== 'heap';
    const trail = moving ? [0.18, 0.36, 0.54].map((dt) => leadAt(R[i], i, f - dt)?.pos ?? st.pos) : undefined;
    leads.push({pos: st.pos, q: st.q, s: st.scale, trail, blob: st.phase === 'track'});
    if (st.first && st.phase === 'track') pathfinder = st.pos;
    // magnified copy behind the lens
    if (st.phase === 'track' && Math.abs(st.pos.x - lensC.x) < 0.8 && Math.abs(st.pos.y - lensC.y) < 0.6) {
      const mp = V(lensC.x + (st.pos.x - lensC.x) * MAG, lensC.y + (st.pos.y - lensC.y) * MAG, magZ + (st.pos.z) * 0.3);
      mag.push({pos: mp, q: st.q, s: st.scale * MAG});
    }
  }
  if (f < 300) {
    for (const lead of lostLeads()) {
      const st = lostAt(lead, f);
      if (!st) continue;
      const trail = [0.2, 0.4, 0.6].map((dt) => lostAt(lead, f - dt)?.pos ?? st.pos);
      leads.push({pos: st.pos, q: st.q, s: st.scale * 1.3, trail});
      // a lost lead is the only gold in the scattered world: give it a faint glow so it reads on a phone
      glows.push({p: st.pos.clone().add(V(0, 0, 0.12)), s: lead.hero ? 1.25 : 0.9, o: lead.hero ? 0.65 : 0.48});
    }
  }

  // ---------------------------------------------------------------- glows (emissive gold only)
  for (const h of L.handoffs) {
    const p = Math.min(pw[h.from], pw[h.to]);
    const fl = Math.max(lockFlash(h.from, f), lockFlash(h.to, f));
    const pf = powerFlash(h.to, f);
    const onPaper = h.to === 'content' || h.from === 'content';
    const o = (0.32 * p + 0.9 * fl + 0.6 * pf) * (onPaper ? 1 + 0.15 * night : boost);
    if (o > 0.01 && poses[h.from].locked && poses[h.to].locked) glows.push({p: h.pos.clone().add(V(0, 0, 0.12)), s: 0.95 + 0.6 * fl, o});
  }
  if (pathfinder) glows.push({p: pathfinder.clone().add(V(0, 0, 0.1)), s: 0.85, o: 0.75});
  {
    // THE click: the plinth lands and its gold band ignites -> a 2-3 frame additive flare along the band front
    // (a row of hot points + one wide anamorphic streak), then a soft afterglow
    if (flash > 0.01) {
      const zF = L.plinth.d / 2 + L.plinth.zc + 0.06;
      const yB = rise.y - 0.19;
      for (let i = 0; i < 7; i++) {
        const x = (i / 6 - 0.5) * (L.plinth.w - 0.9);
        glows.push({p: V(x, yB, zF), s: 0.9 + 0.5 * flash, o: 0.95 * flash * (1 - 0.35 * Math.abs(i / 6 - 0.5) * 2), nd: true});
      }
      glows.push({p: V(0, yB, zF + 0.05), s: 1.0, sx: 9.5 * (0.7 + 0.3 * flash), o: 0.85 * flash, nd: true});
    }
    const t = f - PLINTH_LOCK;
    if (t >= 0 && t < 18) glows.push({p: V(0, 0.02, L.plinth.d / 2 + L.plinth.zc), s: 3.2, o: 0.45 * Math.exp(-t / 5), nd: true});
    glows.push({p: L.box.port.clone().add(V(0, 0.08, 0.15)), s: 0.8, o: 0.35 * pw.web * boost});
  }
  if (powerAll > 0.01) {
    // the heap glows a little more at night (relative emissive)
    const hc = heapCount(f) / L.heap.length;
    glows.push({p: V(L.box.port.x - 0.6, L.box.cy - L.box.h / 2 + 0.45, 0.35), s: 1.6 + 2.2 * hc, o: (0.1 + 0.25 * night) * Math.min(1, hc * 3)});
  }

  // lens: world-space clip uniforms (lens follows the seo part and the wobble)
  const seoLocked = poses.seo.locked;
  {
    const seoM = new THREE.Matrix4().compose(poses.seo.pos, poses.seo.q, poses.seo.s);
    lensUniforms.c.value.copy(lensC).applyMatrix4(seoM).applyMatrix4(mm);
    lensUniforms.n.value.set(0, 0, 1).transformDirection(seoM).transformDirection(mm);
    lensUniforms.r.value = L.seo.r - 0.03;
  }

  // ---------------------------------------------------------------- lights
  // day: warm key, upper-right front. Night: a cool moon key (#9DB7FF) from higher upper-right, more raking
  const keyDir = V(lerp(0.5, 0.7, night), lerp(0.78, 0.82, night), lerp(0.62, 0.3, night)).normalize();
  const keyCol = new THREE.Color('#fff0da').lerp(new THREE.Color('#9DB7FF'), night);
  const keyI = lerp(2.5, 1.55, night);
  const tgt = V(0, 3.4, 0);
  const keyPos = tgt.clone().addScaledVector(keyDir, 14);
  const keyLight = useMemo(() => {
    const l = new THREE.DirectionalLight();
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    const sc = l.shadow.camera as THREE.OrthographicCamera;
    sc.left = -4.6;
    sc.right = 4.6;
    sc.top = 5.2;
    sc.bottom = -5.2;
    sc.near = 2;
    sc.far = 30;
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.025;
    return l;
  }, []);
  keyLight.position.copy(keyPos);
  keyLight.target.position.copy(tgt);
  keyLight.target.updateMatrixWorld();
  keyLight.color.copy(keyCol);
  keyLight.intensity = keyI;
  const warmPt = (0.4 + 0.6 * powerAll) * anyPower;

  const floorY = -L.plinth.h + 0.005;
  floorShadow.opacity = 0.38 * smooth(LAST_LOCK - 2, LAST_LOCK + 14, f);
  const rip = rippleAt(f);
  M.ripple.opacity = rip >= 0 ? Math.pow(1 - rip, 1.6) * 0.9 : 0;
  const ripR = 2.7 + (rip >= 0 ? rip : 0) * 5.5;
  const assembled = rise.visible;

  return (
    <>
      <CameraRig cam={cam} />
      {q.includes('fxaa') && <Post />}
      <Env intensity={lerp(1.0, 0.45, night) * (isEnd ? 0.9 : 1)} />
      <Wall f={f} end={isEnd ? 1 : 0} />
      <ambientLight intensity={0.05} color="#9fb4dd" />
      <primitive object={keyLight} />
      <primitive object={keyLight.target} />
      {/* cool rim + kicker: navy edges stay readable against the navy wall */}
      <directionalLight position={[-6, 6, -5]} intensity={lerp(1.7, 1.45, night)} color="#a8c4ff" />
      {/* moon rim from the upper right at night */}
      <directionalLight position={[7, lerp(3, 6, night), -4]} intensity={lerp(0.9, 1.6, night)} color={new THREE.Color('#b9cdf5').lerp(MOON, night)} />
      <directionalLight position={[-2, 1, 9]} intensity={lerp(0.35, 0.18, night)} color="#e8eefc" />
      {warmPt > 0.01 && QUALITY.pointLights && (
        <>
          <pointLight position={[0.4, 4.8, 1.8]} intensity={9 * warmPt * boost} distance={6} decay={1.5} color="#ffbf62" />
          <pointLight position={[0.3, 1.3, 1.9]} intensity={7 * warmPt * boost} distance={5} decay={1.5} color="#ffbf62" />
        </>
      )}

      <group position={mPos} quaternion={mQ}>
        {assembled && (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow material={floorShadow}>
              <planeGeometry args={[30, 30]} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY + 0.002, L.plinth.zc]} scale={[7.2 * rise.s, 3.2 * rise.s, 1]} material={M.blob} renderOrder={1}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          </>
        )}
        {M.ripple.opacity > 0.005 && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY + 0.004, L.plinth.zc]} scale={[1.18, 1, 1]} material={M.ripple}>
            <ringGeometry args={[ripR, ripR + 0.018 + (rip ?? 0) * 0.02, 160]} />
          </mesh>
        )}
        <Chassis G={G} M={M} rise={rise} plate={plate} power={anyPower * (0.35 + 0.65 * powerAll)} phase={-(f / FPS) * 0.9} />

        <group position={poses.ads.pos} quaternion={poses.ads.q} scale={poses.ads.s}>
          <Megaphone G={G} M={M} />
          <Channels g={G.ch.ads} M={M} m="ads" collarScale={collarGrow('ads', f)} powered={pw.ads > 0.01} />
        </group>
        <group position={poses.social.pos} quaternion={poses.social.q} scale={poses.social.s}>
          <Channels g={G.ch.social} M={M} m="social" collarScale={collarGrow('social', f)} powered={pw.social > 0.01} />
          <SocialDeco G={G} M={M} />
        </group>
        <group position={poses.content.pos} quaternion={poses.content.q} scale={poses.content.s}>
          <Channels g={G.ch.content} M={M} m="content" collarScale={collarGrow('content', f)} powered={pw.content > 0.01} body={M.paper} />
          <ContentDeco G={G} M={M} />
        </group>
        <group position={poses.seo.pos} quaternion={poses.seo.q} scale={poses.seo.s}>
          <Channels g={G.ch.seo} M={M} m="seo" collarScale={collarGrow('seo', f)} powered={pw.seo > 0.01} />
          <SeoDeco G={G} M={M} refract={false} />
          {seoLocked && !isEnd && (
            // magnified view inside the lens: channel + inlay + leads, scaled about the lens centre
            <group position={[lensC.x, lensC.y, magZ]} scale={[MAG, MAG, 0.3]}>
              <group position={[-lensC.x, -lensC.y, 0]}>
                <mesh geometry={G.ch.seo[0].body} material={magMats.navy} />
                <mesh geometry={G.ch.seo[0].inlay} material={magMats.inlay} />
              </group>
            </group>
          )}
          {seoLocked && !isEnd && mag.length > 0 && <MagLeads items={mag} mat={magMats.marble} />}
        </group>
        <group position={poses.web.pos} quaternion={poses.web.q} scale={poses.web.s}>
          <WebPiece G={G} M={M} load={Math.min(1, heapCount(f) / heapFull())} />
        </group>

        <Leads items={leads} M={M} ghosts={!q.includes('noghost')} />
        {!q.includes('noglow') && <Glows items={glows} tex={M.glowTex} />}
      </group>
    </>
  );
};

const MagLeads: React.FC<{items: LeadInst[]; mat: THREE.Material}> = ({items, mat}) => {
  const geo = useMemo(() => new THREE.SphereGeometry(MR, 20, 12), []);
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} geometry={geo} material={mat} position={it.pos} quaternion={it.q} scale={it.s} renderOrder={2} />
      ))}
    </>
  );
};
