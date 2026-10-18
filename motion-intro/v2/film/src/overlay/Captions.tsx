import React from 'react';
import {interpolate} from 'remotion';
import {Layout, TextBox} from '../layout';
import {TXT} from '../timeline';
import {W, words, Words, ZW} from './Words';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const dimAt = (frame: number, next: number) => interpolate(frame, [next, next + 12], [0, 1], clamp);

const Block: React.FC<{box: TextBox; W: number; opacity: number; lift?: number; children: React.ReactNode; debug?: boolean}> = ({box, W: width, opacity, lift = 0, children, debug}) => {
  if (opacity <= 0.001) return null;
  return (
    <div
      dir="rtl"
      lang="fa"
      style={{
        position: 'absolute',
        top: box.top,
        left: width - box.right - box.width,
        width: box.width,
        textAlign: 'right',
        fontSize: box.size,
        fontWeight: 900,
        lineHeight: box.lh,
        letterSpacing: -0.5,
        opacity,
        transform: `translateY(${-lift}px)`,
        filter: opacity < 0.999 ? `blur(${(1 - opacity) * 6}px)` : undefined,
        outline: debug ? '2px dashed rgba(255,80,80,0.9)' : undefined,
      }}
    >
      {children}
    </div>
  );
};

const out = (frame: number, a: number, b: number) => interpolate(frame, [a, b], [1, 0], clamp);
// F1 block fade-out window (overlaps the first tension word by ~4 frames: a short blurred push-up swap)
const F1_OUT: [number, number] = [TXT.seen - 2, TXT.seen + 4];

export const Captions: React.FC<{frame: number; lay: Layout; debug?: boolean}> = ({frame, lay, debug}) => {
  const T = lay.text;
  const l1 = words('سایت داری.');
  const l2 = words('پیج داری.');
  const l3 = words(`تبلیغ هم می${ZW}کنی...`);
  const t1 = words(`دیده می${ZW}شی...`);
  const t2 = words(`ولی نمی${ZW}فروشی.`);
  const c1 = words(`من این تیکه${ZW}ها رو`);
  const c2: W[] = words(`به هم وصل می${ZW}کنم.`, ['وصل']);
  const c3 = words('یه سیستم.');
  const ai = T.aiLines.map((ln) => ln.map((t) => ({t, gold: t === `شبانه${ZW}روز` || t === 'شبانه‌روز'})));
  const ln = {display: 'flex', justifyContent: 'flex-start', flexWrap: 'nowrap', whiteSpace: 'nowrap'} as React.CSSProperties;
  return (
    <>
      {/* F1 holds until 152 (l3 is fully in by ~108 -> >= 1.5 s readable), then lifts away as «دیده می‌شی...» rises in */}
      {frame < F1_OUT[1] && (
        <Block box={T.f1} W={lay.W} opacity={out(frame, F1_OUT[0], F1_OUT[1])} lift={(1 - out(frame, F1_OUT[0], F1_OUT[1])) * 20} debug={debug}>
          <Words words={l1} frame={frame} start={TXT.site} stagger={5} dim={dimAt(frame, TXT.page) * 0.85} style={ln} />
          <Words words={l2} frame={frame} start={TXT.page} stagger={5} dim={dimAt(frame, TXT.ads) * 0.85} style={ln} />
          <Words words={l3} frame={frame} start={TXT.ads} stagger={3} dur={10} style={ln} />
        </Block>
      )}
      {frame >= TXT.seen - 1 && frame < TXT.f1Out + 9 && (
        <Block box={T.tension} W={lay.W} opacity={out(frame, TXT.f1Out, TXT.f1Out + 8)} lift={(1 - out(frame, TXT.f1Out, TXT.f1Out + 8)) * 18} debug={debug}>
          <Words words={t1} frame={frame} start={TXT.seen} stagger={6} dim={dimAt(frame, TXT.sell) * 0.85} style={ln} />
          {/* lands on the spoken «ولی» and is fully in by ~216 */}
          <Words words={t2} frame={frame} start={TXT.sell} stagger={4} dur={12} style={ln} />
        </Block>
      )}
      {frame >= TXT.connect - 2 && frame < TXT.clickOut + 14 && (
        <Block box={T.connect} W={lay.W} opacity={out(frame, TXT.clickOut, TXT.clickOut + 12)} lift={(1 - out(frame, TXT.clickOut, TXT.clickOut + 12)) * 18} debug={debug}>
          <Words words={c1} frame={frame} start={TXT.connect} stagger={4} dim={dimAt(frame, TXT.system) * 0.85} style={ln} />
          <Words words={c2} frame={frame} start={TXT.connect + 16} stagger={4} dim={dimAt(frame, TXT.system) * 0.85} style={ln} />
          <Words words={c3} frame={frame} start={TXT.system} stagger={5} style={ln} />
        </Block>
      )}
      {frame >= TXT.ai - 2 && frame < TXT.aiOut + 10 && (
        <Block box={T.ai} W={lay.W} opacity={out(frame, TXT.aiOut, TXT.aiOut + 8)} debug={debug}>
          {ai.map((line, i) => (
            <Words key={i} words={line} frame={frame} start={TXT.ai + i * 22} stagger={4} style={ln} />
          ))}
        </Block>
      )}
    </>
  );
};
