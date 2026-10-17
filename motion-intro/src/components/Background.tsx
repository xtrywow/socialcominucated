import React from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors} from '../theme';

// گرید نقطه‌ای کم‌رنگ + گرادیان شعاعی + ذرات طلایی آهسته
export const Background: React.FC<{seed: string; freezeAt?: number}> = ({seed, freezeAt}) => {
  const raw = useCurrentFrame();
  const frame = freezeAt !== undefined ? Math.min(raw, freezeAt) : raw;
  const {width, height} = useVideoConfig();
  const particles = new Array(26).fill(0).map((_, i) => {
    const x = random(`${seed}-x-${i}`) * width;
    const y0 = random(`${seed}-y-${i}`) * height;
    const speed = 0.15 + random(`${seed}-s-${i}`) * 0.35;
    const size = 2 + random(`${seed}-r-${i}`) * 4;
    const y = (((y0 - frame * speed) % height) + height) % height;
    const drift = Math.sin((frame + i * 40) / 60) * 12;
    const alpha = 0.15 + random(`${seed}-a-${i}`) * 0.35;
    return {x: x + drift, y, size, alpha};
  });
  return (
    <AbsoluteFill style={{backgroundColor: colors.navy900}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${colors.navy700} 0%, ${colors.navy900} 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${colors.slate400}22 1.5px, transparent 1.5px)`,
          backgroundSize: '36px 36px',
        }}
      />
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: colors.gold300,
            opacity: p.alpha,
            boxShadow: `0 0 ${p.size * 3}px ${colors.gold500}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
