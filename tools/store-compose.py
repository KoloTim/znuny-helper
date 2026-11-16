# -*- coding: utf-8 -*-
"""Store-Screenshots 1280x800: Popup oben und unten, Seitenbilder pruefen."""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = r"C:\Users\TKO\Music\znuny-helper\store\screenshots"
QUELLE = r"C:\Users\TKO\Music\znuny-helper\tools\browser\output\popup-store.png"

B, H = 1280, 800
HINTERGRUND = (238, 241, 245, 255)


def rahmen(bild, breite=B, hoehe=H):
    """Setzt das Bild mittig auf eine 1280x800-Flaeche mit weichem Schatten."""
    flaeche = Image.new("RGBA", (breite, hoehe), HINTERGRUND)

    x = (breite - bild.width) // 2
    y = (hoehe - bild.height) // 2

    schatten = Image.new("RGBA", (breite, hoehe), (0, 0, 0, 0))
    d = ImageDraw.Draw(schatten)
    d.rounded_rectangle([x + 6, y + 10, x + bild.width + 6, y + bild.height + 10], radius=14, fill=(23, 28, 40, 90))
    schatten = schatten.filter(ImageFilter.GaussianBlur(18))
    flaeche.alpha_composite(schatten)
    flaeche.alpha_composite(bild, (x, y))

    d2 = ImageDraw.Draw(flaeche)
    d2.rounded_rectangle([x, y, x + bild.width - 1, y + bild.height - 1], radius=12, outline=(206, 213, 222, 255), width=1)
    return flaeche.convert("RGB")


def lade():
    return Image.open(QUELLE).convert("RGBA")


def zuschnitt(bild, oben, hoehe):
    kasten = (0, oben, bild.width, min(bild.height, oben + hoehe))
    return bild.crop(kasten)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    popup = lade()
    print("Popup:", popup.size)

    # 1) Kopfbereich: Kopfzeile, "Alle Funktionen", erste Rubriken
    oben = zuschnitt(popup, 0, 780)
    rahmen(oben).save(os.path.join(OUT, "popup-oben.png"), "PNG")

    # 2) Fuss: Saison, Hilfe, Minispiele (die neue Position)
    unten = zuschnitt(popup, popup.height - 780, 780)
    rahmen(unten).save(os.path.join(OUT, "popup-unten.png"), "PNG")

    for name in ("popup-oben.png", "popup-unten.png"):
        p = os.path.join(OUT, name)
        print(name, Image.open(p).size, os.path.getsize(p), "Bytes")

    # 3) Seitenbilder pruefen (muessen 1280x800 sein)
    for name in ("agent-uebersicht.png", "agent-ticket-zoom.png", "agent-suche.png"):
        p = os.path.join(OUT, name)
        bild = Image.open(p)
        print(name, bild.size, os.path.getsize(p), "Bytes")
