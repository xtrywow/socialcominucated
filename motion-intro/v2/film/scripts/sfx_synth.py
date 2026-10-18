#!/usr/bin/env python3
"""Film v2 SFX stem: synthesised from the picture's own event list.

usage: sfx_synth.py <events.json> <sfx-cues.json> <audio_dir> [plot.png]
  reads  <audio_dir>/voice.wav, <audio_dir>/music.wav  (post-bus stems, used for level + true-peak checks)
  writes <audio_dir>/sfx.wav  (48 kHz stereo, PCM 24, exactly 30.000 s)

Every onset is computed from a video frame (t = frame / 30). Stereo placement uses the 9:16 screen x of
the source (sfx-cues.json, projected through the same cameras as the picture). Groups:
  snap    plinth thump, flight whooshes, part-lock clicks, wobble knocks, floor-ripple air
  power   per-module power-on swell + a quiet "running" hum bed (cut on the end-card hit)
  marble  lost-lead lip ticks, hero rattle, pathfinder whirr, hand-off ticks/rolls, heap landings
  end     end-card shimmer, pull-back air, LinkedIn pill pop
"""
import json
import sys

import numpy as np
import pedalboard as pb
import soundfile as sf
from scipy import signal

SR = 48000
FPS = 30
N = 30 * SR
FREEZE = 840
CEIL_DBTP = -1.0

ev_path, cue_path, audio_dir = sys.argv[1], sys.argv[2], sys.argv[3]
plot_path = sys.argv[4] if len(sys.argv) > 4 else None
EV = json.load(open(ev_path))
CUE = json.load(open(cue_path))
R = np.random.default_rng(20261018)

GROUPS = ['snap', 'power', 'marble', 'end']
bus = {g: np.zeros((N, 2)) for g in GROUPS}
send = {g: np.zeros((N, 2)) for g in GROUPS}
LOG = []  # (t, label, group, pan, rel_db)


def t_of(frame):
    return frame / FPS


def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def sos_f(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')


def hp(x, f, o=2):
    return signal.sosfilt(sos_f('highpass', f, o), x)


def lp(x, f, o=2):
    return signal.sosfilt(sos_f('lowpass', f, o), x)


def bp(x, lo, hi, o=2):
    return signal.sosfilt(sos_f('bandpass', [lo, hi], o), x)


def atk(t, tau):
    return 1 - np.exp(-t / tau)


def modal(freqs, amps, taus, dur, rng):
    t = tt(dur)
    out = np.zeros_like(t)
    for f, a, tau in zip(freqs, amps, taus):
        if f < SR / 2 - 500:
            out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / tau)
    return out


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


def xpan(x, k=1.5, lim=0.75):
    return float(np.clip((x - 0.5) * k, -lim, lim))


def add(group, sig, t0, pan=0.0, db=0.0, wet=0.15, label=None):
    """mono sig (constant or per-sample pan) or stereo sig, placed at t0 seconds."""
    g = 10 ** (db / 20)
    # every source ends on a smooth tail (no truncation clicks): cosine fade over its last 15 % (<= 250 ms)
    nf = max(8, min(int(0.15 * len(sig)), int(0.25 * SR)))
    fade = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nf))
    sig = sig.copy()
    sig[-nf:] = (sig[-nf:].T * fade).T
    if sig.ndim == 1:
        a = (np.asarray(pan, dtype=float) + 1) * np.pi / 4
        st = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
    else:
        st = sig
    st = st * g
    i0 = int(round(t0 * SR))
    if i0 < 0:
        st = st[-i0:]
        i0 = 0
    n = min(len(st), N - i0)
    bus[group][i0:i0 + n] += st[:n]
    send[group][i0:i0 + n] += st[:n] * wet
    if label:
        LOG.append((t0, label, group, float(np.mean(pan)) if np.ndim(pan) else float(pan), db))


def sweep_noise(dur, fc0, fc1, bw_oct, rng, curve=1.0):
    """noise through a gliding log-gaussian band (STFT mask)."""
    n = int(dur * SR)
    x = rng.standard_normal(n + 4096)
    f, t, Z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
    u = np.clip(t / dur, 0, 1) ** curve
    fc = fc0 * (fc1 / fc0) ** u
    lf = np.log2(np.maximum(f, 20))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (bw_oct / 2.355)) ** 2)
    _, y = signal.istft(Z * mask, fs=SR, nperseg=1024, noverlap=768)
    return y[:n]


