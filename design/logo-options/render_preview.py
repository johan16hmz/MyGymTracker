from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).parent
options = [
    ("A", "Géométrique", "a-geometric.png"),
    ("B", "Powerlift", "b-lift.png"),
    ("C", "Disque", "c-plate.png"),
    ("D", "Progression", "d-progress.png"),
]

canvas = Image.new("RGB", (1060, 380), "#f5f6f2")
draw = ImageDraw.Draw(canvas)
font_path = Path("C:/Windows/Fonts/segoeuib.ttf")
font_regular_path = Path("C:/Windows/Fonts/segoeui.ttf")
heading = ImageFont.truetype(str(font_path), 26)
label = ImageFont.truetype(str(font_path), 19)
small = ImageFont.truetype(str(font_regular_path), 13)

draw.text((28, 18), "MYGYMTRACKER  /  4 DIRECTIONS DE LOGO", font=heading, fill="#202722")

for index, (letter, name, file_name) in enumerate(options):
    left = 28 + index * 256
    top = 72
    draw.rounded_rectangle((left, top, left + 236, 354), radius=18, fill="white", outline="#dfe4da", width=2)

    original = Image.open(root / file_name).convert("RGB")
    for size, x, y, radius in [(158, left + 39, top + 18, 35), (44, left + 34, top + 220, 10)]:
        icon = original.resize((size, size), Image.Resampling.LANCZOS)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
        canvas.paste(icon, (x, y), mask)

    draw.text((left + 34, top + 185), f"{letter} · {name}", font=label, fill="#202722")
    draw.text((left + 88, top + 233), "Aperçu sur téléphone", font=small, fill="#697168")

canvas.save(root / "logo-comparison.png", optimize=True)
