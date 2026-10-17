import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {content} from '../content';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {colors, faNumber, SAFE, springs} from '../theme';

const MOVE_START = 26;
const MOVE_END = 106;

export const Process: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const L = layout === 'landscape';
  const t = interpolate(frame, [MOVE_START, MOVE_END], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad)});
  const pts = L ? [1560, 960, 360].map((x) => ({x, y: 560})) : [700, 1050, 1400].map((y) => ({x: 880, y}));
  const a = pts[0];
  const b = pts[2];
  const dot = {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
  return (
    <Scene seed="process">
      <div style={{position: 'absolute', top: L ? SAFE.landscape.top + 40 : SAFE.portrait.top + 80, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <WordReveal text={content.process.heading} layout={layout} size={L ? 76 : 70} weight={900} align="center" />
      </div>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={`${colors.slate400}40`} strokeWidth={4} />
        <line x1={a.x} y1={a.y} x2={dot.x} y2={dot.y} stroke={colors.gold500} strokeWidth={5} />
        <circle cx={dot.x} cy={dot.y} r={16} fill={colors.gold300} style={{filter: `drop-shadow(0 0 14px ${colors.gold500})`}} />
      </svg>
      {pts.map((p, i) => {
        const litAt = MOVE_START + (i / 2) * (MOVE_END - MOVE_START);
        const lit = frame >= litAt;
        const s = spring({frame: frame - litAt, fps, config: springs.soft, durationInFrames: 18});
        const step = content.process.steps[i];
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: p.x - 40,
                top: p.y - 40,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: lit ? colors.gold500 : colors.navy700,
                border: `3px solid ${colors.gold500}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 38,
                fontWeight: 900,
                color: lit ? colors.navy900 : colors.gold500,
                boxShadow: lit ? `0 0 28px ${colors.gold500}` : 'none',
              }}
            >
              {faNumber(i + 1)}
            </div>
            <div
              style={{
                position: 'absolute',
                ...(L
                  ? {left: p.x - 230, top: p.y + 76, width: 460, textAlign: 'center' as const}
                  : {right: width - (p.x - 72), top: p.y - 52, width: 700, textAlign: 'right' as const}),
                fontSize: L ? 42 : 48,
                fontWeight: 700,
                color: colors.white,
                lineHeight: 1.55,
                opacity: s,
                transform: `translateY(${(1 - s) * 20}px)`,
              }}
            >
              {step}
            </div>
          </React.Fragment>
        );
      })}
    </Scene>
  );
};