# ----------------------------------------------------------------------------------------------- sources
def lock_click(f0, rng):
    """tactile ceramic/metal lock: faint contact tick, then the seat (body modes + low thock + tiny ring)."""
    dur = 0.7
    t = tt(dur)
    ratios = np.array([1.0, 1.58, 2.37, 3.11, 4.32]) * (1 + rng.normal(0, 0.012, 5))
    amps = np.array([1.0, 0.55, 0.42, 0.25, 0.16])
    taus = np.array([0.030, 0.022, 0.016, 0.011, 0.008]) * rng.uniform(0.9, 1.15)
    body = modal(f0 * ratios, amps, taus, dur, rng)
    fr = f0 * rng.uniform(3.55, 3.75)
    ring = 0.07 * (np.sin(2 * np.pi * fr * t) + 0.7 * np.sin(2 * np.pi * fr * 1.0035 * t + 1.1)) * np.exp(-t / 0.24)
    ring += 0.04 * np.sin(2 * np.pi * f0 * rng.uniform(5.2, 5.6) * t) * np.exp(-t / 0.15)
    nb = 0.5 * hp(rng.standard_normal(len(t)) * np.exp(-t / 0.0007), 2500)
    fs = 175 * rng.uniform(0.95, 1.06)
    seat = 0.55 * np.sin(2 * np.pi * (fs * t - 40 * t * t)) * np.exp(-t / 0.02)
    main = (body + ring + nb + seat) * atk(t, 0.00025)
    pre_d = rng.uniform(0.009, 0.014)
    pre = 0.22 * modal(f0 * 1.9 * ratios[:3], amps[:3], taus[:3] * 0.45, dur, rng) * atk(t, 0.0002) + 0.12 * nb
    out = np.zeros(len(t) + int(0.02 * SR))
    out[:len(pre)] += pre
    d = int(pre_d * SR)
    out[d:d + len(main)] += main
    return norm(out), pre_d


def thump(rng):
    dur = 1.0
    t = tt(dur)
    f = 46 + 46 * np.exp(-t / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17) * atk(t, 0.004)
    knock = modal([150, 335, 600], [0.35, 0.18, 0.08], [0.05, 0.03, 0.018], dur, rng) * atk(t, 0.0008)
    nz = 0.35 * lp(rng.standard_normal(len(t)) * np.exp(-t / 0.022), 420)
    return norm(body + knock + nz)


def knock(rng, f0=95):
    dur = 0.5
    t = tt(dur)
    x = modal([f0, f0 * 2.2, f0 * 4.1], [1, 0.45, 0.2], [0.07, 0.035, 0.018], dur, rng) * atk(t, 0.002)
    x += 0.2 * lp(rng.standard_normal(len(t)) * np.exp(-t / 0.01), 600)
    return norm(x)


def whoosh(dur, fc0, fc1, rng, peak=0.85, bw=1.6):
    n = int(dur * SR)
    u = np.arange(n) / n
    env = np.where(u < peak, (u / peak) ** 2.2, np.clip(1 - (u - peak) / (1 - peak), 0, 1) ** 1.5)
    hi = sweep_noise(dur, fc0, fc1, bw, rng, curve=1.4)
    lo = lp(rng.standard_normal(n), 260) * 0.6
    return norm((hi + lo * (0.4 + 0.6 * u)) * env)


def breath(rng, dur):
    n = int(dur * SR)
    u = np.arange(n) / n
    env = np.sin(np.pi * np.clip(u / 0.9, 0, 1)) ** 2 * (u < 0.9)
    L = sweep_noise(dur, 700, 2300, 2.4, rng)
    Rr = sweep_noise(dur, 700, 2300, 2.4, rng)
    st = np.stack([L, Rr], 1) * env[:, None]
    return st / np.abs(st).max()


def power_on(f0, rng, dur=1.8):
    t = tt(dur)
    cents = -45 * np.exp(-t / 0.12)
    f = f0 * 2 ** (cents / 1200)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = sum((1 / h ** 1.4) * np.sin(h * ph + rng.uniform(0, 6.28)) for h in range(1, 8))
    tone += 0.5 * sum((1 / h ** 1.4) * np.sin(h * ph * 1.0023 + rng.uniform(0, 6.28)) for h in range(1, 6))
    k = atk(t, 0.28)
    x = lp(tone, 340) * (1 - k) + lp(tone, 1900) * k
    env = atk(t, 0.09) * (0.3 + 0.7 * np.exp(-t / 0.42))
    env *= np.clip((dur - t) / 0.7, 0, 1)
    zz = 0.08 * bp(rng.standard_normal(len(t)), 2200, 5200) * np.exp(-t / 0.05) * atk(t, 0.003)
    return norm(x * env + zz)


def marble_tick(rng, size=1.0, bright=1.0):
    dur = 0.12
    t = tt(dur)
    f0 = rng.uniform(3000, 4300) / size
    fr = f0 * np.array([1, rng.uniform(1.45, 1.62), rng.uniform(2.55, 2.95)])
    x = modal(fr, [1, 0.5, 0.25], np.array([0.012, 0.008, 0.005]) * rng.uniform(0.8, 1.35), dur, rng)
    x += 0.35 * hp(rng.standard_normal(len(t)) * np.exp(-t / 0.0005), 3000)
    x *= atk(t, 0.0002)
    if bright < 0.999:
        x = lp(x, 2500 + 9000 * bright)
    return norm(x)


