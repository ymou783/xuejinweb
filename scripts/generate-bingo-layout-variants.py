from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "assets" / "bingo2" / "layouts"

GRID = 23
MASK_SCALE = 36
CANVAS = 920
CELL = 30
GAP = 6
PITCH = CELL + GAP
GRID_WIDTH = GRID * PITCH - GAP
GRID_LEFT = (CANVAS - GRID_WIDTH) // 2
GRID_TOP = 92


def load_font(size, bold=False):
    candidates = [
        Path(r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def gradient(size, top_color, bottom_color):
    width, height = size
    image = Image.new("RGB", size, top_color)
    top = tuple(int(top_color[index:index + 2], 16) for index in (1, 3, 5))
    bottom = tuple(int(bottom_color[index:index + 2], 16) for index in (1, 3, 5))
    pixels = image.load()
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(round(top[channel] * (1 - ratio) + bottom[channel] * ratio) for channel in range(3))
        for x in range(width):
            pixels[x, y] = color
    return image


def point(column, row):
    return (round((column + 0.5) * MASK_SCALE), round((row + 0.5) * MASK_SCALE))


def dragon_mask():
    mask = Image.new("L", (GRID * MASK_SCALE, GRID * MASK_SCALE), 0)
    draw = ImageDraw.Draw(mask)
    body = [point(*item) for item in [(20, 4), (17, 2), (13, 3), (10, 6), (12, 9), (17, 10), (19, 13), (16, 17), (11, 18), (7, 16), (5, 12), (7, 9), (5, 6), (2, 7)]]
    draw.line(body, fill=255, width=MASK_SCALE * 2, joint="curve")
    draw.ellipse((18 * MASK_SCALE, 2 * MASK_SCALE, 22 * MASK_SCALE, 7 * MASK_SCALE), fill=255)
    draw.polygon([point(20, 2), point(21, 0), point(21, 4)], fill=255)
    draw.polygon([point(18, 2), point(17, 0), point(20, 3)], fill=255)
    draw.line([point(13, 4), point(10, 1), point(8, 2)], fill=255, width=MASK_SCALE)
    draw.line([point(15, 10), point(12, 13), point(10, 12)], fill=255, width=MASK_SCALE)
    draw.line([point(17, 11), point(20, 9), point(21, 10)], fill=255, width=MASK_SCALE)
    draw.line([point(8, 16), point(5, 20), point(3, 19)], fill=255, width=MASK_SCALE)
    draw.line([point(6, 13), point(2, 15), point(1, 13)], fill=255, width=MASK_SCALE)
    return mask


def phoenix_mask():
    mask = Image.new("L", (GRID * MASK_SCALE, GRID * MASK_SCALE), 0)
    draw = ImageDraw.Draw(mask)
    center = point(11, 10)
    draw.ellipse((9 * MASK_SCALE, 5 * MASK_SCALE, 14 * MASK_SCALE, 15 * MASK_SCALE), fill=255)
    draw.ellipse((10 * MASK_SCALE, 2 * MASK_SCALE, 13 * MASK_SCALE, 6 * MASK_SCALE), fill=255)
    left_wing = [center, point(8, 7), point(5, 3), point(0, 2), point(3, 7), point(0, 9), point(6, 10), point(2, 13), point(9, 12)]
    right_wing = [center, point(14, 7), point(18, 3), point(22, 2), point(20, 7), point(22, 9), point(16, 10), point(20, 13), point(13, 12)]
    draw.polygon(left_wing, fill=255)
    draw.polygon(right_wing, fill=255)
    draw.line([point(11, 13), point(9, 21)], fill=255, width=MASK_SCALE)
    draw.line([point(12, 13), point(12, 22)], fill=255, width=MASK_SCALE)
    draw.line([point(13, 13), point(16, 21)], fill=255, width=MASK_SCALE)
    draw.line([point(10, 14), point(6, 20)], fill=255, width=MASK_SCALE)
    draw.line([point(14, 14), point(19, 19)], fill=255, width=MASK_SCALE)
    draw.polygon([point(12, 2), point(15, 1), point(13, 4)], fill=255)
    return mask


def castle_mask():
    mask = Image.new("L", (GRID * MASK_SCALE, GRID * MASK_SCALE), 0)
    draw = ImageDraw.Draw(mask)
    width = MASK_SCALE
    outline = [
        point(1, 21), point(1, 5), point(3, 5), point(3, 2), point(5, 2),
        point(5, 5), point(8, 5), point(8, 3), point(10, 3), point(10, 0),
        point(13, 0), point(13, 3), point(15, 3), point(15, 5), point(18, 5),
        point(18, 2), point(20, 2), point(20, 5), point(22, 5), point(22, 21),
        point(1, 21),
    ]
    draw.line(outline, fill=255, width=width, joint="curve")
    draw.line([point(6, 21), point(6, 9), point(8, 9), point(8, 21)], fill=255, width=width)
    draw.line([point(15, 21), point(15, 9), point(17, 9), point(17, 21)], fill=255, width=width)
    draw.line([point(2, 9), point(21, 9)], fill=255, width=width)
    draw.line([point(3, 14), point(20, 14)], fill=255, width=width)
    draw.arc((8 * MASK_SCALE, 14 * MASK_SCALE, 15 * MASK_SCALE, 23 * MASK_SCALE), 180, 360, fill=255, width=width)
    draw.line([point(8, 18), point(8, 21)], fill=255, width=width)
    draw.line([point(15, 18), point(15, 21)], fill=255, width=width)
    return mask


def starship_mask():
    mask = Image.new("L", (GRID * MASK_SCALE, GRID * MASK_SCALE), 0)
    draw = ImageDraw.Draw(mask)
    width = MASK_SCALE
    hull = [point(11, 0), point(15, 5), point(16, 9), point(21, 13), point(17, 16), point(15, 15), point(14, 22), point(11, 19), point(8, 22), point(7, 15), point(5, 16), point(1, 13), point(6, 9), point(7, 5)]
    draw.line(hull + [hull[0]], fill=255, width=width, joint="curve")
    draw.line([point(11, 1), point(11, 19)], fill=255, width=width)
    draw.line([point(7, 6), point(11, 9), point(15, 6)], fill=255, width=width)
    draw.line([point(3, 13), point(11, 11), point(19, 13)], fill=255, width=width)
    draw.line([point(5, 16), point(11, 14), point(17, 16)], fill=255, width=width)
    draw.polygon([point(3, 12), point(0, 8), point(7, 11)], outline=255)
    draw.line([point(0, 8), point(3, 12), point(7, 11)], fill=255, width=width)
    draw.line([point(22, 8), point(19, 12), point(15, 11)], fill=255, width=width)
    draw.ellipse((7 * MASK_SCALE, 18 * MASK_SCALE, 10 * MASK_SCALE, 23 * MASK_SCALE), outline=255, width=width)
    draw.ellipse((13 * MASK_SCALE, 18 * MASK_SCALE, 16 * MASK_SCALE, 23 * MASK_SCALE), outline=255, width=width)
    return mask


def select_cells(mask, count=100):
    scored = []
    for row in range(GRID):
        for column in range(GRID):
            box = (
                column * MASK_SCALE,
                row * MASK_SCALE,
                (column + 1) * MASK_SCALE,
                (row + 1) * MASK_SCALE,
            )
            tile = mask.crop(box)
            score = sum(tile.getdata())
            scored.append((score, column, row))
    scored.sort(reverse=True)
    selected = [(column, row) for score, column, row in scored[:count]]
    if scored[count - 1][0] <= 0:
        raise ValueError("Shape mask does not contain enough cells")
    if len(selected) != count or len(set(selected)) != count:
        raise ValueError("Selected cells must contain exactly 100 unique positions")
    return selected


def render_variant(slug, title, mask, colors):
    cells = select_cells(mask)
    image = gradient((CANVAS, CANVAS), colors[0], colors[1])
    draw = ImageDraw.Draw(image, "RGBA")

    draw.rounded_rectangle((22, 20, 174, 70), radius=14, fill=(255, 255, 255, 215))
    draw.text((42, 31), title, font=load_font(27, bold=True), fill=colors[2])
    draw.rounded_rectangle((788, 20, 898, 70), radius=20, fill=(255, 253, 245, 238), outline=(210, 151, 163, 255), width=2)
    draw.text((807, 33), "100格", font=load_font(21, bold=True), fill="#685675")

    for column, row in cells:
        left = GRID_LEFT + column * PITCH
        top = GRID_TOP + row * PITCH
        box = (left, top, left + CELL, top + CELL)
        shadow = (left + 2, top + 3, left + CELL + 2, top + CELL + 3)
        draw.rounded_rectangle(shadow, radius=6, fill=(67, 42, 88, 44))
        draw.rounded_rectangle(box, radius=6, fill=(255, 253, 245, 255), outline=(219, 166, 177, 255), width=2)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / f"{slug}-100.png"
    image.save(target, "PNG", optimize=True)
    print(f"{title}: {len(cells)} cells -> {target}")
    return target


def main():
    variants = [
        ("dragon", "飞龙版", dragon_mask(), ("#bcefe0", "#b8c8f4", "#396d69")),
        ("phoenix", "凤凰版", phoenix_mask(), ("#ffd6c7", "#efb9dc", "#924d68")),
        ("castle", "城堡版", castle_mask(), ("#c4dcff", "#d7c3f2", "#52658e")),
        ("starship", "战舰版", starship_mask(), ("#bde7f0", "#c4b9ee", "#405e83")),
    ]
    for slug, title, mask, colors in variants:
        render_variant(slug, title, mask, colors)


if __name__ == "__main__":
    main()
