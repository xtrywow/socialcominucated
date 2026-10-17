import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {content} from '../content';
import {Card} from '../components/Card';
import {Icon} from '../components/Icon';
import {IconPulse} from '../components/IconPulse';
import {Scene, SceneProps} from '../components/Scene';
import {BidiText, WordReveal} from '../components/WordReveal';
import {colors, SAFE, springs} from '../theme';

const WAVE = [40, 96];
const SHRINK_AT = 400; // ~۱۲ ثانیه بعد از ورود کارت‌ها

export const Services: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const L = layout === 'landscape';
  const shrink = interpolate(frame, [SHRINK_AT, SHRINK_AT + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const cardW = L ? 410 : 448;
  const cardH = L ? 300 : 296;
  return (
    <Scene seed="services">
      <AbsoluteFill
        style={{
          padding: L ? `${SAFE.landscape.top + 20}px ${SAFE.landscape.side}px` : `${SAFE.portrait.top + 40}px 0 ${SAFE.portrait.bottom}px`,
          alignItems: 'center',
          gap: L ? 56 : 56,
        }}
      >
        <WordReveal text={content.services.heading} layout={layout} size={L ? 72 : 64} weight={900} align="center" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${L ? 4 : 2}, ${cardW}px)`,
            gap: L ? 28 : 26,
            transform: `scale(${1 - 0.1 * shrink}) translateX(${shrink * (L ? -60 : 0)}px)`,
            opacity: 1 - 0.25 * shrink,
          }}
        >
          {content.services.items.map((item, i) => {
            const at = WAVE[i < 4 ? 0 : 1] + (i % 4) * 6;
            const p = spring({frame: frame - at, fps, config: springs.soft, durationInFrames: 20});
            return (
              <div key={i} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.94 + 0.06 * p})`}}>
                <Card style={{width: cardW, height: cardH, padding: L ? '30px 32px' : '30px 30px', display: 'flex', flexDirection: 'column', gap: 14}}>
                  <IconPulse at={at + 8} size={L ? 84 : 88}>
                    <Icon name={item.icon} size={L ? 44 : 46} />
                  </IconPulse>
                  <div style={{fontSize: L ? 36 : 40, fontWeight: 900, color: colors.white}}>
                    <BidiText text={item.title} />
                  </div>
                  <div style={{fontSize: L ? 26 : 28, fontWeight: 400, color: colors.slate400, lineHeight: 1.55}}>
                    <BidiText text={item.text} />
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