def roll(rng, dur, lo=700, hi=2600, rate=55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    imp = np.zeros(n)
    k = 0.0
    while k < dur:
        k += rng.uniform(0.6, 1.4) / rate
        i = int(k * SR)
        if i < n:
            imp[i] = rng.uniform(0.4, 1.0)
    am = lp(imp, 90, 1) * 60
    x = bp(rng.standard_normal(n), lo, hi) * (0.35 + am)
    env = atk(t, 0.02) * np.clip((dur - t) / (0.6 * dur), 0, 1)
    return norm(x * env)


def heap_landing(rng, size, bright):
    """clack on the heap + two settle bounces + a tiny settle roll."""
    dur = 0.8
    out = np.zeros(int(dur * SR))
    c = marble_tick(rng, size * rng.uniform(1.15, 1.35), bright)
    c2 = 0.5 * marble_tick(rng, size * rng.uniform(0.85, 1.0), bright)
    out[:len(c)] += c
    d = int(rng.uniform(0.002, 0.006) * SR)
    out[d:d + len(c2)] += c2
    d1 = rng.uniform(0.11, 0.16)
    d2 = d1 * rng.uniform(0.55, 0.7)
    for at, a in [(d1, rng.uniform(0.32, 0.45)), (d1 + d2, rng.uniform(0.12, 0.2))]:
        b = marble_tick(rng, size * rng.uniform(0.95, 1.1), bright)
        i = int(at * SR)
        out[i:i + len(b)] += a * b
    r = 0.07 * roll(rng, 0.12, 900, 2400, 70)
    i = int((d1 + d2 + 0.02) * SR)
    out[i:i + len(r)] += r
    return norm(out)


def cone_tick(rng, amp):
    dur = 0.15
    t = tt(dur)
    x = modal([rng.uniform(1150, 1500), rng.uniform(2600, 3300), rng.uniform(4200, 5200)], [0.6, 1, 0.5], [0.05, 0.02, 0.012], dur, rng)
    x += 0.3 * hp(rng.standard_normal(len(t)) * np.exp(-t / 0.0006), 2500)
    return norm(x * atk(t, 0.0002)) * amp


def shimmer(rng, dur=3.2):
    t = tt(dur)
    notes = [987.77, 1318.51, 1479.98, 1975.53, 2959.96, 3951.07]
    amps = [0.5, 0.35, 0.45, 0.42, 0.24, 0.13]
    taus = [1.5, 1.25, 1.1, 0.9, 0.6, 0.45]
    st = np.zeros((len(t), 2))
    for i, (f, a, tau) in enumerate(zip(notes, amps, taus)):
        vib = 1 + 0.0012 * np.sin(2 * np.pi * rng.uniform(4.5, 6) * t + rng.uniform(0, 6))
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        s = a * (np.sin(ph + rng.uniform(0, 6)) + 0.8 * np.sin(ph * 1.0015 + rng.uniform(0, 6))) * np.exp(-t / tau) * atk(t, 0.025)
        p = (-0.45 if i % 2 else 0.45) * (0.5 + 0.5 * i / 5)
        a_ = (p + 1) * np.pi / 4
        st[:, 0] += s * np.cos(a_)
        st[:, 1] += s * np.sin(a_)
    # sparkle grains
    for _ in range(46):
        t0 = rng.uniform(0, 1.3) ** 1.6
        gd = rng.uniform(0.03, 0.08)
        gt = tt(gd)
        g = np.sin(2 * np.pi * rng.uniform(3200, 8500) * gt) * np.hanning(len(gt)) * 0.22 * np.exp(-t0 / 0.6)
        p = rng.uniform(-0.8, 0.8)
        i = int(t0 * SR)
        a_ = (p + 1) * np.pi / 4
        st[i:i + len(g), 0] += g * np.cos(a_)
        st[i:i + len(g), 1] += g * np.sin(a_)
    return st / np.abs(st).max()


# ----------------------------------------------------------------------------------------------- score
events = EV['events']
by_type = {}
for e in events:
    by_type.setdefault(e['type'], []).append(e)
parts = {p['mod']: p for p in CUE['parts']}


def night_at(f):
    a, b = 482, 650
    u = min(1, max(0, (f - a) / (b - a)))
    return u * u * (3 - 2 * u)


# --- snap: breath, flights, plinth, locks, wobble, ripple
room0, room1 = 251, 268.5  # parts make room (8.37-8.95 s); silent gap right before the hit
add('snap', breath(R, t_of(room1 - room0)), t_of(room0), db=-12, wet=0.25, label='make-room breath')

LOCK_PITCH = {'web': 1479.98, 'seo': 1760.0, 'content': 1975.53, 'social': 2349.32, 'ads': 2637.02}  # F#6 A6 B6 D7 E7 (B minor pentatonic)
for e in by_type['part_lock']:
    m = e['id']
    p = parts[m]
    lock = p['lock']
    assert lock == e['frame']
    # flight whoosh, panned along the projected flight path
    launch = p['launch']
    dur = t_of(lock - launch) + 0.02
    w = whoosh(dur, 520, 2600, R, peak=0.86)
    px = np.array([q['f'] for q in p['path']], float)
    xs = np.array([xpan(q['9x16']['x']) for q in p['path']])
    tw = launch + np.arange(len(w)) / SR * FPS
    add('snap', w, t_of(launch), pan=np.interp(tw, px, xs), db=-16 + R.uniform(-1, 1), wet=0.2, label=f'flight {m}')
    # lock click (main seat transient lands exactly on the lock frame)
    c, pre = lock_click(LOCK_PITCH[m], R)
    add('snap', c, t_of(lock) - pre, pan=xpan(p['atLock']['9x16']['x']), db=R.uniform(-0.8, 0.4), wet=0.12, label=f'lock {m}')

pl = by_type['plinth_lock'][0]
add('snap', thump(R), t_of(pl['frame']), pan=0.0, db=-1.5, wet=0.1, label='plinth thump')
# wobble: the machine rocks on its plinth edge -> two soft knocks at the sign changes
for k, (fr, db) in enumerate([(305 + 7.5, -11), (305 + 15, -17)]):
    add('snap', knock(R, 92 + 9 * k), t_of(fr), pan=(-0.12 if k == 0 else 0.1), db=db, wet=0.12, label='wobble knock')
rp = by_type['floor_ripple'][0]['frame']
rip = sweep_noise(2.4, 9000, 4200, 1.1, R) * atk(tt(2.4), 0.05) * np.exp(-tt(2.4) / 0.7)
rip += 0.15 * modal([1975.53, 2959.96], [1, 0.7], [0.9, 0.7], 2.4, R) * atk(tt(2.4), 0.04)
add('snap', np.stack([norm(rip), norm(np.roll(rip, 480))], 1), t_of(rp), db=-17, wet=0.4, label='floor ripple air')

# --- power: per-module swell + running bed
POWER_NOTE = {'ads': 123.47, 'social': 146.83, 'content': 164.81, 'seo': 185.0, 'web': 246.94}  # B2 D3 E3 F#3 B3
for e in by_type['module_power_on']:
    m = e['id']
    f = parts[m]['powerOn']
    add('power', power_on(POWER_NOTE[m], R), t_of(f), pan=xpan(parts[m]['atPower']['9x16']['x'], 1.2), db=-1.0 + R.uniform(-0.5, 0.5), wet=0.18, label=f'power-on {m}')
# running hum bed: fades in as modules come online, cut on the end-card hit
t = np.arange(N) / SR
f_s = t * FPS
bed_env = np.clip((f_s - 318) / 90, 0, 1) ** 1.5 * np.clip((690.5 - f_s) / 2.4, 0, 1)
nz = bp(R.standard_normal(N), 160, 900)
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * t)
bed = (np.sin(2 * np.pi * 123.47 * t) * 0.5 + np.sin(2 * np.pi * 185.0 * t + 1) * 0.2 + np.sin(2 * np.pi * 246.94 * t + 2) * 0.12) * lfo + 0.5 * nz * (0.6 + 0.4 * np.sin(2 * np.pi * 0.37 * t + 2))
bed = lp(bed, 700)
bedst = np.stack([bed, np.roll(bed, 960)], 1) * bed_env[:, None]
add('power', bedst / np.abs(bedst).max(), 0.0, db=-31, wet=0.0, label=None)
LOG.append((t_of(318), 'running hum bed (-> cut 23.0)', 'power', 0.0, -31))


