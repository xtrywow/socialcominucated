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
    sig: {x: number; y: number; w: number}; // machine signature caption (under the small machine)
    machinePool: {x: number; y: number; r: number};
    fadeFrom: number; // y where the portrait starts fading into navy
    fadeTo: number;
    blur: number;
  };
  safe: [number, number]; // y range for text + key action
};

const AI_LINES_2 = [
  ['سیستمی', 'که', 'با', 'هوش', 'مصنوعی،'],
  ['شبانه‌روز', 'برات', 'مشتری', 'پیدا', 'می‌کنه.'],
];

export const LAYOUTS: Record<LayoutId, Layout> = {
  '9x16': {
    id: '9x16',
    W: 1080,
    H: 1920,
    cams: {
      f1: {target: [0.1, 3.5, 0], yaw: 20, pitch: 9, ppu: 98, fov: 24, anchor: [540, 1205]},
      run: {target: [0.05, 3.55, 0], yaw: 5, pitch: 8, ppu: 106, fov: 24, anchor: [560, 1175]},
      late: {target: [0.05, 3.6, 0], yaw: -4, pitch: 7, ppu: 118, fov: 24, anchor: [552, 1075]},
      endA: {target: [0.0, 3.6, 0], yaw: -10, pitch: 6, ppu: 62, fov: 22, anchor: [205, 1010]},
      endB: {target: [0.0, 3.6, 0], yaw: -12, pitch: 6, ppu: 46, fov: 22, anchor: [190, 1045]},
    },
    text: {
      f1: {top: 222, right: 84, width: 912, size: 112, lh: 1.24, align: 'right'},
      tension: {top: 222, right: 84, width: 912, size: 112, lh: 1.24, align: 'right'},
      connect: {top: 222, right: 84, width: 912, size: 100, lh: 1.26, align: 'right'},
      ai: {top: 230, right: 84, width: 912, size: 76, lh: 1.42, align: 'right'},
      aiLines: AI_LINES_2,
    },
    end: {
      portrait: {cx: 600, headTop: 585, headW: 380},
      pool: {x: 600, y: 860, rx: 560, ry: 640},
      name: {top: 226, right: 84, width: 912, size: 132, align: 'right'},
      role: {size: 44},
      pill: {top: 1400, right: 84, size: 42},
      url: {size: 34},
      sig: {x: 190, y: 1300, w: 340},
      machinePool: {x: 190, y: 1120, r: 300},
      fadeFrom: 1250,
      fadeTo: 1560,
      blur: 2.2,
    },
    safe: [220, 1600],
  },
  '16x9': {
    id: '16x9',
    W: 1920,
    H: 1080,
    cams: {
      f1: {target: [0.1, 3.5, 0], yaw: 20, pitch: 9, ppu: 96, fov: 22, anchor: [600, 560]},
      run: {target: [0.05, 3.55, 0], yaw: 5, pitch: 8, ppu: 104, fov: 22, anchor: [600, 548]},
      late: {target: [0.05, 3.6, 0], yaw: -4, pitch: 7, ppu: 110, fov: 22, anchor: [610, 548]},
      endA: {target: [0.0, 3.6, 0], yaw: -10, pitch: 6, ppu: 62, fov: 20, anchor: [290, 560]},
      endB: {target: [0.0, 3.6, 0], yaw: -12, pitch: 6, ppu: 48, fov: 20, anchor: [270, 585]},
    },
    text: {
      f1: {top: 250, right: 110, width: 720, size: 100, lh: 1.24, align: 'right'},
      tension: {top: 300, right: 110, width: 720, size: 100, lh: 1.24, align: 'right'},
      connect: {top: 300, right: 110, width: 720, size: 92, lh: 1.26, align: 'right'},
      ai: {top: 330, right: 110, width: 720, size: 68, lh: 1.42, align: 'right'},
      aiLines: AI_LINES_2,
    },
    end: {
      portrait: {cx: 1330, headTop: 150, headW: 300},
      pool: {x: 1330, y: 420, rx: 520, ry: 560},
      name: {top: 300, right: 860, width: 640, size: 112, align: 'right'},
      role: {size: 38},
      pill: {top: 0, right: 860, size: 36},
      url: {size: 30},
      sig: {x: 270, y: 815, w: 360},
      machinePool: {x: 270, y: 640, r: 260},
      fadeFrom: 820,
      fadeTo: 1080,
      blur: 2.0,
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
