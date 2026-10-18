#!/usr/bin/env python3
"""Uniform delivery-headroom trim on the approved voice + music stems (no creative change).

The MP4's AAC encode overshoots the stem sum's true peak by ~0.04 dB (stems -1.02 dBTP -> MP4 -0.98 dBTP at 16.85 s
and 25.44 s). A flat gain on both post-bus stems keeps the approved balance and gives a clean -1 dBTP margin.
Run once; it records the applied gain in <audio_dir>/.trim_db so it is never applied twice.

usage: trim_stems.py <audio_dir> <gain_db> [backup_dir]
"""
import os
import shutil
import sys

import numpy as np
import soundfile as sf

d, gdb = sys.argv[1], float(sys.argv[2])
bak = sys.argv[3] if len(sys.argv) > 3 else None
mark = os.path.join(d, '.trim_db')
if os.path.exists(mark):
    sys.exit(f'already trimmed by {open(mark).read().strip()} dB ({mark}); restore the stems first')
g = 10 ** (gdb / 20)
for name in ('voice.wav', 'music.wav'):
    p = os.path.join(d, name)
    if bak:
        os.makedirs(bak, exist_ok=True)
        shutil.copy2(p, os.path.join(bak, name))
    x, sr = sf.read(p, always_2d=True, dtype='float64')
    info = sf.info(p)
    sf.write(p, x * g, sr, subtype=info.subtype)
    print(f'{name}: {gdb:+.2f} dB, peak {20 * np.log10(np.abs(x * g).max()):.2f} dBFS, {len(x) / sr:.3f} s')
open(mark, 'w').write(f'{gdb}\n')