# --- marble: lost leads, hero rattle, pathfinder, hops, landings
END_CUT = 690  # end-card cut: the machine becomes a small soft-focus signature -> its ticks stop (room for the name + voice)


for l in CUE['lost']:
    if l['hero']:
        continue
    f = l['exit']
    quiet = 214 < f < 252
    x = marble_tick(R, l['size'] * 1.05, 0.85)
    ring = 0.25 * modal([R.uniform(2300, 2700)], [1], [0.07], 0.25, R)
    sig = np.zeros(int(0.3 * SR))
    sig[:len(x)] += x
    sig[:len(ring)] += ring
    add('marble', norm(sig), t_of(f), pan=xpan(l['pos']['9x16']['x']), db=-3 + R.uniform(-2.5, 1) - (5 if quiet else 0), wet=0.3, label='lost lead drop')
hero = [l for l in CUE['lost'] if l['hero']][0]
h0, h1 = hero['start'], hero['exit']
hp_ = xpan(hero['pos']['9x16']['x'])
rollT = (h1 - h0) / FPS
k = 0
while True:
    tk = (np.pi / 2 + k * np.pi) / 40 + R.uniform(-0.012, 0.012)
    if tk > rollT - 0.03:
        break
    a = 0.25 + 0.75 * (1 - tk / rollT)
    add('marble', cone_tick(R, a), t_of(h0) + tk, pan=hp_, db=-1, wet=0.25, label='hero rattle')
    k += 1
add('marble', roll(R, rollT, 900, 3000, 30), t_of(h0), pan=hp_, db=-15, wet=0.2)
lip = marble_tick(R, 1.0, 0.9)
add('marble', lip, t_of(h1), pan=hp_, db=1, wet=0.3, label='hero drop')
# pathfinder enters the megaphone bell (spins up in the cone)
bell = by_type['first_lead_bell_entry'][0]['frame']
wh = roll(R, 0.42, 600, 2400, 70) * np.linspace(0.5, 1, int(0.42 * SR))
add('marble', norm(wh), t_of(bell) - 0.12, pan=xpan(parts['ads']['atPower']['9x16']['x']), db=-9, wet=0.2, label='pathfinder whirr')

