from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "bingo2" / "layout-rocket-100.png"

WIDTH = 720
HEIGHT = 850
CELL = 34
GAP = 7
PITCH = CELL + GAP
CENTER_COLUMN = 9
TOP = 105


def row_cells(row, start, end):
    return [(column, row) for column in range(start, end + 1)]


cells = []
cells += row_cells(0, 9, 9)
cells += row_cells(1, 8, 10)
cells += row_cells(2, 7, 11)
cells += row_cells(3, 7, 11)
for row in range(4, 12):
    cells += row_cells(row, 6, 12)
cells += row_cells(12, 5, 13)
cells += row_cells(13, 4, 14)
cells += row_cells(14, 7, 11)
cells += row_cells(15, 8, 10)
cells += row_cells(16, 9, 9)
cells.append((16, 4))

if len(cells) != 100:
    raise ValueError(f"Expected 100 cells, got {len(cells)}")
if len(set(cells)) != 100:
    raise ValueError("Cell positions must be unique")


def load_font(size, bold=False):
    candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def vertical_gradient(top_color, bottom_color):
    image = Image.new("RGB", (WIDTH, HEIGHT), top_color)
    top = tuple(int(top_color[index:index + 2], 16) for index in (1, 3, 5))
    bottom = tuple(int(bottom_color[index:index + 2], 16) for index in (1, 3, 5))
    pixels = image.load()
    for y in range(HEIGHT):
        ratio = y / max(1, HEIGHT - 1)
        color = tuple(round(top[channel] * (1 - ratio) + bottom[channel] * ratio) for channel in range(3))
        for x in range(WIDTH):
            pixels[x, y] = color
    return image


image = vertical_gradient("#b7dcff", "#d8c2f2")
draw = ImageDraw.Draw(image, "RGBA")

draw.rounded_rectangle((18, 18, 138, 63), radius=12, fill=(255, 255, 255, 205))
draw.text((34, 27), "火箭版", font=load_font(25, bold=True), fill="#604c85")

draw.rounded_rectangle((604, 18, 702, 63), radius=18, fill=(255, 253, 245, 235), outline=(211, 154, 162, 255), width=2)
draw.text((622, 30), "100格", font=load_font(20, bold=True), fill="#685675")

for column, row in cells:
    center_x = WIDTH // 2 + (column - CENTER_COLUMN) * PITCH
    left = center_x - CELL // 2
    top = TOP + row * PITCH
    box = (left, top, left + CELL, top + CELL)
    shadow = (left + 2, top + 3, left + CELL + 2, top + CELL + 3)
    draw.rounded_rectangle(shadow, radius=6, fill=(104, 75, 126, 42))
    draw.rounded_rectangle(box, radius=6, fill=(255, 253, 245, 255), outline=(222, 177, 180, 255), width=2)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, "PNG", optimize=True)
print(f"Saved {len(cells)} cells to {OUTPUT}")
