#!/usr/bin/env python3
# Gera as imagens de lançamento do iOS em public/splash-ios/: só o fundo do
# SplashIA (gradiente escuro + brilho suave da marca), sem logo. A lista de
# tamanhos é a mesma de src/lib/ios-startup.ts — mude lá e aqui juntos.
#
#   pip install pillow numpy && python3 scripts/gerar-splash-ios.py

import os
import numpy as np
from PIL import Image

TELAS = [
    (440, 956, 3), (430, 932, 3), (428, 926, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3),
    (402, 874, 3), (393, 852, 3), (390, 844, 3), (375, 812, 3), (375, 667, 2),
    (1024, 1366, 2), (834, 1194, 2), (834, 1112, 2), (820, 1180, 2), (810, 1080, 2), (768, 1024, 2),
]

# Mesmas paradas do gradiente do SplashIA (160deg: #161b23 0% → #0f1319 55% → #0a0d12 100%).
PARADAS = [(0.0, (0x16, 0x1B, 0x23)), (0.55, (0x0F, 0x13, 0x19)), (1.0, (0x0A, 0x0D, 0x12))]
BRILHO = (255, 184, 28)


def gradiente(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    ang = np.deg2rad(160)
    dx, dy = np.sin(ang), -np.cos(ang)
    proj = (x - w / 2) * dx + (y - h / 2) * dy
    metade = abs(w / 2 * dx) + abs(h / 2 * dy)
    t = np.clip((proj + metade) / (2 * metade), 0, 1)
    img = np.zeros((h, w, 3))
    for (t0, c0), (t1, c1) in zip(PARADAS, PARADAS[1:]):
        m = (t >= t0) & (t <= t1)
        f = ((t[m] - t0) / (t1 - t0))[:, None]
        img[m] = np.array(c0) * (1 - f) + np.array(c1) * f
    # brilho radial atrás de onde o emblema vai aparecer
    r = np.hypot(x - w / 2, y - h / 2) / (min(w, h) * 0.5)
    a = 0.10 * np.clip(1 - r / 0.7, 0, 1) ** 2
    img = img * (1 - a[..., None]) + np.array(BRILHO) * a[..., None]
    return Image.fromarray(np.clip(np.round(img), 0, 255).astype(np.uint8), "RGB")


def main():
    raiz = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "splash-ios")
    os.makedirs(raiz, exist_ok=True)
    for lw, lh, esc in TELAS:
        w, h = lw * esc, lh * esc
        caminho = os.path.join(raiz, f"{w}x{h}.png")
        gradiente(w, h).save(caminho, optimize=True)
        print(caminho, os.path.getsize(caminho) // 1024, "KB")


if __name__ == "__main__":
    main()