hop_cues = {(h['lead'], h['h']): h for h in CUE['hops']}
land_cues = {d['lead']: d for d in CUE['lands']}
last_t = -1.0
for e in sorted(by_type['handoff_hop'], key=lambda e: e['frame']):
    lead = int(e['note'].split()[1])
    c = hop_cues[(lead, e['id'])]
    f = c['f']
    if f >= END_CUT:
        continue
    if t_of(f) - last_t < 0.035:
        continue
    last_t = t_of(f)
    br = 1 - 0.45 * night_at(f)
    x = marble_tick(R, c['size'] * R.uniform(0.9, 1.12), br)
    r = 0.22 * roll(R, R.uniform(0.12, 0.28), 700, 2400, R.uniform(40, 70))
    sig = np.zeros(int(0.4 * SR))
    sig[:len(x)] += x
    i = int(0.012 * SR)
    sig[i:i + len(r)] += r
    first = lead == 0
    add('marble', norm(sig), t_of(f), pan=xpan(c['pos']['9x16']['x']), db=(-9 if not first else -4) + R.uniform(-4, 1.5), wet=0.15, label='first hand-off hop' if first else 'hand-off hop')
for e in sorted(by_type['heap_landing'], key=lambda e: e['frame']):
    lead = int(e['note'].split()[1])
    c = land_cues[lead]
    f = c['f']
    if f >= END_CUT:
        continue
    br = 1 - 0.45 * night_at(f)
    first = lead == 0
    add('marble', heap_landing(R, c['size'], br), t_of(f), pan=xpan(c['pos']['9x16']['x']) if c['pos'] else 0.2, db=(-7 if not first else -3) + R.uniform(-4, 1.5), wet=0.18, label='first heap landing' if first else 'heap landing')

# --- end card
endf = by_type['end_card_hit'][0]['frame']
add('end', shimmer(R), t_of(endf), db=0.0, wet=0.4, label='end-card shimmer')
pb_ = sweep_noise(0.75, 3800, 700, 1.4, R) * np.sin(np.pi * np.clip(np.arange(int(0.75 * SR)) / (0.75 * SR), 0, 1)) ** 1.5
add('end', np.stack([norm(pb_), norm(np.roll(pb_, 720))], 1), t_of(endf) + 0.01, db=-12, wet=0.3, label='pull-back air')
pill = by_type['linkedin_pill'][0]['frame']
pt = tt(0.3)
pop = modal([620, 1460, 2950], [1, 0.4, 0.15], [0.03, 0.015, 0.009], 0.3, R) * atk(pt, 0.0015)
add('end', norm(pop), t_of(pill) + 4 / FPS, pan=0.15, db=-12, wet=0.25, label='pill pop')

assert all(tm < FREEZE / FPS for tm, *_ in LOG), 'an onset lands after the freeze'

# ----------------------------------------------------------------------------------------------- loudness tools
KB = [(np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]), np.array([1.0, -1.69065929318241, 0.73248077421585])),
      (np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621]))]


def kw(x):
    for b, a in KB:
        x = signal.lfilter(b, a, x, axis=0)
    return x


def loud_curve(x, win=0.4, hop=0.05):
    y = kw(x) ** 2
    ms = y.sum(1)
    c = np.concatenate([[0], np.cumsum(ms)])
    w = int(win * SR)
    h = int(hop * SR)
    idx = np.arange(0, len(ms) - w, h)
    m = (c[idx + w] - c[idx]) / w
    return (idx + w / 2) / SR, -0.691 + 10 * np.log10(m + 1e-12)


def integrated(x):
    tc, L = loud_curve(x, 0.4, 0.1)
    p = 10 ** ((L + 0.691) / 10)
    g = L > -70
    rel = -0.691 + 10 * np.log10(p[g].mean()) - 10
    g2 = g & (L > rel)
    return -0.691 + 10 * np.log10(p[g2].mean())


def true_peak(x):
    return np.abs(signal.resample_poly(x, 4, 1, axis=0)).max()


voice, _ = sf.read(f'{audio_dir}/voice.wav', always_2d=True)
music, _ = sf.read(f'{audio_dir}/music.wav', always_2d=True)
assert len(voice) == len(music) == N
tv, Lv = loud_curve(voice)
speech = Lv > -40
Vm = float(np.median(Lv[speech]))

