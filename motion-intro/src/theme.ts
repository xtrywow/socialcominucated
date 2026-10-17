export const colors = {
  navy900: '#0A1628',
  navy700: '#13284A',
  gold500: '#D4A853',
  gold300: '#F0D79A',
  white: '#FFFFFF',
  slate400: '#8A9BB5',
};

export const FONT = 'Vazirmatn, sans-serif';

export const springs = {
  soft: {damping: 200},
  pop: {damping: 12},
};

export const FPS = 30;
export const TRANSITION = 15;

// مدت صحنه‌ها طبق بریف (فریم). هر صحنه به‌جز آخری ۱۵ فریم اضافه می‌گیرد
// چون انتقال‌ها روی هم می‌افتند؛ جمع نهایی دقیقاً ۲۷۰۰ فریم می‌شود.
export const SCENE_FRAMES = {
  hook: 180,
  intro: 240,
  problem: 300,
  approach: 300,
  services: 540,
  ai: 360,
  cases: 420,
  process: 180,
  cta: 180,
};

export type Layout = 'landscape' | 'portrait';

export const SAFE = {
  landscape: {top: 90, bottom: 90, side: 120},
  portrait: {top: 120, bottom: 200, side: 80},
};

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const faDigits = (s: string) => s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
export const faNumber = (n: number) => n.toLocaleString('fa-IR');
