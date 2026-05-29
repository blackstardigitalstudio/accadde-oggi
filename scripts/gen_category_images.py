"""Generate dark cinematic category background images (no external deps).

These replace the former remote-CDN images. They sit behind a heavy dark
gradient (85-95% black) in the app, so they only provide atmospheric, category-
tinted texture. Pure-Python PNG writer -> works on any Python 3 install.
"""
import os
import math
import zlib
import struct

OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets", "images", "categories")
os.makedirs(OUT, exist_ok=True)

W, H = 720, 1080

# (r, g, b) accent per category — kept muted; the app darkens them heavily.
CATEGORIES = {
    "wars":    (230, 57, 70),
    "science": (58, 134, 255),
    "sports":  (255, 140, 40),
    "culture": (170, 110, 230),
}


def _png(width, height, rgb_rows):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = bytearray()
    for row in rgb_rows:
        raw.append(0)  # filter type 0
        raw.extend(row)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit, truecolor
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def gen(accent):
    ar, ag, ab = accent
    cx, cy = W * 0.5, H * 0.32          # glow centre (upper third)
    maxd = math.hypot(W, H)
    rows = []
    for y in range(H):
        row = bytearray()
        for x in range(W):
            # diagonal base gradient: darker bottom-left -> slightly lighter top-right
            diag = (x + (H - y)) / (W + H)          # 0..1
            base = 6 + diag * 14                      # 6..20 (very dark)
            # soft radial glow of the accent colour
            d = math.hypot(x - cx, y - cy) / maxd     # 0..~0.8
            glow = max(0.0, 1.0 - d * 2.1) ** 2       # 0..1
            # vignette toward edges
            vig = 1.0 - (math.hypot(x - W / 2, y - H / 2) / maxd) * 0.5
            r = base + ar * glow * 0.22
            g = base + ag * glow * 0.22
            b = base + ab * glow * 0.22
            r *= vig; g *= vig; b *= vig
            row.append(max(0, min(255, int(r))))
            row.append(max(0, min(255, int(g))))
            row.append(max(0, min(255, int(b))))
        rows.append(row)
    return _png(W, H, rows)


for name, accent in CATEGORIES.items():
    data = gen(accent)
    path = os.path.join(OUT, f"{name}.png")
    with open(path, "wb") as f:
        f.write(data)
    print(f"wrote {path} ({len(data)} bytes)")

print("done")
