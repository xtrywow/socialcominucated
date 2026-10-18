import {ThreeCanvas} from '@remotion/three';
import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, getStaticFiles, interpolate, staticFile, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {loadFonts} from './fonts';
import {LayoutId, LAYOUTS} from './layout';
import {Scene} from './machine/Scene';
import {Captions} from './overlay/Captions';
import {Debug} from './overlay/Debug';
import {EndCard} from './overlay/EndCard';
import {Finish} from './overlay/Finish';
import {camAt} from './story';
import {END, FREEZE, machineTime} from './timeline';

loadFonts();

const STEMS = ['audio/voice.wav', 'audio/music.wav', 'audio/sfx.wav'];
const Stems: React.FC = () => {
  const have = new Set(getStaticFiles().map((f) => f.name));
  return (
    <>
      {STEMS.filter((s) => have.has(s)).map((s) => (
        <Audio key={s} src={staticFile(s)} volume={1} />
      ))}
    </>
  );
};

export type FilmProps = {layout: LayoutId; debug?: boolean; q?: string};

export const Film: React.FC<FilmProps> = ({layout, debug, q = ''}) => {
  const frame = useCurrentFrame();
  const F = Math.min(frame, FREEZE); // 840..899: everything frozen (cover frame)
  const lay = LAYOUTS[layout];
  const fm = machineTime(F);
  const cam = useMemo(() => camAt(lay, F), [lay, F]);
  const gl = useMemo(() => ({antialias: !q.includes('noaa'), preserveDrawingBuffer: true, powerPreference: 'high-performance' as const}), [q]);
  const blur = F >= END ? lay.end.blur * interpolate(F, [END, END + 12], [0.4, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  return (
    <AbsoluteFill dir="rtl" lang="fa" style={{backgroundColor: '#0A1628'}}>
      <AbsoluteFill dir="ltr" style={{filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined}}>
        <ThreeCanvas
          width={lay.W}
          height={lay.H}
          shadows={!q.includes('noshadow')}
          dpr={1}
          gl={gl}
          camera={{position: [0, 3, 30], fov: 24, near: 0.5, far: 200}}
          onCreated={(st) => {
            st.gl.toneMapping = THREE.ACESFilmicToneMapping;
            st.gl.toneMappingExposure = 1.0;
            st.gl.shadowMap.type = THREE.PCFShadowMap;
          }}
        >
          <Scene f={fm} cam={cam} W={lay.W} H={lay.H} q={q} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Captions frame={F} lay={lay} debug={debug} />
      <EndCard frame={F} lay={lay} debug={debug} />
      {!q.includes('nofinish') && <Finish frame={F} W={lay.W} H={lay.H} vignette={F >= END ? 0.32 : 0.42} />}
      {debug && <Debug f={fm} lay={lay} cam={cam} />}
      <Stems />
    </AbsoluteFill>
  );
};
