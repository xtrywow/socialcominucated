# End-card portrait prep (run by render.sh whenever public/img/portrait.png changes).
# The source is the relit end-card portrait (edges already decontaminated, hair re-cut with its fine strands,
# warm rim baked on screen-LEFT = the machine side, faint cool kicker on screen-right). So the base image is used
# as is (no choke: that would cut the restored flyaway strands) and these layers only tie it to the scene's light,
# in the SAME directions as the baked light. Writes (all match public/img/portrait* -> gitignored, never committed):
#   portrait_rim.png    rim light: warm gold on the screen-left edge (machine + light pool side), cool on the right
#   portrait_grade.png  soft-light grade layer clipped to the subject (warm key left, cool shadow right)
#   portrait_shadow.png soft dark silhouette (contact shadow on the wall)
import sys
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
out = src.rsplit('.', 1)[0]
im = Image.open(src).convert('RGBA')
a = np.asarray(im).astype(np.float32) / 255.0
A = a[..., 3]
H, W = A.shape


def gblur(x, r):
    return np.asarray(Image.fromarray(np.clip(x * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255.0


# ---- matte for the derived layers only: ~1.5 px choke so rim/shadow never sit outside the hair edge
Ai = Image.fromarray((A * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
A2 = np.clip((np.asarray(Ai).astype(np.float32) / 255.0 - 0.05) / 0.95, 0, 1)

# ---- rim: directional edge light from the alpha gradient
B = gblur(A2, 5)
gy, gx = np.gradient(B)
nx, ny = -gx, -gy
mag = np.sqrt(nx ** 2 + ny ** 2) + 1e-6
nx, ny = nx / mag, ny / mag
inner = np.clip(A2 - np.asarray(Image.fromarray((A2 * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(11))).astype(np.float32) / 255.0, 0, 1)
inner = gblur(inner, 2.2)


def lit(lx, ly):
    l = np.hypot(lx, ly)
    return np.clip((nx * lx + ny * ly) / l, 0, 1) ** 1.5


yy = np.linspace(0, 1, H)[:, None]
fall = np.clip(1.15 - yy * 1.25, 0.0, 1) * np.clip((yy - 0.12) / 0.1, 0, 1)  # sides of face + shoulders; hair top left clean
warm = np.clip(inner * lit(-0.97, -0.12) * A2 * fall * 0.7, 0, 1)  # screen-left: machine side (matches the baked rim)
cool = np.clip(inner * lit(0.97, -0.1) * A2 * fall * 0.45, 0, 1)  # screen-right: faint cool kicker
rim = np.zeros((H, W, 4), np.float32)
wc = np.array([1.0, 0.82, 0.55])
cc = np.array([0.62, 0.74, 1.0])
alpha = np.clip(warm + cool, 0, 1)
col = (warm[..., None] * wc + cool[..., None] * cc) / (alpha[..., None] + 1e-5)
rim[..., :3] = col
rim[..., 3] = alpha
Image.fromarray((np.clip(rim, 0, 1) * 255).astype(np.uint8), 'RGBA').save(out + '_rim.png')

# ---- grade: horizontal warm/cool split, clipped to the subject (used with soft-light)
xx = np.linspace(0, 1, W)[None, :]
t = np.clip((xx - 0.25) / 0.6, 0, 1)
g = np.zeros((H, W, 4), np.float32)
coolc = np.array([0.12, 0.2, 0.36])
warmc = np.array([0.98, 0.8, 0.52])
g[..., :3] = warmc * (1 - t[..., None]) + coolc * t[..., None]  # warm on the machine side (left), cool right
g[..., 3] = A2 * (0.55 + 0.2 * np.abs(t - 0.5) * 2)
Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8), 'RGBA').save(out + '_grade.png')

# ---- contact shadow
sh = gblur(A2, 24) * 0.8
s = np.zeros((H, W, 4), np.float32)
s[..., :3] = np.array([0.01, 0.025, 0.06])
s[..., 3] = sh
Image.fromarray((s * 255).astype(np.uint8), 'RGBA').save(out + '_shadow.png')
print('ok', W, H)
