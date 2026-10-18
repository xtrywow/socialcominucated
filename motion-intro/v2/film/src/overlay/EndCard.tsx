import React from 'react';
import {Easing, getStaticFiles, Img, interpolate, staticFile} from 'remotion';
import {Layout} from '../layout';
import {END, TXT} from '../timeline';
import {FONT, words, Words, ZW} from './Words';

// Portrait source framing (public/img/portrait.png = the relit end-card cut-out, 1000x1500, straight alpha).
// Measured from its alpha: hair top y=139, ears 391..635 at y~350 (head width 245, centre x 512).
// If the portrait is replaced with a different crop, update these numbers only.
export const SRC = {w: 1000, h: 1500, headCx: 512, headTop: 139, headW: 245};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

// The relit portrait is the base as is (its hair edge and baked light are final). The derived layers come from
// scripts/portrait_prep.py (render.sh runs it whenever portrait.png changes) and follow the baked light directions.
const layers = () => {
  const have = new Set(getStaticFiles().map((f) => f.name));
  const pick = (n: string) => (have.has(`img/portrait_${n}.png`) ? staticFile(`img/portrait_${n}.png`) : null);
  return {base: staticFile('img/portrait.png'), rim: pick('rim'), grade: pick('grade'), shadow: pick('shadow')};
};

// generic "link" glyph (no platform logo)
const LinkGlyph: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.2 1.2" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.2-1.2" />
  </svg>
);

