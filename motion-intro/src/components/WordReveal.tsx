import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, FONT, Layout, springs} from '../theme';
import {hasLatin, tokenize} from './rich';

type Props = {
  text: string;
  layout: Layout;
  start?: number;
  stagger?: number;
  size: number;
  weight?: number;
  color?: string;
  align?: 'right' | 'center' | 'left';
  lineHeight?: number;
  glow?: boolean;
  style?: React.CSSProperties;
};

// انیمیشن کلمه‌به‌کلمه — هرگز حرف‌به‌حرف (اتصال حروف فارسی می‌شکند)
export const WordReveal: React.FC<Props> = ({
  text,
  layout,
  start = 0,
  stagger = 3,
  size,
  weight = 700,
  color = colors.white,
  align = 'right',
  lineHeight = 1.45,
  glow = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tokens = tokenize(text, layout);
  let index = 0;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        color,
        textAlign: align,
        lineHeight,
        ...style,
      }}
    >
      {tokens.map((t, i) => {
        if ('br' in t) return <br key={i} />;
        const delay = start + index * stagger;
        index++;
        const p = spring({frame: frame - delay, fps, config: springs.soft, durationInFrames: 18});
        const word = hasLatin(t.word) ? <bdi>{t.word}</bdi> : t.word;
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: 'inline-block',
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
                color: t.gold ? colors.gold500 : undefined,
                textShadow: t.gold && glow ? `0 0 ${18 + 10 * p}px ${colors.gold500}99` : undefined,
              }}
            >
              {word}
            </span>{' '}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// متن ساده با کلمات لاتین داخل bdi (برای توضیح کارت‌ها)
export const BidiText: React.FC<{text: string}> = ({text}) => (
  <>
    {text.split(/(\s+)/).map((part, i) => (hasLatin(part) ? <bdi key={i}>{part}</bdi> : part))}
  </>
);
