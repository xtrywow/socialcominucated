// Per-layout framing: cameras, text boxes, end-card placement. One place for both formats.
export type LayoutId = '9x16' | '16x9';

// Camera = orbit around `target` + a lens shift that pins `target` to screen point `anchor` (px).
export type Cam = {
  target: [number, number, number];
  yaw: number; // deg, + = camera to the right of the machine
  pitch: number; // deg, + = camera above
  ppu: number; // pixels per world unit at the target distance (framing scale)
  fov: number; // deg (vertical)
  anchor: [number, number]; // px where target lands on screen
};

export type TextBox = {top: number; right: number; width: number; size: number; lh: number; align: 'right'};

export type Layout = {
  id: LayoutId;
  W: number;
  H: number;
  cams: {
    f1: Cam; // 0-258 scattered
    run: Cam; // assembled, after the push-in + orbit
    late: Cam; // 16-23 s: day -> night, slow push
    endA: Cam; // 23.0 cut
    endB: Cam; // settled end-card framing (machine as a signature)
  };
  text: {
    f1: TextBox; // three short lines
    tension: TextBox;
    connect: TextBox;
    ai: TextBox; // long sentence, 2 lines max
    aiLines: string[][]; // explicit line breaks
  };
  // end card
  end: {
    portrait: {cx: number; headTop: number; headW: number}; // head centre x, head top y, head width (px)
    pool: {x: number; y: number; rx: number; ry: number};
    name: {top: number; right: number; width: number; size: number; align: 'right'};
    role: {size: number};
    pill: {top: number; right: number; size: number};
    url: {size: number};
    sig: {x: number; y: number; w: number} | null; // machine signature caption (under the small machine); null = none
    machinePool: {x: number; y: number; r: number};
    fadeFrom: number; // y where the portrait starts fading into navy
    fadeTo: number;
    blur: number;
  };
  safe: [number, number]; // y range for text + key action
};

const ZW = '\u200c';
const AI_LINES_2 = [
  ['سیستمی', 'که', 'با', 'هوش', 'مصنوعی،'],
  [`شبانه${ZW}روز`, 'برات', 'مشتری', 'پیدا', `می${ZW}کنه.`],
];

export const LAYOUTS: Record<LayoutId, Layout> = {
  '9x16': {
    id: '9x16',
    W: 1080,
    H: 1920,
    cams: {
      // 9:16 safe area: the whole machine (scattered, snap and run) stays inside y 220..1600
      f1: {target: [0.15, 3.4, 0], yaw: 18, pitch: 9, ppu: 100, fov: 24, anchor: [540, 1186]},
      run: {target: [0.0, 3.6, 0], yaw: 3, pitch: 8, ppu: 112, fov: 24, anchor: [552, 1126]},
      late: {target: [0.0, 3.6, 0], yaw: -5, pitch: 7, ppu: 128, fov: 24, anchor: [548, 1040]},
      // end card: the small machine sits low beside his left shoulder; the shoulder overlaps its plinth (depth)
      endA: {target: [0.0, 3.6, 0], yaw: -10, pitch: 6, ppu: 62, fov: 22, anchor: [238, 1068]},
      endB: {target: [0.0, 3.6, 0], yaw: -12, pitch: 6, ppu: 46, fov: 22, anchor: [226, 1102]},
    },
    text: {
      f1: {top: 222, right: 84, width: 912, size: 112, lh: 1.24, align: 'right'},
      tension: {top: 222, right: 84, width: 912, size: 112, lh: 1.24, align: 'right'},
      connect: {top: 222, right: 84, width: 912, size: 100, lh: 1.26, align: 'right'},
      ai: {top: 232, right: 72, width: 936, size: 70, lh: 1.4, align: 'right'},
      aiLines: AI_LINES_2,
    },
    end: {
      portrait: {cx: 600, headTop: 585, headW: 380},
      pool: {x: 600, y: 860, rx: 560, ry: 640},
      name: {top: 226, right: 84, width: 912, size: 132, align: 'right'},
      role: {size: 44},
      pill: {top: 1430, right: 116, size: 42}, // inset from the right edge (Reels/TikTok action rail)
      url: {size: 34},
      sig: null, // the Latin caption would sit on his shoulder in 9:16 -> dropped (brief: >= 28 px or drop it)
      machinePool: {x: 226, y: 1165, r: 300},
      fadeFrom: 1300, // below the machine's plinth (y <= 1295): the fade never reveals the machine through him
      fadeTo: 1580,
      blur: 3.2,
    },
    safe: [220, 1600],
  },
  '16x9': {
    id: '16x9',
    W: 1920,
    H: 1080,
    cams: {
      f1: {target: [0.1, 3.5, 0], yaw: 20, pitch: 9, ppu: 96, fov: 22, anchor: [600, 560]},
      run: {target: [0.05, 3.55, 0], yaw: 5, pitch: 8, ppu: 104, fov: 22, anchor: [600, 528]},
      late: {target: [0.05, 3.6, 0], yaw: -4, pitch: 7, ppu: 106, fov: 22, anchor: [610, 526]},
      endA: {target: [0.0, 3.6, 0], yaw: -10, pitch: 6, ppu: 62, fov: 20, anchor: [250, 560]},
      // the signature sits 45 px further left than before: its soft edge keeps >= 80 px from the text column
      endB: {target: [0.0, 3.6, 0], yaw: -12, pitch: 6, ppu: 48, fov: 20, anchor: [225, 585]},
    },
    text: {
      f1: {top: 270, right: 110, width: 800, size: 92, lh: 1.26, align: 'right'},
      tension: {top: 330, right: 110, width: 800, size: 92, lh: 1.26, align: 'right'},
      connect: {top: 290, right: 110, width: 800, size: 86, lh: 1.28, align: 'right'},
      ai: {top: 380, right: 110, width: 800, size: 58, lh: 1.45, align: 'right'},
      aiLines: AI_LINES_2,
    },
    end: {
      portrait: {cx: 1450, headTop: 150, headW: 300}, // right of centre; his shoulder clears the URL line by >= 70 px
      pool: {x: 1450, y: 420, rx: 520, ry: 560},
      name: {top: 300, right: 875, width: 640, size: 112, align: 'right'},
      // CTA sized for 16:9 played full-width on a phone (~390 pt wide): pill ~9 pt, URL ~7.7 pt; the role line stays
      // on one line in the 640 px column (39 px is its maximum)
      role: {size: 39},
      pill: {top: 0, right: 875, size: 44},
      url: {size: 38},
      sig: {x: 225, y: 815, w: 360},
      machinePool: {x: 225, y: 640, r: 260},
      fadeFrom: 820,
      fadeTo: 1080,
      blur: 2.8,
    },
    safe: [60, 1020],
  },
};

export const lerpCam = (a: Cam, b: Cam, t: number): Cam => {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    target: [l(a.target[0], b.target[0]), l(a.target[1], b.target[1]), l(a.target[2], b.target[2])],
    yaw: l(a.yaw, b.yaw),
    pitch: l(a.pitch, b.pitch),
    ppu: l(a.ppu, b.ppu),
    fov: l(a.fov, b.fov),
    anchor: [l(a.anchor[0], b.anchor[0]), l(a.anchor[1], b.anchor[1])],
  };
};
