import React from 'react';
import {interpolate, useCurrentFrame, Easing} from 'remotion';
import {colors} from '../theme';

// خط طلایی که از راست به چپ کشیده می‌شود
export const GoldLine: React.FC<{start: number; duration: number; width: number; style?: React.CSSProperties}> = ({
  start,
  duration,
  width,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div style={{width, height: 4, position: 'relative', ...style}}>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: 4,
          width: width * p,
          borderRadius: 2,
          background: `linear-gradient(270deg, ${colors.gold300}, ${colors.gold500} 60%, ${colors.gold500}00)`,
          boxShadow: `0 0 16px ${colors.gold500}80`,
        }}
      />
    </div>
  );
};
