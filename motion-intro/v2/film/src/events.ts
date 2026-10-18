// Every sound-worthy event, computed from the same functions that drive the picture.
// `npm run events` (render.sh events) writes ../events.json for the sound designer.
import {FLOW, LOCK_ORDER, machineLayout} from './machine/build';
import {distAt, landingAge, realAge, lockFrame, lostAt, lostLeads, powerFrame, profile, releases, wobbleAngle} from './machine/motion';
import {BELL_ENTRY, DUR, END, FPS, FREEZE, NIGHT, PLINTH_LOCK, TXT, videoFrameOf, WOBBLE} from './timeline';

export type Ev = {frame: number; t: number; type: string; id?: string; note?: string};

const ev = (frame: number, type: string, id?: string, note?: string): Ev => ({frame: Math.round(frame), t: +(Math.round(frame) / FPS).toFixed(3), type, ...(id ? {id} : {}), ...(note ? {note} : {})});

// pick at most n items spread evenly through a list
const sample = <T,>(xs: T[], n: number) => {
  if (xs.length <= n) return xs;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
  return out;
};

export const buildEvents = () => {
  const L = machineLayout();
  const P = profile();
  const R = releases();
  const out: Ev[] = [];

  // copy (for ducking / sync reference)
  const copy: [keyof typeof TXT, string][] = [
    ['site', 'سایت داری.'],
    ['page', 'پیج داری.'],
    ['ads', 'تبلیغ هم می‌کنی...'],
    ['seen', 'دیده می‌شی...'],
    ['sell', 'ولی نمی‌فروشی.'],
    ['connect', 'من این تیکه‌ها رو به هم وصل می‌کنم.'],
    ['system', 'یه سیستم.'],
    ['ai', 'سیستمی که با هوش مصنوعی، شبانه‌روز برات مشتری پیدا می‌کنه.'],
  ];
  for (const [k, s] of copy) out.push(ev(TXT[k], 'text', k, s));

  // F1 lost leads: the moment each one drops off an unconnected open end
  for (const l of lostLeads()) {
    const st = lostAt(l, l.f);
    if (!st) continue;
    out.push(ev(st.exitF, l.hero ? 'lost_lead_hero_drop' : 'lost_lead_drop', l.mod));
  }
  out.push(ev(lostLeads()[0].f, 'lost_lead_hero_rattle', 'ads', 'rattles down the unplugged megaphone'));

  // the snap
  out.push(ev(PLINTH_LOCK, 'plinth_lock', 'plinth', 'base + backplate spring up on the music hit'));
  for (const m of LOCK_ORDER) out.push(ev(lockFrame(m), 'part_lock', m));
  {
    let best = WOBBLE.start;
    let bv = 0;
    for (let f = WOBBLE.start; f < WOBBLE.start + 40; f++) {
      const a = Math.abs(wobbleAngle(f));
      if (a > bv) {
        bv = a;
        best = f;
      }
    }
    out.push(ev(best, 'wobble_peak', 'machine', `peak ${(bv * 57.3).toFixed(2)} deg, settles by ~${WOBBLE.start + WOBBLE.tau * 4}`));
  }
  out.push(ev(WOBBLE.start, 'floor_ripple', 'floor', 'hairline gold ring, 75 frames'));

  // power + leads
  out.push(ev(R[0].f, 'first_lead_release', 'lead0', 'lobbed in from off-frame left'));
  out.push(ev(BELL_ENTRY, 'first_lead_bell_entry', 'lead0'));
  for (const m of FLOW) out.push(ev(powerFrame(m), 'module_power_on', m));

  const hops: Ev[] = [];
  const lands: Ev[] = [];
  for (let i = 0; i < R.length; i++) {
    for (const h of L.handoffs) {
      const mid = (h.d0 + h.d1) / 2;
      // invert distAt by bisection on age
      let lo = 0;
      let hi = P.total;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (distAt(m) < mid) lo = m;
        else hi = m;
      }
      const f = videoFrameOf(R[i].f + realAge(R[i], lo) * FPS);
      if (f < FREEZE) hops.push(ev(f, 'handoff_hop', `${h.from}>${h.to}`, `lead ${i}`));
    }
    const la = landingAge(i);
    if (Number.isFinite(la)) {
      const f = videoFrameOf(R[i].f + la * FPS);
      if (f < FREEZE) lands.push(ev(f, 'heap_landing', 'web', `lead ${i}`));
    }
  }
  hops.sort((a, b) => a.frame - b.frame);
  lands.sort((a, b) => a.frame - b.frame);
  out.push(...sample(hops, 40));
  out.push(...sample(lands, 40));

  out.push(ev(NIGHT[0], 'day_to_night_start'));
  out.push(ev(NIGHT[1], 'day_to_night_end'));
  out.push(ev(END, 'end_card_hit', 'end', 'cut + pull-back on the part-B bass hit'));
  out.push(ev(TXT.name, 'name_reveal', 'name'));
  out.push(ev(TXT.pill, 'linkedin_pill', 'pill'));
  out.push(ev(TXT.url, 'url_line', 'url'));
  out.push(ev(TXT.sig, 'signature', 'sig'));
  out.push(ev(FREEZE, 'freeze_start', 'freeze', 'frames 840-899 are pixel-static (cover frame)'));
  out.sort((a, b) => a.frame - b.frame || a.type.localeCompare(b.type));
  return {
    fps: FPS,
    durationInFrames: DUR,
    musicHits: {click: 270, endCard: 690},
    totals: {leadsReleased: R.length, handoffHopsAll: hops.length, heapLandingsAll: lands.length, travelSeconds: +P.total.toFixed(3)},
    events: out,
  };
};
