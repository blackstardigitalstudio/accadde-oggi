"""Apply the provided AO logo as the app icon across the required sizes."""
import os
from PIL import Image

SRC = r"D:\coqueta\WhatsApp Image 2026-04-18 at 19.34.35.jpeg"
DESTS = [
    r"D:\accadde_clone\frontend\assets\images",
    r"D:\accadde oggi\accadde-oggi-main\accadde-oggi-main\frontend\assets\images",
]
STORE = r"D:\accadde_clone\marketing\assets"

img = Image.open(SRC).convert("RGB")
w, h = img.size
s = min(w, h)
img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))  # square

bg = img.getpixel((6, 6))  # navy background sample
bg_hex = "#%02X%02X%02X" % bg
print("bg_hex:", bg_hex)

icon = img.resize((1024, 1024), Image.LANCZOS)
favicon = img.resize((196, 196), Image.LANCZOS)

# Adaptive foreground: logo centered with padding on the navy background (safe zone friendly)
adaptive = Image.new("RGB", (1024, 1024), bg)
logo = img.resize((760, 760), Image.LANCZOS)
adaptive.paste(logo, ((1024 - 760) // 2, (1024 - 760) // 2))

for d in DESTS:
    os.makedirs(d, exist_ok=True)
    icon.save(os.path.join(d, "icon.png"))
    adaptive.save(os.path.join(d, "adaptive-icon.png"))
    favicon.save(os.path.join(d, "favicon.png"))
    print("wrote icons to", d)

os.makedirs(STORE, exist_ok=True)
img.resize((512, 512), Image.LANCZOS).save(os.path.join(STORE, "store_icon.png"))
print("wrote store_icon.png 512 (overwritten with AO logo)")
print("done")
