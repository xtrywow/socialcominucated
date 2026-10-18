// Master timeline (30 fps, 900 frames). Video seconds * 30 = frame.
// Music: video 9.0 s (frame 270) = re-entry hit = THE click; video 23.0 s (frame 690) = part-B bass hit = end card.
export const FPS = 30;
export const DUR = 900;
export const BEAT = 0.557 * FPS; // 16.71 frames
export const HIT = 270;
export const END = 690;
export const FREEZE = 840; // 840..899 completely static (cover frame)
export const onBeat = (sec: number) => Math.round((9.0 + Math.round((sec - 9.0) / 0.557) * 0.557) * FPS);

// on-screen copy (word-by-word reveal start frames)
export const TXT = {
  site: 17, // «سایت داری.» ~0.56 s
  page: 57, // «پیج داری.» ~1.9 s
  ads: 96, // «تبلیغ هم می‌کنی...» ~3.2 s
  seen: 154, // «دیده می‌شی...» 5.13 s (VO onset 4.92 s); the F1 block holds until 152 so «تبلیغ هم می‌کنی...» reads >= 1.5 s
  sell: 200, // «ولی نمی‌فروشی.» 6.67 s = on the spoken «ولی» (VO 6.70-7.9 s, music dip)
  f1Out: 261, // tension copy holds through the breath beat (>= 1.5 s fully visible) and is gone by 269, before the hit
  connect: 285, // «من این تیکه‌ها رو به هم وصل می‌کنم.» ~9.5 s
  system: onBeat(12.8), // «یه سیستم.» on the beat nearest 12.8 s (= 387)
  clickOut: 470,
  ai: onBeat(16.2), // «سیستمی که با هوش مصنوعی، شبانه‌روز برات مشتری پیدا می‌کنه.» (= 487)
  aiOut: 682,
  name: 702, // ~23.4 s
  role: 718,
  pill: 750, // ~25.0 s
  url: 760,
  sig: 772,
};

// the snap
export const ROOM: [number, number] = [252, 268]; // 8.4-8.9 s: parts make room (breath beat)
export const PLINTH_LOCK = HIT; // base/plinth thuds on the hit
export const LOCK0 = 277;
export const LOCK_STEP = 7;
export const FLIGHT = 10; // frames from launch to lock
export const lockFrameAt = (i: number) => LOCK0 + i * LOCK_STEP; // i = index in LOCK_ORDER (bottom -> top)
export const LAST_LOCK = lockFrameAt(4);
export const WOBBLE = {start: LAST_LOCK, amp: 0.034, tau: 9, period: 15};

// first lead (the "pathfinder") enters the bell and lights each module as it passes
export const BELL_ENTRY = 318;
export const NIGHT: [number, number] = [482, 650];
export const CAM_PUSH: [number, number] = [258, 330];

// the machine's clock eases to a stop by the freeze frame (no hard stop of the leads)
const EASE_OUT = 50;
export const machineTime = (F: number) => {
  const a = FREEZE - EASE_OUT;
  if (F <= a) return F;
  const u = Math.min(1, (F - a) / EASE_OUT);
  return a + EASE_OUT * (u - (u * u) / 2);
};
// inverse (machine clock -> video frame); Infinity if it never happens on screen
export const videoFrameOf = (fm: number) => {
  const a = FREEZE - EASE_OUT;
  if (fm <= a) return fm;
  const k = 1 - (2 * (fm - a)) / EASE_OUT;
  if (k < 0) return Infinity;
  return a + EASE_OUT * (1 - Math.sqrt(k));
};
