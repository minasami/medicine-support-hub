#!/usr/bin/env python3
"""Generate Gallery-style full-bleed Android launcher icons (no nested circular plate).

Uses apps/web/public/medicine-support-hub-logo.png (transparent outside the mark).
Adaptive foreground: mark ~84% of 108dp canvas, transparent outside.
Legacy launcher / round: white plate, mark ~90% fill.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps/web/public/medicine-support-hub-logo.png"
RES = ROOT / "android/app/src/main/res"
WHITE = (255, 255, 255, 255)

FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
LG = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def trim_transparent(im: Image.Image) -> Image.Image:
    a = np.array(im)
    mask = a[:, :, 3] > 8
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def fit_mark(mark, canvas_size, fill=0.84, bg=None, circle_mask=False):
    W = H = canvas_size
    target = int(min(W, H) * fill)
    mw, mh = mark.size
    scale = target / max(mw, mh)
    nw, nh = max(1, int(mw * scale)), max(1, int(mh * scale))
    resized = mark.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (W, H), bg if bg is not None else (0, 0, 0, 0))
    canvas.paste(resized, ((W - nw) // 2, (H - nh) // 2), resized)
    if circle_mask:
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, W - 1, H - 1), fill=255)
        out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        return out
    return canvas


def main() -> None:
    mark = trim_transparent(Image.open(SRC).convert("RGBA"))
    for folder, size in FG.items():
        fit_mark(mark, size, fill=0.84, bg=None).save(
            RES / folder / "ic_launcher_foreground.png", optimize=True
        )
    for folder, size in LG.items():
        fit_mark(mark, size, fill=0.90, bg=WHITE).save(
            RES / folder / "ic_launcher.png", optimize=True
        )
        fit_mark(mark, size, fill=0.90, bg=WHITE, circle_mask=True).save(
            RES / folder / "ic_launcher_round.png", optimize=True
        )
    print("Launcher icons regenerated (full-bleed / no nested plate).")


if __name__ == "__main__":
    main()
