"""Generate Play Store marketing assets (feature graphic + icon) in the brand style.
Dark cinematic background + red accent + Italian tricolor. Uses Pillow."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "marketing", "assets")
os.makedirs(OUT, exist_ok=True)

BG = (5, 5, 5)
RED = (230, 57, 70)
WHITE = (248, 248, 246)
MUTED = (140, 140, 134)
GREEN_F = (0, 146, 70)
WHITE_F = (244, 245, 240)
RED_F = (206, 43, 55)

FONTS = [
    "C:\\Windows\\Fonts\\impact.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\seguisb.ttf",
]
def font(size):
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

def glow_bg(w, h, cx, cy, r=None, color=(70, 14, 18)):
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    r = r or int(min(w, h) * 0.6)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    img = img.filter(ImageFilter.GaussianBlur(max(w, h) // 8))
    return img

def tricolor(draw, x, y, w, h):
    sw = w / 3
    draw.rectangle([x, y, x + sw, y + h], fill=GREEN_F)
    draw.rectangle([x + sw, y, x + 2 * sw, y + h], fill=WHITE_F)
    draw.rectangle([x + 2 * sw, y, x + w, y + h], fill=RED_F)

# ---------------- FEATURE GRAPHIC 1024x500 ----------------
W, H = 1024, 500
fg = glow_bg(W, H, int(W * 0.32), int(H * 0.38))
d = ImageDraw.Draw(fg)
f_big = font(120)
d.text((60, 120), "ACCADDE", font=f_big, fill=WHITE)
d.rectangle([60, 262, 130, 276], fill=RED)
d.text((150, 250), "OGGI", font=f_big, fill=RED)
f_tag = font(26)
d.text((62, 392), "LA STORIA · OGNI GIORNO · SU DI TE", font=f_tag, fill=MUTED)
tricolor(d, 62, 446, 46, 30)
d.text((118, 450), "MADE IN ITALY", font=font(22), fill=MUTED)
fg.save(os.path.join(OUT, "feature_graphic.png"))
print("wrote feature_graphic.png", fg.size)

# ---------------- STORE ICON 512x512 ----------------
S = 512
ic = glow_bg(S, S, S // 2, int(S * 0.42), r=int(S * 0.5))
d = ImageDraw.Draw(ic)
fm = font(300)
# "AO" monogram: A white, O red, centered
text = "AO"
bbox = d.textbbox((0, 0), text, font=fm)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
ax = (S - tw) // 2 - bbox[0]
ay = (S - th) // 2 - bbox[1] - 20
# draw A then O with different colors
a_bbox = d.textbbox((0, 0), "A", font=fm)
aw = a_bbox[2] - a_bbox[0]
d.text((ax, ay), "A", font=fm, fill=WHITE)
d.text((ax + aw - 6, ay), "O", font=fm, fill=RED)
tricolor(d, S // 2 - 60, S - 96, 120, 26)
ic.save(os.path.join(OUT, "store_icon.png"))
print("wrote store_icon.png", ic.size)
print("done")
