"""Generate Easy Mandi launcher icon in the Android density folders."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('android/app/src/main/res')
for density, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    scale = 4
    image = Image.new('RGBA', (size * scale, size * scale), '#176b46')
    draw = ImageDraw.Draw(image)
    n = size * scale
    draw.rounded_rectangle((n * .16, n * .44, n * .84, n * .77), radius=n * .09, fill='#fffdf3')
    draw.arc((n * .29, n * .21, n * .71, n * .68), 180, 360, fill='#fffdf3', width=int(n * .09))
    for x, y, color in ((.34, .42, '#f4b443'), (.50, .39, '#e6654b'), (.65, .42, '#a6d37e')):
        r = n * .105
        draw.ellipse((n*x-r, n*y-r, n*x+r, n*y+r), fill=color)
    for x in (.37, .50, .63):
        draw.rounded_rectangle((n*x-n*.018, n*.54, n*x+n*.018, n*.70), radius=n*.012, fill='#9dcba9')
    draw.ellipse((n*.26, n*.78, n*.38, n*.90), fill='#f7e9c6')
    draw.ellipse((n*.62, n*.78, n*.74, n*.90), fill='#f7e9c6')
    folder = root / f'mipmap-{density}'
    folder.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(folder / 'ic_launcher.png')
