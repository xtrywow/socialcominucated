import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Cpu} from 'lucide-react';
import {content} from '../content';
import {Icon} from '../components/Icon';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {colors, SAFE, springs} from '../theme';

const CORE_AT = 36;
const NODE_AT = 66;
const NODE_GAP = 18;
const CAPTION_AT = 190;

export const AIScene: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const L = layout === 'landscape';
  const cx = width / 2;
  const cy = L ? 610 : 1040;
  const rx = L ? 540 : 320;
  const ry = L ? 260 : 400;
  const core = spring({frame: frame - CORE_AT, fps, config: springs.pop, durationInFrames: 30});
  const coreR = L ? 120 : 130;
  const caption = interpolate(frame, [CAPTION_AT, CAPTION_AT + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const nodes = content.ai.nodes.map((n, i) => {
    const angle = (-90 - i * 72) * (Math.PI / 180);
    return {...n, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), at: NODE_AT + i * NODE_GAP};
  });

  return (
    <Scene seed="ai">
      <div style={{position: 'absolute', top: L ? SAFE.landscape.top : SAFE.portrait.top + 50, left: 60, right: 60, display: 'flex', justifyContent: 'center'}}>
        <WordReveal text={content.ai.heading} layout={layout} size={L ? 66 : 64} weight={900} align="center" />
      </div>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        {nodes.map((n, i) => {
          const draw = interpolate(frame, [n.at, n.at + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <g key={i}>
              <line
                x1={cx}
                y1={cy}
                x2={cx + (n.x - cx) * draw}
                y2={cy + (n.y - cy) * draw}
                stroke={`${colors.gold500}70`}
                strokeWidth={3}
              />
              {draw >= 1 &&
                [0, 1, 2].map((k) => {
                  // جریان پیوستهٔ داده روی خط (رفت از گره به هسته)
                  const period = 48;
                  const t = ((frame + k * 16 + i * 7) % period) / period;
                  const px = n.x + (cx - n.x) * t;
                  const py = n.y + (cy - n.y) * t;
                  return <circle key={k} cx={px} cy={py} r={6} fill={colors.gold300} style={{filter: `drop-shadow(0 0 8px ${colors.gold500})`}} />;
                })}
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: cx - coreR,
          top: cy - coreR,
          width: coreR * 2,
          height: coreR * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.gold300} 0%, ${colors.gold500} 70%)`,
          boxShadow: `0 0 ${60 + 20 * Math.sin(frame / 10)}px ${colors.gold500}aa`,
          transform: `scale(${core})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Cpu size={L ? 56 : 60} color={colors.navy900} strokeWidth={1.8} />
        <div style={{fontSize: L ? 36 : 38, fontWeight: 900, color: colors.navy900}}>{content.ai.core}</div>
      </div>
      {nodes.map((n, i) => {
        const p = spring({frame: frame - n.at - 10, fps, config: springs.soft, durationInFrames: 18});
        const w = L ? 360 : 320;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: n.x - w / 2,
              top: n.y - 46,
              width: w,
              minHeight: 92,
              padding: '14px 22px',
              borderRadius: 46,
              background: colors.navy700,
              border: `2px solid ${colors.gold500}`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              opacity: p,
              transform: `scale(${0.85 + 0.15 * p})`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
          >
            <Icon name={n.icon} size={L ? 40 : 40} />
            <div style={{fontSize: L ? 30 : 30, fontWeight: 700, color: colors.white, lineHeight: 1.35}}>{n.text}</div>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: L ? SAFE.landscape.bottom : SAFE.portrait.bottom + 40,
          textAlign: 'center',
          fontSize: L ? 40 : 42,
          fontWeight: 700,
          color: colors.slate400,
          opacity: caption,
          transform: `translateY(${(1 - caption) * 20}px)`,
        }}
      >
        {content.ai.caption}
      </div>
    </Scene>
  );
};
