import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {content} from '../content';
import {Card} from '../components/Card';
import {GoldLine} from '../components/GoldLine';
import {Scene, SceneProps} from '../components/Scene';
import {WordReveal} from '../components/WordReveal';
import {colors, faNumber, SAFE} from '../theme';

const FIRST = 24;
const SLOT = 64; // هر کارت ~۲ ثانیه
const IN = 12;
const OUT = 10;

export const Cases: React.FC<SceneProps> = ({layout}) => {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const L = layout === 'landscape';
  const items = content.cases.items;
  const counter = content.cases.counter;
  const footerO = interpolate(frame, [10, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const cardW = L ? 1300 : 900;
  return (
    <Scene seed="cases">
      <div style={{position: 'absolute', top: L ? SAFE.landscape.top + 30 : SAFE.portrait.top + 80, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <WordReveal text={content.cases.heading} layout={layout} size={L ? 76 : 70} weight={900} align="center" />
      </div>
      {items.map((item, i) => {
        const start = FIRST + i * SLOT;
        const end = start + SLOT;
        if (frame < start || frame > end) return null;
        const enter = interpolate(frame, [start, start + IN], [1, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
        const exit = interpolate(frame, [end - OUT, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
        // ورود از راست، خروج به چپ
        const x = enter * width * 0.6 - exit * width * 0.6;
        const o = Math.min(1 - enter, 1 - exit);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: (width - cardW) / 2,
              top: L ? 330 : 640,
              transform: `translateX(${x}px)`,
              opacity: o,
            }}
          >
            <Card style={{width: cardW, minHeight: L ? 380 : 560, padding: L ? '56px 80px' : '64px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
              <div style={{fontSize: 30, fontWeight: 700, color: colors.slate400}}>
                {faNumber(i + 1)} / {faNumber(items.length)}
              </div>
              <div style={{fontSize: L ? 64 : 64, fontWeight: 900, color: colors.gold500, lineHeight: 1.4}}>{item.type}</div>
              <div style={{width: 120, height: 4, background: colors.gold500, borderRadius: 2}} />
              <div style={{fontSize: L ? 44 : 46, fontWeight: 400, color: colors.white, lineHeight: 1.6}}>{item.work}</div>
            </Card>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          bottom: L ? SAFE.landscape.bottom : SAFE.portrait.bottom + 60,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          opacity: footerO,
        }}
      >
        {counter && (
          <div style={{fontSize: 48, fontWeight: 900, color: colors.gold500}}>
            {faNumber(Math.round(counter.value * interpolate(frame, [20, 80], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})))} {counter.label}
          </div>
        )}
        <div style={{display: 'flex', alignItems: 'center', gap: 28}}>
          <GoldLine start={10} duration={20} width={L ? 160 : 100} />
          <div style={{fontSize: L ? 44 : 46, fontWeight: 700, color: colors.white}}>{content.cases.footer}</div>
          <GoldLine start={10} duration={20} width={L ? 160 : 100} style={{transform: 'scaleX(-1)'}} />
        </div>
      </div>
    </Scene>
  );
};