export const EndCard: React.FC<{frame: number; lay: Layout; debug?: boolean}> = ({frame, lay}) => {
  const f = frame - END;
  if (f < 0) return null;
  const E = lay.end;
  const P = layers();
  const scale = E.portrait.headW / SRC.headW;
  const iw = SRC.w * scale;
  const ih = SRC.h * scale;
  const left = E.portrait.cx - SRC.headCx * scale;
  // Revealed by light, not alpha: he is fully opaque on the hit frame (so nothing behind him ever shows through)
  // and comes up out of the dark as the warm pool and the rim bloom over ~10 frames.
  const light = interpolate(f, [0, 10], [0, 1], {...clamp, easing: ease});
  const rise = interpolate(f, [0, 16], [0, 1], {...clamp, easing: ease});
  const top = E.portrait.headTop - SRC.headTop * scale + (1 - rise) * 46;
  const exposure = 0.25 + 0.75 * light;
  const flare = f < 0 ? 0 : Math.exp(-f / 3); // warm bloom right on the bass hit
  const pool = 0.45 + 0.55 * light;
  const bloom = 0.85 * flare; // the hit lands on a burst of warm light behind his (still dark) silhouette
  const rim = interpolate(f, [0, 8, 22], [0, 1.35, 1], {...clamp, easing: ease});
  const img: React.CSSProperties = {position: 'absolute', left, top, width: iw, height: ih};
  const fadeMask = `linear-gradient(to bottom, #000 0px, #000 ${E.fadeFrom}px, rgba(0,0,0,0) ${E.fadeTo}px)`;
  const name = words(`حسین نقی${ZW}پور`);
  const role = words(`مشاور مارکتینگ، سئو و توسعهٔ کسب${ZW}وکار`);
  const pillLine = words(`حسین نقی${ZW}پور در لینکدین`);
  const pillP = interpolate(frame, [TXT.pill, TXT.pill + 16], [0, 1], {...clamp, easing: ease});
  const urlP = interpolate(frame, [TXT.url, TXT.url + 14], [0, 1], {...clamp, easing: ease});
  const sigP = interpolate(frame, [TXT.sig, TXT.sig + 16], [0, 1], {...clamp, easing: ease});
  const ruleW = interpolate(frame, [TXT.name + 8, TXT.name + 26], [0, 110], {...clamp, easing: ease});
  const is916 = lay.id === '9x16';
  const pillTop = is916 ? E.pill.top : undefined;
  return (
    <>
      {/* warm light pool on the deep navy wall, behind his head: a warm wash (normal blend, so the navy really
          turns warm instead of grey) plus a soft screen glow; the frame edges stay deep navy */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: pool,
          background: `radial-gradient(ellipse ${E.pool.rx}px ${E.pool.ry}px at ${E.pool.x}px ${E.pool.y}px, rgba(84,58,38,0.62) 0%, rgba(60,44,36,0.42) 34%, rgba(26,30,42,0.14) 62%, rgba(10,22,40,0) 82%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: pool,
          mixBlendMode: 'screen',
          background: `radial-gradient(ellipse ${E.pool.rx * 0.8}px ${E.pool.ry * 0.7}px at ${E.pool.x}px ${E.pool.y - E.pool.ry * 0.12}px, rgba(236,178,90,0.2) 0%, rgba(196,138,60,0.09) 42%, rgba(0,0,0,0) 76%)`,
        }}
      />
      {/* the hit: one extra warm bloom of the pool that decays over ~6 frames */}
      {bloom > 0.004 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: bloom,
            mixBlendMode: 'screen',
            background: `radial-gradient(ellipse ${E.pool.rx * 0.9}px ${E.pool.ry * 0.8}px at ${E.pool.x}px ${E.pool.y - E.pool.ry * 0.1}px, rgba(255,196,110,0.55) 0%, rgba(220,150,70,0.2) 45%, rgba(0,0,0,0) 78%)`,
          }}
        />
      )}
      {/* gold pool under the small machine (its signature light) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: pool,
          mixBlendMode: 'screen',
          background: `radial-gradient(circle ${E.machinePool.r}px at ${E.machinePool.x}px ${E.machinePool.y}px, rgba(232,170,72,0.42) 0%, rgba(200,140,60,0.16) 45%, rgba(0,0,0,0) 75%)`,
        }}
      />

      {/* portrait (always opaque), faded into navy at the bottom only */}
      <div style={{position: 'absolute', inset: 0, WebkitMaskImage: fadeMask, maskImage: fadeMask}}>
        {/* soft contact shadow so he sits in the space (not a sticker) */}
        {/* the machine's warm light comes from screen-left, so his soft shadow falls to the right on the wall */}
        {P.shadow && <Img src={P.shadow} style={{...img, left: left + 30, top: top + 22, opacity: 0.6 * light}} />}
        <Img src={P.base} style={{...img, filter: exposure < 0.999 ? `contrast(1.02) brightness(${exposure.toFixed(3)})` : 'contrast(1.02)'}} />
        {/* grade: warm key on the machine side, cool navy shadow side (same direction as the baked relight) */}
        {P.grade && <Img src={P.grade} style={{...img, mixBlendMode: 'soft-light', opacity: 0.45 * light}} />}
        {/* rim light: warm on the machine side, faint cool kicker on the far edge; it blooms on the hit, then settles */}
        {P.rim && <Img src={P.rim} style={{...img, mixBlendMode: 'screen', opacity: Math.min(1, 0.4 * rim)}} />}
      </div>

      {/* name + role */}
      <div
        dir="rtl"
        lang="fa"
        style={{
          position: 'absolute',
          top: E.name.top,
          left: lay.W - E.name.right - E.name.width,
          width: E.name.width,
          fontFamily: FONT,
          textAlign: 'right',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <Words words={name} frame={frame} start={TXT.name} stagger={7} dur={15} style={{fontSize: E.name.size, fontWeight: 900, lineHeight: 1.12, letterSpacing: -1}} />
        <div style={{height: 3, width: ruleW, borderRadius: 2, margin: `${is916 ? 20 : 16}px 0 ${is916 ? 16 : 12}px`, background: 'linear-gradient(270deg, #F0D79A, #D4A853 60%, rgba(212,168,83,0))'}} />
        <Words words={role} frame={frame} start={TXT.role} stagger={3} dur={12} style={{fontSize: E.role.size, fontWeight: 700, lineHeight: 1.45, color: '#D5DDEA', flexWrap: 'nowrap', whiteSpace: 'nowrap'}} />
        {!is916 && <PillBlock frame={frame} lay={lay} pillP={pillP} urlP={urlP} line={pillLine} style={{marginTop: 40}} />}
      </div>
      {is916 && <PillBlock frame={frame} lay={lay} pillP={pillP} urlP={urlP} line={pillLine} style={{position: 'absolute', top: pillTop, right: E.pill.right, left: E.pill.right}} />}

      {/* small Latin signature under the machine (>= 28 px); 9:16 drops it (no room beside his shoulder) */}
      {E.sig && <div dir="ltr" style={{position: 'absolute', left: E.sig.x - E.sig.w / 2, width: E.sig.w, top: E.sig.y, textAlign: 'center', opacity: sigP, fontFamily: FONT, transform: `translateY(${(1 - sigP) * 10}px)`}}>
        <div style={{width: 40, height: 1.5, background: '#D4A853', margin: '0 auto 12px', opacity: 0.85}} />
        <bdi style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.08em', color: '#EBD29A', whiteSpace: 'nowrap'}}>HOSSEIN NAGHIPOUR</bdi>
      </div>}
    </>
  );
};

const PillBlock: React.FC<{frame: number; lay: Layout; pillP: number; urlP: number; line: ReturnType<typeof words>; style?: React.CSSProperties}> = ({frame, lay, pillP, urlP, line, style}) => {
  const E = lay.end;
  return (
    <div dir="rtl" lang="fa" style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18, fontFamily: FONT, ...style}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '16px 30px 16px 20px',
          borderRadius: 999,
          background: 'linear-gradient(180deg, rgba(29,55,100,0.94), rgba(17,36,68,0.94))',
          boxShadow: 'inset 0 1px 0 rgba(240,215,154,0.3), 0 0 0 1.5px rgba(212,168,83,0.7), 0 14px 36px rgba(2,8,20,0.42)',
          opacity: pillP,
          transform: `translateY(${(1 - pillP) * 18}px)`,
        }}
      >
        <div style={{width: E.pill.size * 1.36, height: E.pill.size * 1.36, borderRadius: 14, background: 'linear-gradient(160deg, #F4DDA4, #D4A853 65%, #B88A3A)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <LinkGlyph size={E.pill.size * 0.82} color="#0A1628" />
        </div>
        <Words words={line} frame={frame} start={TXT.pill + 3} stagger={3} dur={10} style={{fontSize: E.pill.size, fontWeight: 700, color: '#FFFFFF'}} />
      </div>
      <div dir="ltr" style={{opacity: urlP, transform: `translateY(${(1 - urlP) * 10}px)`, fontSize: E.url.size, fontWeight: 400, color: '#C3CEDF', letterSpacing: 0.4, paddingRight: 8}}>
        <bdi>linkedin.com/in/hossein-naghipour</bdi>
      </div>
    </div>
  );
};
