import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {colors} from '../theme';

// پالس طلایی دور آیکون در لحظهٔ ورود
export const IconPulse: React.FC<{at: number; size: number; children: React.ReactNode}> = ({at, size, children}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${colors.gold500}`,
          transform: `scale(${0.8 + t * 0.7})`,
          opacity: t > 0 && t < 1 ? 1 - t : 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `${colors.gold500}14`,
          border: `1.5px solid ${colors.gold500}55`,
        }}
      />
      {children}
    </div>
  );
};
