"""Generate customer Android launcher and Flutter header branding from the
single approved Easy Mandi shopping-cart symbol used by the website.

Run from the repository root after flutter create. Requires Pillow.
"""
from pathlib import Path
from io import BytesIO
import base64
import re
from PIL import Image

source = Path("web/brand-symbol.svg").read_text(encoding="utf-8")
match = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", source)
if not match:
    raise SystemExit("Master Easy Mandi icon is missing from web/brand-symbol.svg")

image = Image.open(BytesIO(base64.b64decode(match.group(1), validate=True))).convert("RGBA")
if image.width != image.height or image.width < 128:
    raise SystemExit("Easy Mandi brand artwork must be a square of at least 128px")

asset = Path("assets/brand-symbol.png")
asset.parent.mkdir(parents=True, exist_ok=True)
image.resize((512, 512), Image.Resampling.LANCZOS).save(asset, optimize=True)

root = Path("android/app/src/main/res")
for density, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    folder = root / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(folder / "ic_launcher.png", optimize=True)

print("Easy Mandi customer launcher and header generated from master brand.")
