#!/usr/bin/env python3
"""Write the composition's voice/music stems as POST-BUS stems.

The chain-B mix exports its stems before the master bus (glue 1.5:1 + makeup + TP limiter), so
voice_stem + music_stem sums to ~-17.3 LUFS, not the -14 LUFS master. The bus is a single linked
gain curve (work/bus_gain.npy), so (voice * g) + (music * g) == mix.wav to < -120 dBFS. Writing the
stems with g applied lets the composition play them at volume 1.0 and land exactly on the master.

usage: stems_postbus.py <chain_dir> <out_dir>
  <chain_dir> holds voice_stem.wav, music_stem.wav, mix.wav, work/bus_gain.npy
  writes <out_dir>/voice.wav and <out_dir>/music.wav (48 kHz stereo, PCM 24, exactly 30.000 s)
"""
import os
import sys

import numpy as np
import soundfile as sf

SR = 48000
N = 30 * SR

src, out = sys.argv[1], sys.argv[2]
v, sr1 = sf.read(os.path.join(src, 'voice_stem.wav'), always_2d=True)
m, sr2 = sf.read(os.path.join(src, 'music_stem.wav'), always_2d=True)
assert sr1 == sr2 == SR, (sr1, sr2)
assert len(v) == len(m) == N, (len(v), len(m))
g = np.load(os.path.join(src, 'work', 'bus_gain.npy')).astype(np.float64)
assert g.shape == (N,), g.shape
vp, mp = v * g[:, None], m * g[:, None]
mix_path = os.path.join(src, 'mix.wav')
if os.path.exists(mix_path):
    x, _ = sf.read(mix_path, always_2d=True)
    resid = np.abs(vp + mp - x).max()
    print(f'post-bus reconstruction residual vs mix.wav: {20 * np.log10(resid + 1e-15):.1f} dBFS')
os.makedirs(out, exist_ok=True)
sf.write(os.path.join(out, 'voice.wav'), vp, SR, subtype='PCM_24')
sf.write(os.path.join(out, 'music.wav'), mp, SR, subtype='PCM_24')
print('wrote', os.path.join(out, 'voice.wav'), os.path.join(out, 'music.wav'))
