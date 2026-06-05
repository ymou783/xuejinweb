import sys
from pathlib import Path

from PIL import Image, ImageOps


SOURCE_DIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "assets" / "bingo2"


SHEETS = [
    ("243d5ed8-bd3a-44cf-b2be-ec02ae8ebdbc.png", 1, 1, ["ultrasonic-cutter"]),
    ("0d746fac-301e-4c16-96f5-685df43f038d.png", 1, 1, ["diamond-caviar"]),
    (
        "72ed296e-51c2-4139-bd7b-dd415c29c2b4.png",
        1,
        1,
        ["alpha-brain-computer-experiment-data-raven"],
    ),
    ("9422fa09-f086-4229-b09e-7db39fde1e0e.png", 1, 2, ["medical-robot", "ventilator"]),
    (
        "680c362b-c880-404c-9730-ad7891eb9fb3.png",
        1,
        3,
        ["reinforced-carbon-fiber-board", "military-shell", "femtosecond-laser"],
    ),
    (
        "7d6be81b-12d3-4ce7-bc98-24fb76b69177.png",
        1,
        2,
        ["luxury-mechanical-watch", "gilded-card"],
    ),
    (
        "c9d0108f-dc94-4fbc-8945-c46a1d281748.png",
        1,
        3,
        ["robot-vacuum-mop", "powerful-vacuum-cleaner", "olivia-champagne"],
    ),
    (
        "1c3cfc02-a478-430a-8edc-58e382e7b045.png",
        1,
        3,
        ["resuscitation-ventilator", "ecmo", "aed"],
    ),
    (
        "706def6f-89cb-496c-ab95-b762c47479b3.png",
        1,
        2,
        ["armored-vehicle-battery", "high-energy-gas-canister"],
    ),
    (
        "4244ace9-1386-4138-8a1d-bef8350b2bcb.png",
        1,
        3,
        ["micro-reactor", "prototype-fusion-power-unit", "power-battery-pack"],
    ),
    (
        "eb11ef20-79a6-4e53-83c9-c8cd302ff2c0.png",
        1,
        3,
        ["spinosaurus-claw-fossil", "ten-thousand-pure-gold-bar", "saeeds-pocket-watch"],
    ),
    (
        "de400481-de25-4e87-91f4-1f8523a00e83.png",
        2,
        3,
        [
            "top-secret-server",
            "cloud-storage-array",
            "sealed-audio-source",
            "tidal-prison-map-4",
            "quantum-storage",
            "experimental-data",
        ],
    ),
    (
        "1d9cdcf2-ff85-4fd2-9d8c-5f0a3d50ec0a.png",
        5,
        3,
        [
            "portable-military-radar",
            "mandel-supercomputer-unit",
            "high-speed-disk-array",
            "blade-server",
            "flight-recorder",
            "laptop-computer",
            "military-information-terminal",
            "military-radio",
            "camera",
            "military-drone",
            "military-control-terminal",
            "graphics-card",
            "electronic-shackles",
            "positioning-receiver",
            "stellar-sensor",
        ],
    ),
    (
        "39b70fba-5ddc-4543-97c5-4b5c288b8aa7.png",
        5,
        3,
        [
            "heart-of-africa",
            "tear-of-the-ocean",
            "main-battle-tank-model",
            "zongheng",
            "impressionist-painting",
            "crown-of-tears",
            "famous-kiln-porcelain",
            "infantry-fighting-vehicle-model",
            "reyes-gramophone",
            "claudius-bust",
            "portable-life-support-system",
            "smoothbore-gun-exhibit",
            "golden-crocodile-head-statue",
            "heaven-and-earth",
            "golden-gazelle",
        ],
    ),
]


def build_assets():
    if SOURCE_DIR is None or not SOURCE_DIR.is_dir():
        raise SystemExit("Usage: python scripts/build-bingo2-assets.py <screenshot-folder>")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = 0

    for filename, rows, cols, item_ids in SHEETS:
        source = Image.open(SOURCE_DIR / filename).convert("RGB")
        if len(item_ids) != rows * cols:
            raise ValueError(f"{filename}: item count does not match grid")

        for index, item_id in enumerate(item_ids):
            row, col = divmod(index, cols)
            left = round(source.width * col / cols)
            right = round(source.width * (col + 1) / cols)
            top = round(source.height * row / rows)
            bottom = round(source.height * (row + 1) / rows)
            tile = source.crop((left, top, right, bottom))

            inset_x = max(4, round(tile.width * 0.025))
            inset_top = max(8, round(tile.height * 0.10))
            inset_bottom = max(5, round(tile.height * 0.04))
            tile = tile.crop(
                (inset_x, inset_top, tile.width - inset_x, tile.height - inset_bottom)
            )
            tile.thumbnail((420, 180), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (420, 180), "#19242b")
            canvas.paste(
                tile,
                ((canvas.width - tile.width) // 2, (canvas.height - tile.height) // 2),
            )
            canvas = ImageOps.autocontrast(canvas, cutoff=0.5)
            canvas.save(OUTPUT_DIR / f"{item_id}.webp", "WEBP", quality=88, method=6)
            generated += 1

    print(f"Generated {generated} Bingo 2.0 item images in {OUTPUT_DIR}")


if __name__ == "__main__":
    build_assets()
