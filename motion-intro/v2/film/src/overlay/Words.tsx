import React from 'react';
import {Easing, interpolate} from 'remotion';

// Word-level reveal only (Persian letters must stay joined): each word rises, un-blurs and fades in.
export type W = {t: string; gold?: boolean};
export const FONT = 'Vazirmatn';
export const ZW = '‌';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const WHITE = [255, 255, 255];
const SLATE = [138, 155, 181];

// subtle ambient shadow only (no heavy drop shadows)
export const AMBIENT = '0 2px 22px rgba(4,10,24,0.32)';
// «وصل» / «شبانه‌روز»: flat bright gold + soft glow
export const GOLD_WORD: React.CSSProperties = {
  color: '#F3C766',
  textShadow: '0 0 16px rgba(243,190,90,0.55), 0 0 44px rgba(212,168,83,0.32)',
};

export const words = (s: string, gold: string[] = []): W[] => s.split(' ').map((t) => ({t, gold: gold.includes(t)}));

export const Words: React.FC<{
  words: W[];
  frame: number;
  start: number;
  stagger?: number;
  dur?: number;
  dim?: number; // 0..1: fades toward slate once the next line arrives
  style?: React.CSSProperties;
}> = ({words: ws, frame, start, stagger = 4, dur = 13, dim = 0, style}) => (
  <div dir="rtl" lang="fa" style={{display: 'flex', flexWrap: 'wrap', gap: '0 0.25em', fontFamily: FONT, ...style}}>
    {ws.map((w, i) => {
      const p = interpolate(frame, [start + i * stagger, start + i * stagger + dur], [0, 1], {...clamp, easing: Easing.bezier(0.2, 0.8, 0.2, 1)});
      const base: React.CSSProperties = w.gold ? {...GOLD_WORD, opacity: 1 - dim * 0.35} : {color: mix(WHITE, SLATE, dim), textShadow: AMBIENT};
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            ...base,
            opacity: p * (w.gold ? 1 - dim * 0.35 : 1),
            transform: `translateY(${(1 - p) * 0.32}em)`,
            filter: p < 0.999 ? `blur(${(1 - p) * 9}px)` : undefined,
          }}
        >
          {w.t}
        </span>
      );
    })}
  </div>
);
