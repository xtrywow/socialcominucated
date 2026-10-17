import React from 'react';
import {AbsoluteFill, Freeze, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Linkedin, Phone} from 'lucide-react';
import {content} from '../content';
import {Portrait} from '../components/Portrait';
import {Scene, SceneProps} from '../components/Scene';
import {Signature} from '../components/Signature';
import {WordReveal} from '../components/WordReveal';
import {colors, faDigits, SAFE, springs} from '../theme';

const PHONE_AT = 52;
const FREEZE_AT = 116; // از این فریم تا پایان (۲ ثانیهٔ آخر) کاملاً ثابت

export const CTA: React.FC<SceneProps> = ({layout}) => {
  const raw = useCurrentFrame();
  const frame = Math.min(raw, FREEZE_AT);
  const {fps} = useVideoConfig();
  const L = layout === 'landscape';
  const phone = spring({frame: frame - PHONE_AT, fps, config: springs.pop, durationInFrames: 30});
  const glow = interpolate(frame, [PHONE_AT, PHONE_AT + 20, PHONE_AT + 50], [0, 1, 0.55], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const li = interpolate(frame, [76, 96], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const url = content.cta.linkedinUrl;
  return (
    <Scene seed="cta" freezeAt={FREEZE_AT}>
      <FrozenFrame frame={frame}>
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            gap: L ? 30 : 44,
            paddingTop: L ? 0 : SAFE.portrait.top,
            paddingBottom: L ? 0 : SAFE.portrait.bottom,
          }}
        >
          <Portrait size={L ? 230 : 300} start={0} initials={content.intro.initials} />
          <WordReveal text={content.cta.line} layout={layout} start={18} size={L ? 72 : 70} weight={900} align="center" />
          <div
            dir="ltr"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              transform: `scale(${0.7 + 0.3 * phone})`,
              opacity: Math.min(phone, 1),
            }}
          >
            <Phone size={L ? 64 : 64} color={colors.gold500} strokeWidth={1.8} />
            <div
              style={{
                fontSize: L ? 108 : 104,
                fontWeight: 900,
                color: colors.gold500,
                letterSpacing: 4,
                textShadow: `0 0 ${40 * glow}px ${colors.gold500}`,
              }}
            >
              {faDigits(content.cta.phone)}
            </div>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: li}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <Linkedin size={44} color={colors.gold500} strokeWidth={1.8} />
              <div style={{fontSize: L ? 42 : 44, fontWeight: 700, color: colors.white}}>{content.cta.linkedinLabel}</div>
            </div>
            {url && (
              <div dir="ltr" style={{fontSize: 30, color: colors.slate400}}>
                {url}
              </div>
            )}
          </div>
          <div style={{marginTop: L ? 10 : 20}}>
            <Signature start={92} size={L ? 30 : 32} align="center" />
          </div>
        </AbsoluteFill>
      </FrozenFrame>
    </Scene>
  );
};

// فریم کودکان را روی FREEZE_AT ثابت می‌کند تا ۲ ثانیهٔ آخر هیچ حرکتی نباشد
const FrozenFrame: React.FC<{frame: number; children: React.ReactNode}> = ({frame, children}) => (
  <Freeze frame={frame}>{children}</Freeze>
);
