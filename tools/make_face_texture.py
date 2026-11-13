#!/usr/bin/env python3
"""Turn the teacher photo into the textures used by the 3D head.

    python3 tools/make_face_texture.py [assets/source/teacher_photo_crop.png]

Outputs (assets/textures/):
  teacher_face.jpg   600x900, face centred at x=300; crop px (x,y) -> (x-84, y+150)
  teacher_eyes.jpg   emissive mask of the white eye crescents (they glow in the dark)
  teacher_portrait.jpg  small portrait used by the UI / phone scare
The background (wall, shirt, suit) is removed and replaced by the nearest face
colours (push-pull inpainting) so the planar projection has no grey fringes.
"""
import sys
from collections import deque
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets/source/teacher_photo_crop.png")
OUT = os.path.join(ROOT, "assets/textures")
c = Image.open(src).convert("RGB")
a = np.asarray(c).astype(float)
H, W, _ = a.shape
yy, xx = np.mgrid[0:H, 0:W]
mx = a.max(-1); sat = mx - a.min(-1); r, b = a[..., 0], a[..., 2]
fill = (mx > 140) & (sat < 30)                       # wall + shirt
fill |= (yy > 540) & (mx < 70) & (b >= r - 8)        # suit
fill |= (mx < 35) & ((yy < 60) | (yy > 690)) & ((xx < 60) | (xx > 690))  # rounded corners
fill |= (xx > 700) & (yy < 40)                       # browser icon


def flood(mask, seeds):
    out = np.zeros_like(mask)
    q = deque()
    for s in seeds:
        if mask[s]:
            out[s] = True; q.append(s)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out


head = flood(~fill, [(300, 375)])
head &= ~((yy > 540) & ((xx < 205) | (xx > 565)))
border = [(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)]
inside = ~flood(~head, border)
inside = np.asarray(Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) > 127

CW, CH, X0, Y0 = 600, 900, 84, -150
img = np.zeros((CH, CW, 3)); msk = np.zeros((CH, CW))
img[-Y0:-Y0 + H] = a[:, X0:X0 + CW]
msk[-Y0:-Y0 + H] = inside[:, X0:X0 + CW]


def pushpull(img, msk):
    levels = [(img * msk[..., None], msk)]
    while min(levels[-1][1].shape) > 2:
        ci, cm = levels[-1]
        h, w = cm.shape; h2, w2 = h // 2 * 2, w // 2 * 2
        ci, cm = ci[:h2, :w2], cm[:h2, :w2]
        levels.append((ci.reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3)), cm.reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))))
    norm = [(si / np.maximum(sm, 1e-6)[..., None], np.minimum(sm, 1)) for si, sm in levels]
    cur = norm[-1][0]
    for ni, nm in reversed(norm[:-1]):
        h, w = nm.shape
        up = np.asarray(Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)).astype(float)
        cur = ni * nm[..., None] + up * (1 - nm[..., None])
    return cur


out = pushpull(img, msk)
blur = np.asarray(Image.fromarray(out.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(float)
soft = np.asarray(Image.fromarray((msk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float) / 255
final = out * soft[..., None] + blur * (1 - soft[..., None])
Image.fromarray(np.clip(final, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "teacher_face.jpg"), quality=90)

eyes = np.zeros((H, W))
for ex, ey in ((293, 160), (462, 155)):
    d = np.hypot(xx - ex, yy - ey)
    eyes = np.maximum(eyes, ((d < 70) & (mx > 150) & (sat < 60)).astype(float))
em = np.zeros((CH, CW)); em[-Y0:-Y0 + H] = eyes[:, X0:X0 + CW]
Image.fromarray((em * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).convert("RGB").save(
    os.path.join(OUT, "teacher_eyes.jpg"), quality=92)
c.crop((60, 0, 710, 700)).resize((520, 560)).save(os.path.join(OUT, "teacher_portrait.jpg"), quality=88)
print("textures written to", OUT)
