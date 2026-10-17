import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';
import {colors} from '../theme';

type Props = Record<string, never>;

// wipe طلایی: صحنهٔ جدید از راست به چپ باز می‌شود و یک نوار طلایی لبه را دنبال می‌کند
const GoldWipeComponent: React.FC<TransitionPresentationComponentProps<Props>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  if (presentationDirection === 'exiting') return <AbsoluteFill>{children}</AbsoluteFill>;
  const edge = 100 - presentationProgress * 100;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{clipPath: `inset(0 0 0 ${edge}%)`}}>{children}</AbsoluteFill>
      {presentationProgress < 1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${edge}% - 8px)`,
            width: 16,
            background: `linear-gradient(90deg, ${colors.gold500}00, ${colors.gold300}, ${colors.gold500}00)`,
            boxShadow: `0 0 40px ${colors.gold500}`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const goldWipe = (): TransitionPresentation<Props> => ({component: GoldWipeComponent, props: {}});
