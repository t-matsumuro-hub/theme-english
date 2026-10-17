"""アプリアイコンを生成する。依存は Pillow のみ。

    python tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
BG = (29, 53, 87)
PAPER = (246, 244, 239)
ACCENT = (230, 57, 70)


def font(size):
    for f in ("C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/arialbd.ttf", "DejaVuSerif-Bold.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw(size, pad):
    s = size * 4
    img = Image.new("RGBA", (s, s), BG)
    d = ImageDraw.Draw(img)
    p = int(s * pad)
    # 新聞（記事）をイメージした紙
    d.rounded_rectangle((p, p, s - p, s - p), radius=int(s * 0.06), fill=PAPER)
    w = s - 2 * p
    for i in range(3):
        y = p + int(w * (0.66 + i * 0.09))
        d.rounded_rectangle((p + int(w * 0.14), y, s - p - int(w * (0.14 + (0.25 if i == 2 else 0))), y + int(w * 0.04)),
                            radius=int(w * 0.02), fill=(170, 176, 186))
    f = font(int(w * 0.42))
    t = "En"
    bb = d.textbbox((0, 0), t, font=f)
    d.text(((s - (bb[2] - bb[0])) / 2 - bb[0], p + int(w * 0.12) - bb[1]), t, font=f, fill=BG)
    d.rectangle((p + int(w * 0.14), p + int(w * 0.58), s - p - int(w * 0.14), p + int(w * 0.6)), fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
draw(180, 0.12).convert("RGB").save(os.path.join(OUT, "icon-180.png"))
draw(192, 0.12).save(os.path.join(OUT, "icon-192.png"))
draw(512, 0.12).save(os.path.join(OUT, "icon-512.png"))
draw(512, 0.2).save(os.path.join(OUT, "icon-maskable-512.png"))
print("ok")
