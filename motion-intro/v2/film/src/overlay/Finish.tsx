import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';

// Film finish: grain re-seeded every frame (a pre-generated noise tile at a hashed offset per frame;
// cheap and deterministic), frozen with the freeze frame; light vignette; whisper of edge fringe.
const TILE = 384;
let _tile: string | null = null;
const noiseTile = () => {
  if (_tile) return _tile;
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(TILE, TILE);
  let s = 1234567;
  const r = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000) / 1000;
  };
  for (let i = 0; i < TILE * TILE; i++) {
    // two-sample average: softer, film-like distribution
    const v = Math.round(((r() + r()) / 2) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _tile = c.toDataURL('image/png');
  return _tile;
};

const hash = (n: number) => {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
};

export const Finish: React.FC<{frame: number; W: number; H: number; vignette?: number}> = ({frame, W, H, vignette = 0.4}) => {
  const tile = useMemo(() => noiseTile(), []);
  const h = hash(frame + 17);
  const ox = h % TILE;
  const oy = (h >>> 9) % TILE;
  const grain = (blend: React.CSSProperties['mixBlendMode'], opacity: number, size: number, dx: number, dy: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(${tile})`,
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${-dx}px ${-dy}px`,
    mixBlendMode: blend,
    opacity,
    imageRendering: 'auto',
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 0.22 (was 0.3): ~27 % less grain, so flat navy survives platform re-encodes without blocking */}
      <div style={grain('soft-light', 0.22, TILE * 1.25, ox, oy)} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${W * 0.8}px ${H * 0.66}px at 50% 48%, rgba(0,0,0,0) 62%, rgba(2,6,16,${vignette}) 100%)`}} />
    </AbsoluteFill>
  );
};
