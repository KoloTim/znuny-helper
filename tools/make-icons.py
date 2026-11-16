# -*- coding: utf-8 -*-
"""Erzeugt die Store-Icons (16/32/48/128) im Znuny-Look."""
import io, os
from PIL import Image, ImageDraw

ZIEL = r"C:\Users\TKO\Music\znuny-helper\znuny-helper-extension\icons"
os.makedirs(ZIEL, exist_ok=True)

ORANGE = (243, 146, 0, 255)
DUNKEL = (27, 18, 48, 255)
WEISS = (255, 255, 255, 255)


def icon(groesse):
    faktor = 8  # hohe Aufloesung, danach verkleinern (glatte Kanten)
    s = groesse * faktor
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    rand = max(2, int(s * 0.06))
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=DUNKEL)

    # Pac-Man: Kreis mit Keil nach rechts
    r = s * 0.30
    cx = s * 0.50
    cy = s * 0.50
    d.pieslice([cx - r, cy - r, cx + r, cy + r], start=34, end=326, fill=ORANGE)

    # Auge
    ar = max(1, int(s * 0.035))
    d.ellipse([cx - r * 0.1 - ar, cy - r * 0.5 - ar, cx - r * 0.1 + ar, cy - r * 0.5 + ar], fill=DUNKEL)

    # Punkt vor dem Mund
    pr = max(1, int(s * 0.045))
    px = cx + r * 0.72
    d.ellipse([px - pr, cy - pr, px + pr, cy + pr], fill=WEISS)

    return img.resize((groesse, groesse), Image.LANCZOS)


for g in (16, 32, 48, 128):
    p = os.path.join(ZIEL, f"icon-{g}.png")
    icon(g).save(p, "PNG")
    print("geschrieben:", p, os.path.getsize(p), "Bytes")
