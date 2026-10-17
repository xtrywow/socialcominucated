import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {content} from '../content';
import {Card} from '../components/Card';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {colors, SAFE, springs} from '../theme';

const CRACK_AT = 230; // فریم ~۶۵۰ کل ویدیو

const CRACKS = ['M 70 0 L 110 60 L 80 110 L 140 170 L 115 240 L 170 320', 'M 180 0 L 150 70 L 200 120 L 160 200 L 210 260 L 190 320', 'M 120 0 L 160 50 L 120 120 L 175 180 L 140 250 L 185 320'];

export const Problem: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = layout === 'landscape';
  const crack = interpolate(frame, [CRACK_AT, CRACK_AT + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shakeWindow = frame >= CRACK_AT && frame < CRACK_AT + 14;
  return (
    <Scene seed="problem">
      <AbsoluteFill
        style={{
          padding: L ? `${SAFE.landscape.top + 40}px ${SAFE.landscape.side}px` : `${SAFE.portrait.top + 80}px ${SAFE.portrait.side}px ${SAFE.portrait.bottom}px`,
          alignItems: 'center',
          gap: L ? 110 : 90,
        }}
      >
        <WordReveal text={content.problem.heading} layout={layout} size={L ? 76 : 70} weight={900} align="center" />
        <div style={{display: 'flex', flexDirection: L ? 'row' : 'column', gap: L ? 44 : 40}}>
          {content.problem.cards.map((text, i) => {
            const enter = spring({frame: frame - (40 + i * 20), fps, config: springs.soft, durationInFrames: 20});
            const shake = shakeWindow ? Math.sin((frame - CRACK_AT) * 2.6 + i) * 9 * (1 - crack) : 0;
            return (
              <div
                key={i}
                style={{
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 40}px) translateX(${shake}px) rotate(${crack * (i - 1) * 1.2}deg)`,
                  filter: `grayscale(${crack * 0.85}) brightness(${1 - crack * 0.15})`,
                }}
              >
                <Card
                  style={{
                    width: L ? 500 : 860,
                    height: L ? 320 : 250,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 44px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{fontSize: L ? 48 : 52, fontWeight: 700, color: colors.white, textAlign: 'center', lineHeight: 1.5}}>{text}</div>
                  <svg
                    viewBox="0 0 250 320"
                    preserveAspectRatio="none"
                    style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
                  >
                    <path
                      d={CRACKS[i]}
                      fill="none"
                      stroke={colors.slate400}
                      strokeWidth={3}
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - crack}
                      opacity={crack > 0 ? 1 : 0}
                      strokeLinejoin="round"
                    />
                  </svg>
                </Card>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
