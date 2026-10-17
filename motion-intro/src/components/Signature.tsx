import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {content} from '../content';
import {colors, FONT} from '../theme';

export const Signature: React.FC<{start: number; size?: number; align?: 'right' | 'center' | 'left'}> = ({
  start,
  size = 30,
  align = 'right',
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [start, start + 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div dir="ltr" style={{fontFamily: FONT, opacity: o, textAlign: align, letterSpacing: 2}}>
      <span style={{color: colors.white, fontWeight: 700, fontSize: size}}>{content.signature.name}</span>
      <span style={{color: colors.gold500, fontSize: size, margin: '0 14px'}}>/</span>
      <span style={{color: colors.slate400, fontWeight: 400, fontSize: size}}>{content.signature.role}</span>
    </div>
  );
};
