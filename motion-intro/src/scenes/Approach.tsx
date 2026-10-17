import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {content} from '../content';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {colors, faNumber, SAFE, springs} from '../theme';

const LINE_START = 40;
const LINE_END = 210;
const LOOP_START = 228;
const LOOP_END = 266;

export const Approach: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const L = layout === 'landscape';
  const progress = interpolate(frame, [LINE_START, LINE_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const loop = interpolate(frame, [LOOP_START, LOOP_END], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // ایستگاه‌ها: افقی از راست به چپ، عمودی از بالا به پایین
  const pts = L
    ? [1640, 1187, 733, 280].map((x) => ({x, y: 600}))
    : [640, 940, 1240, 1540].map((y) => ({x: 900, y}));
  const a = pts[0];
  const b = pts[3];
  const linePath = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const loopPath = L
    ? `M ${b.x} ${b.y - 50} C ${b.x + 80} 400, ${a.x - 80} 400, ${a.x} ${a.y - 50}`
    : `M ${b.x + 44} ${b.y} C 1050 ${b.y - 60}, 1050 ${a.y + 60}, ${a.x + 44} ${a.y}`;
  // سر فلش برگشتی
  const head = L ? {x: a.x, y: a.y - 50, rot: 70} : {x: a.x + 44, y: a.y, rot: 200};

  return (
    <Scene seed="approach">
      <div style={{position: 'absolute', top: L ? SAFE.landscape.top + 30 : SAFE.portrait.top + 70, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <WordReveal text={content.approach.heading} layout={layout} size={L ? 76 : 70} weight={900} align="center" />
      </div>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <path d={linePath} stroke={`${colors.slate400}40`} strokeWidth={4} fill="none" />
        <path
          d={linePath}
          stroke={colors.gold500}
          strokeWidth={5}
          fill="none"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
          style={{filter: `drop-shadow(0 0 8px ${colors.gold500})`}}
        />
        <path
          d={loopPath}
          stroke={colors.gold500}
          strokeWidth={4}
          fill="none"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - loop}
          opacity={0.9}
        />
        <g transform={`translate(${head.x} ${head.y}) rotate(${head.rot})`} opacity={loop >= 1 ? 1 : 0}>
          <path d="M -16 -12 L 0 0 L -16 12" stroke={colors.gold500} strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      </svg>
      {pts.map((p, i) => {
        const litAt = LINE_START + (i / 3) * (LINE_END - LINE_START);
        const lit = spring({frame: frame - litAt, fps, config: springs.pop, durationInFrames: 20});
        const text = spring({frame: frame - litAt - 4, fps, config: springs.soft, durationInFrames: 18});
        const step = content.approach.steps[i];
        const node = 84;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: p.x - node / 2,
                top: p.y - node / 2,
                width: node,
                height: node,
                borderRadius: '50%',
                background: frame >= litAt ? colors.gold500 : colors.navy700,
                border: `3px solid ${colors.gold500}`,
                transform: `scale(${0.85 + 0.15 * Math.min(lit, 1.1)})`,
                boxShadow: frame >= litAt ? `0 0 ${30 * Math.min(lit, 1)}px ${colors.gold500}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                fontWeight: 900,
                color: frame >= litAt ? colors.navy900 : colors.gold500,
              }}
            >
              {faNumber(i + 1)}
            </div>
            <div
              style={{
                position: 'absolute',
                ...(L
                  ? {left: p.x - 200, top: p.y + 80, width: 400, textAlign: 'center' as const}
                  : {right: width - (p.x - 76), top: p.y - 64, width: 680, textAlign: 'right' as const}),
                opacity: text,
                transform: `translateY(${(1 - text) * 20}px)`,
              }}
            >
              <div style={{fontSize: L ? 54 : 58, fontWeight: 900, color: colors.gold500}}>{step.title}</div>
              <div style={{fontSize: L ? 34 : 38, fontWeight: 400, color: colors.white, lineHeight: 1.55, marginTop: 8}}>{step.text}</div>
            </div>
          </React.Fragment>
        );
      })}
    </Scene>
  );
};