# voice-keyed duck on the marble bus (ticks never compete with a word)
env = np.sqrt(signal.sosfilt(sos_f('lowpass', 8, 1), (voice ** 2).mean(1)).clip(0))
env_db = 20 * np.log10(env + 1e-9)
on = (env_db > env_db.max() - 30).astype(float)
duck = np.zeros(N)
a_att, a_rel = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.35 * SR))
duck = signal.lfilter([1 - a_rel], [1, -a_rel], on)
duck = np.maximum(duck, signal.lfilter([1 - a_att], [1, -a_att], on))
bus['marble'] *= (10 ** (-6 * np.clip(duck, 0, 1) / 20))[:, None]
send['marble'] *= (10 ** (-6 * np.clip(duck, 0, 1) / 20))[:, None]

# the hums stay out of the voice's chest register
bus['power'] = hp(bus['power'].T, 95, 2).T
send['power'] = hp(send['power'].T, 95, 2).T

# group calibration: momentary (400 ms) maximum of each group relative to the voice's median momentary loudness
TARGET = {'snap': -7.0, 'end': -8.0, 'power': -15.0, 'marble': -15.0}
gain = {}
for g in GROUPS:
    _, Lg = loud_curve(bus[g])
    gain[g] = 10 ** ((Vm + TARGET[g] - Lg.max()) / 20)

dry = sum(bus[g] * gain[g] for g in GROUPS)
wet = sum(send[g] * gain[g] for g in GROUPS)
verb = pb.Pedalboard([pb.HighpassFilter(280), pb.Reverb(room_size=0.34, damping=0.55, wet_level=1.0, dry_level=0.0, width=0.9), pb.LowpassFilter(9000)])
wr = verb(wet.T.astype(np.float32), SR).T.astype(np.float64)
sfx = dry + 0.55 * wr[:N]
# hard silence guarantee before the first event and a clean fade at the very end
sfx *= np.clip((30.0 - t) / 0.4, 0, 1)[:, None]

# true-peak guard: the master (voice + music) is already limited to -1.05 dBTP. Lower the SFX only at the
# few (4x oversampled) samples where the sum would pass the ceiling, by exactly what is needed there,
# held 1.5 ms and smoothed 1 ms: millisecond dips inside a transient, never a whole event.
from scipy.ndimage import minimum_filter1d

