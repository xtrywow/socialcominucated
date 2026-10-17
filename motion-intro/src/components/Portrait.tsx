import React from 'react';
import {Img, getStaticFiles, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, FONT, springs} from '../theme';

export const hasPublicFile = (name: string) => getStaticFiles().some((f) => f.name === name);

// عکس در قاب دایره‌ای با حلقهٔ طلایی که رسم می‌شود؛ اگر hossein.png نبود، placeholder «ح ن»
export const Portrait: React.FC<{size: number; start?: number; initials: string}> = ({size, start = 0, initials}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ring = interpolate(frame, [start, start + 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pop = spring({frame: frame - start - 15, fps, config: springs.soft, durationInFrames: 25});
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const photo = hasPublicFile('hossein.png');
  return (
    <div style={{width: size, height: size, position: 'relative', flexShrink: 0}}>
      <div
        style={{
          position: 'absolute',
          inset: 18,
          borderRadius: '50%',
          overflow: 'hidden',
          transform: `scale(${0.8 + 0.2 * pop})`,
          opacity: pop,
          background: `radial-gradient(circle at 50% 35%, ${colors.navy700}, #0C1C36)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photo ? (
          <Img src={staticFile('hossein.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          <span style={{fontFamily: FONT, fontWeight: 900, fontSize: size * 0.26, color: colors.gold500}}>{initials}</span>
        )}
      </div>
      <svg width={size} height={size} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.gold500}
          strokeWidth={5}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ring)}
          strokeLinecap="round"
          style={{filter: `drop-shadow(0 0 10px ${colors.gold500})`}}
        />
      </svg>
    </div>
  );
};