_, Ls_pre = loud_curve(sfx)
vm_ = voice + music
ceil = 10 ** ((CEIL_DBTP - 0.02) / 20)
y_up = signal.resample_poly(vm_, 4, 1, axis=0)
G = np.ones(N)
for it in range(8):
    s_up = signal.resample_poly(sfx * G[:, None], 4, 1, axis=0)
    tot = y_up + s_up
    over = np.abs(tot) > ceil
    if not over.any():
        break
    ay, as_ = np.abs(y_up), np.abs(s_up) + 1e-12
    same = np.sign(s_up) == np.sign(y_up)
    req = np.where(same, (ceil - ay) / as_, (ceil + ay) / as_)
    req = np.where(over, np.clip(req * 0.98, 0, 1), 1.0).min(1)
    req = req[: (len(req) // 4) * 4].reshape(-1, 4).min(1)
    req = np.concatenate([req, np.ones(N - len(req))])
    req = minimum_filter1d(req, size=int(0.0015 * SR))
    w = np.hanning(int(0.001 * SR))
    req = np.minimum(np.convolve(req, w / w.sum(), mode='same'), 1.0)
    G *= req
sfx = sfx * G[:, None]
tp_guard_min_db = 20 * np.log10(G.min())

master = vm_ + sfx
I_master = integrated(master)
I_mix = integrated(vm_)
TP_master = 20 * np.log10(true_peak(master))
_, Ls = loud_curve(sfx)
ts, Ls = loud_curve(sfx)
_, Ls3 = loud_curve(sfx, 3.0, 0.1)
_, Lv3 = loud_curve(voice, 3.0, 0.1)
sf.write(f'{audio_dir}/sfx.wav', sfx, SR, subtype='PCM_24')
import os
if os.environ.get('SFX_DEBUG_DIR'):
    for g in GROUPS:
        np.save(os.path.join(os.environ['SFX_DEBUG_DIR'], f'bus_{g}.npy'), (bus[g] * gain[g]).astype(np.float32))
    np.save(os.path.join(os.environ['SFX_DEBUG_DIR'], 'verb.npy'), (0.55 * wr[:N]).astype(np.float32))

# onset check: the strongest transient near each lock / thump vs its video frame
hpx = hp(sfx.mean(1), 4500, 4)
checks = []
for lab, fr in [('plinth', 270)] + [(e['id'], e['frame']) for e in by_type['part_lock']]:
    i0 = int(t_of(fr) * SR)
    w = int(0.03 * SR)
    seg = np.abs(hpx[i0 - w:i0 + w]) if lab != 'plinth' else np.abs(lp(sfx.mean(1), 200)[i0 - w:i0 + w])
    first = int(np.argmax(seg > 0.3 * seg.max()))
    main = int(np.argmax(seg))
    checks.append({'event': lab, 'frame': fr, 'first_transient_ms': round((first - w) / SR * 1000, 1), 'main_transient_ms': round((main - w) / SR * 1000, 1)})

after = sfx[int(28.0 * SR):]
rep = {
    'voice_median_momentary_lufs': round(Vm, 2),
    'sfx_max_momentary_lufs': round(float(Ls.max()), 2),
    'sfx_max_momentary_minus_voice_db': round(float(Ls.max() - Vm), 2),
    'sfx_momentary_during_speech_median_minus_voice_db': round(float(np.median(np.interp(tv[speech], ts, Ls)) - Vm), 2),
    'sfx_short_term_max_minus_voice_short_term_median_db': round(float(Ls3.max() - np.median(Lv3[Lv3 > -40])), 2),
    'group_gain_db': {g: round(20 * np.log10(gain[g]), 2) for g in GROUPS},
    'sfx_integrated_lufs': round(integrated(sfx), 2),
    'voice_music_integrated_lufs': round(I_mix, 2),
    'master_integrated_lufs': round(I_master, 2),
    'master_true_peak_dbtp': round(TP_master, 2),
    'sfx_true_peak_dbtp': round(20 * np.log10(true_peak(sfx)), 2),
    'tp_guard_max_sfx_reduction_db': round(tp_guard_min_db, 2),
    'tp_guard_time_pct': round(float((G < 0.99).mean() * 100), 3),
    'sfx_max_momentary_pre_guard_minus_voice_db': round(float(Ls_pre.max() - Vm), 2),
    'sfx_peak_after_28s_dbfs': round(20 * np.log10(np.abs(after).max() + 1e-12), 1),
    'sfx_peak_after_29s_dbfs': round(20 * np.log10(np.abs(sfx[int(29.0 * SR):]).max() + 1e-12), 1),
    'last_onset_s': round(max(tm for tm, *_ in LOG), 3),
    'onset_offsets_ms': checks,
    'samples': len(sfx),
}
print(json.dumps(rep, indent=1, ensure_ascii=False))
json.dump(rep, open(f'{audio_dir}/../../out/sfx_report.json', 'w'), indent=1, ensure_ascii=False)

# ----------------------------------------------------------------------------------------------- plot
if plot_path:
    import matplotlib

    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    COL = {'snap': '#c0392b', 'power': '#c79100', 'marble': '#2e86c1', 'end': '#8e44ad'}
    fig = plt.figure(figsize=(18, 22))
    gs = fig.add_gridspec(5, 2, height_ratios=[1.45, 1.0, 1.0, 1.0, 0.9], hspace=0.45, wspace=0.12)
    tl = np.arange(N) / SR

    def marks(ax, lo=0, hi=30, top=True):
        for fr, lab in [(270, '9.0 click (music hit)'), (690, '23.0 end card (bass hit)'), (840, '28.0 freeze')]:
            if lo <= fr / FPS <= hi:
                ax.axvline(fr / FPS, color='k', lw=1.0, ls='--', alpha=0.55)
                if top:
                    ax.text(fr / FPS, 1.0, ' ' + lab, va='bottom', fontsize=8, transform=ax.get_xaxis_transform())

    # 1. event raster: one lane per kind of sound, one tick per onset
    ax = fig.add_subplot(gs[0, :])
    kinds = []
    for tm, lab, g, p_, db in LOG:
        k = lab.replace('first ', '')
        k = k.split(' ')[0] + ' ' + k.split(' ')[1] if k.startswith(('flight', 'lock', 'power-on')) else k
        k = {'flight web': 'flight whoosh', 'flight seo': 'flight whoosh', 'flight content': 'flight whoosh', 'flight social': 'flight whoosh', 'flight ads': 'flight whoosh'}.get(k, k)
        if k.startswith('lock '):
            k = 'part-lock click'
        if k.startswith('power-on '):
            k = 'module power-on swell'
        if k not in [x[0] for x in kinds]:
            kinds.append((k, g))
    lane = {k: i for i, (k, g) in enumerate(kinds[::-1])}
    # waveform underlay
    ax.fill_between(tl[::96], -0.5, -0.5 + 6 * np.abs(voice.mean(1)[::96]), color='#cccccc', lw=0, label='voice envelope')
    for tm, lab, g, p_, db in LOG:
        k = lab.replace('first ', '')
        if k.startswith('flight'):
            k = 'flight whoosh'
        elif k.startswith('lock '):
            k = 'part-lock click'
        elif k.startswith('power-on '):
            k = 'module power-on swell'
        y = lane[k] + 0.5
        big = lab.startswith(('lock', 'plinth', 'end-card', 'first', 'hero drop', 'power-on'))
        ax.plot([tm, tm], [y - (0.38 if big else 0.25), y + (0.38 if big else 0.25)], color=COL[g], lw=1.6 if big else 0.9)
        if lab.startswith('running hum'):
            ax.plot([tm, END_CUT / FPS], [y, y], color=COL[g], lw=3, alpha=0.5)
        if lab.startswith(('lock ', 'power-on ')):
            ax.text(tm, y + 0.42, lab.split(' ')[1], fontsize=6.5, ha='center', va='bottom', color=COL[g], rotation=90)
    ax.set_yticks([lane[k] + 0.5 for k, g in kinds])
    ax.set_yticklabels([k for k, g in kinds], fontsize=8)
    for t_, g in zip(ax.get_yticklabels(), [g for k, g in kinds]):
        t_.set_color(COL[g])
    ax.set_ylim(-0.6, len(kinds) + 0.2)
    ax.set_xlim(0, 30)
    ax.set_xticks(np.arange(0, 31, 1))
    ax.grid(axis='x', alpha=0.25)
    marks(ax)
    ax.set_title('SFX stem event timeline: every onset = video frame / 30 (events.json); grey = voice envelope', fontsize=11, pad=16)
    ax.set_xlabel('video time (s)')

    def zoom(axz, lo, hi, title, frames):
        i0, i1 = int(lo * SR), int(hi * SR)
        axz.plot(tl[i0:i1], voice.mean(1)[i0:i1], color='#c8c8c8', lw=0.5, label='voice')
        axz.plot(tl[i0:i1], music.mean(1)[i0:i1], color='#7f8c8d', lw=0.4, alpha=0.45, label='music')
        axz.plot(tl[i0:i1], sfx.mean(1)[i0:i1] * 2, color='#c0392b', lw=0.6, label='sfx (x2 for visibility)')
        for fr, lab in frames:
            axz.axvline(fr / FPS, color='#2c3e50', lw=0.7, alpha=0.6)
            axz.text(fr / FPS, 0.98, lab, rotation=90, fontsize=7, va='top', ha='right', transform=axz.get_xaxis_transform())
        axz.set_xlim(lo, hi)
        axz.set_title(title, fontsize=10)
        axz.legend(loc='lower left', fontsize=7)
        axz.set_xlabel('video time (s)')

    ax2 = fig.add_subplot(gs[1, 0])
    zf = [(251, 'breath'), (270, 'plinth 270')] + [(parts[m]['launch'], f'launch {m}') for m in parts] + [(parts[m]['lock'], f'lock {m} {parts[m]["lock"]}') for m in parts] + [(312.5, 'knock'), (320, 'knock')]
    zoom(ax2, 8.2, 10.8, 'Snap 8.2-10.8 s: lines = video frames of each event', zf)
    ax3 = fig.add_subplot(gs[1, 1])
    zoom(ax3, 22.6, 25.6, 'End card 22.6-25.6 s: shimmer on the 23.0 hit, pill pop', [(690, 'end hit 690'), (702, 'name 702'), (750, 'pill 750 (+4f)')])
    ax4 = fig.add_subplot(gs[2, 0])
    pf = [(parts[m]['powerOn'], f'power {m}') for m in parts] + [(318, 'bell entry')] + [(e['frame'], 'hop') for e in by_type['handoff_hop'] if e['frame'] < 455] + [(e['frame'], 'land') for e in by_type['heap_landing'] if e['frame'] < 455]
    zoom(ax4, 10.4, 15.2, 'Power-on 10.4-15.2 s: swells, first hops and heap landings', pf)
    ax5 = fig.add_subplot(gs[2, 1])
    zoom(ax5, 3.0, 4.6, 'Hero lead 3.0-4.6 s: rattle down the megaphone, drop at 119.7', [(98, 'rattle start 98'), (h1, 'drop 119.7')])

    ax6 = fig.add_subplot(gs[3, :])
    ax6.plot(tv, Lv, color='#888888', lw=0.8, label='voice momentary (400 ms)')
    ax6.plot(ts, Ls, color='#c0392b', lw=0.9, label='sfx momentary (400 ms)')
    ax6.axhline(Vm, color='#555555', ls='-', lw=0.8)
    ax6.axhspan(Vm - 10, Vm - 6, color='#27ae60', alpha=0.12)
    ax6.text(0.2, Vm + 0.6, f'voice median momentary {Vm:.1f} LUFS', fontsize=8)
    ax6.text(0.2, Vm - 9.6, 'band 6-10 dB under the voice (loudest SFX moments)', fontsize=8, color='#1e8449')
    ax6.set_ylim(-62, -5)
    ax6.set_xlim(0, 30)
    marks(ax6, top=False)
    ax6.legend(loc='lower right', fontsize=8)
    ax6.set_title(f'Loudness: sfx max momentary = voice median {Ls.max() - Vm:+.1f} dB | master (voice+music+sfx) {I_master:.2f} LUFS integrated, {TP_master:.2f} dBTP', fontsize=10)
    ax6.set_xlabel('video time (s)')

    ax7 = fig.add_subplot(gs[4, :])
    for tm, lab, g, p_, db in LOG:
        ax7.scatter([tm], [p_], color=COL[g], s=12)
    ax7.set_ylim(-1, 1)
    ax7.set_xlim(0, 30)
    ax7.axhline(0, color='#999999', lw=0.6)
    ax7.set_ylabel('pan  (L -1 ... +1 R)')
    ax7.set_title('Stereo placement per onset (from the 9:16 screen x of each source; flights pan along their path, mean shown)', fontsize=10)
    marks(ax7, top=False)
    ax7.set_xlabel('video time (s)')
    fig.savefig(plot_path, dpi=85, bbox_inches='tight')
    print('plot', plot_path)
