#!/usr/bin/env python3
"""
Generate pixel-art villager joy bubbles (24x24 and @2x 48x48 RGBA) plus
floating heart particle (9x8 and @2x 18x16 RGBA) for RonTown.

Palette: Split Court cream speech bubble (#FFF7EC) with 1px ink outline (#0E0D15),
soft warm inner bottom bevel (#EADAC6), bottom-center pointer tail, and crisp
pixel glyphs inside.
"""

from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parents[2] / "apps/web/public/rontown/ui"
OUT_DIR.mkdir(parents=True, exist_ok=True)

INK = (14, 13, 21, 255)        # #0E0D15
CREAM = (255, 247, 236, 255)   # #FFF7EC
SHADE = (234, 218, 198, 255)   # #EADAC6 subtle bottom bevel
WHITE = (255, 255, 255, 255)
RED = (255, 90, 78, 255)       # #FF5A4E Ron Red
RED_DARK = (196, 36, 32, 255)
GOLD = (250, 204, 21, 255)     # #FACC15 Gold
GOLD_DARK = (196, 134, 16, 255)
VOLT = (198, 255, 61, 255)     # #C6FF3D Volt
BLUE = (61, 123, 255, 255)     # #3D7BFF Duel Blue
BLUE_DARK = (32, 74, 190, 255)
GREEN = (61, 220, 151, 255)    # #3DDC97
CLEAR = (0, 0, 0, 0)


def make_bubble_base() -> Image.Image:
    """24x24 rounded pixel speech bubble with bottom-center pointer tail."""
    img = Image.new("RGBA", (24, 24), CLEAR)
    px = img.load()

    # Body occupies x in [2..21], y in [1..18] with 2px chamfered corners
    for y in range(1, 19):
        for x in range(2, 22):
            # Rounded corners (cut 4 corner pixels)
            if (x in (2, 21) and y in (1, 18)):
                continue
            if (x in (2, 3, 20, 21) and y == 1) or (x in (2, 3, 20, 21) and y == 18):
                # Corner border pixels
                if (x in (3, 20) and y in (1, 18)):
                    px[x, y] = INK
                continue
            # Perimeter outline
            if y in (1, 18) or x in (2, 21):
                px[x, y] = INK
            elif (x == 3 and y in (2, 17)) or (x == 20 and y in (2, 17)):
                px[x, y] = INK
            elif y == 17:
                px[x, y] = SHADE
            else:
                px[x, y] = CREAM

    # Fix clean rounded corner fills
    for (x, y) in [(3, 2), (20, 2), (3, 17), (20, 17)]:
        px[x, y] = INK
    for (x, y) in [(4, 2), (19, 2)]:
        px[x, y] = CREAM
    for (x, y) in [(4, 17), (19, 17)]:
        px[x, y] = SHADE

    # Open bottom border for speech tail at x=10..13
    for x in range(10, 14):
        px[x, 18] = SHADE

    # Speech tail pointing down-center (y=19..22)
    px[9, 19] = INK
    px[10, 19] = CREAM
    px[11, 19] = CREAM
    px[12, 19] = SHADE
    px[13, 19] = INK

    px[10, 20] = INK
    px[11, 20] = CREAM
    px[12, 20] = INK

    px[11, 21] = INK
    return img


def draw_pattern(img: Image.Image, pattern: list[str], palette: dict[str, tuple[int, int, int, int]], ox: int, oy: int) -> None:
    px = img.load()
    for dy, row in enumerate(pattern):
        for dx, ch in enumerate(row):
            if ch in palette:
                px[ox + dx, oy + dy] = palette[ch]


GLYPHS: dict[str, tuple[list[str], dict[str, tuple[int, int, int, int]], int, int]] = {
    "heart": (
        [
            ".OO.OO.",
            "ORROrRO",
            "ORWRRRO",
            "ORRRRRO",
            ".ORrRO.",
            "..ORO..",
            "...O...",
        ],
        {"O": INK, "R": RED, "r": RED_DARK, "W": WHITE},
        8,
        6,
    ),
    "smile": (
        [
            "..OOOOO..",
            ".OGGGGGO.",
            "OGOGGGOGO",
            "OGGGGGGG0".replace("0", "O"),
            "OGOGGGOGO",
            "OGGOOOGGO",
            ".OGGGGGO.",
            "..OOOOO..",
        ],
        {"O": INK, "G": GOLD},
        7,
        5,
    ),
    "star": (
        [
            "....O....",
            "...OYO...",
            "OOOYWYOOO",
            ".OYYYYYO.",
            "..OYdYO..",
            ".OYYOYYO.",
            ".OO...OO.",
        ],
        {"O": INK, "Y": GOLD, "d": GOLD_DARK, "W": WHITE},
        7,
        6,
    ),
    "wheat": (
        [
            ".....OO..",
            "....OYWO.",
            "...OYOYO.",
            "..OYdOYO.",
            "..OOYdO..",
            ".OgdOO...",
            "..OO.....",
            ".Od......",
        ],
        {"O": INK, "Y": GOLD, "d": GOLD_DARK, "W": WHITE, "g": GREEN},
        7,
        5,
    ),
    "exclaim": (
        [
            ".OOO.",
            "OVWVO",
            "OVVVO",
            "OVVVO",
            ".OVO.",
            ".....",
            ".OOO.",
            ".OVO.",
            ".OOO.",
        ],
        {"O": INK, "V": VOLT, "W": WHITE},
        9,
        5,
    ),
    "note": (
        [
            "...OOOOO.",
            "..OBBBBBO",
            "..OBOOOBO",
            "..OB...BO",
            ".OOB..OBO",
            "OBBO.OBBO",
            ".OO...OO.",
        ],
        {"O": INK, "B": BLUE},
        7,
        6,
    ),
}


def make_heart_float() -> Image.Image:
    """9x8 pixel-art floating heart particle for the family event."""
    img = Image.new("RGBA", (9, 8), CLEAR)
    pattern = [
        ".OO...OO.",
        "ORRO.ORRO",
        "ORWROORRO",
        "ORRRRRRRO",
        ".ORRRRRO.",
        "..ORrRO..",
        "...ORO...",
        "....O....",
    ]
    draw_pattern(img, pattern, {"O": INK, "R": RED, "r": RED_DARK, "W": WHITE}, 0, 0)
    return img


def main() -> None:
    for name, (pattern, palette, ox, oy) in GLYPHS.items():
        img = make_bubble_base()
        draw_pattern(img, pattern, palette, ox, oy)
        out_1x = OUT_DIR / f"bubble-{name}.png"
        out_2x = OUT_DIR / f"bubble-{name}@2x.png"
        img.save(out_1x, format="PNG")
        img.resize((48, 48), Image.NEAREST).save(out_2x, format="PNG")
        print(f"Wrote {out_1x.name} (24x24) and {out_2x.name} (48x48)")

    heart = make_heart_float()
    h1 = OUT_DIR / "heart-float.png"
    h2 = OUT_DIR / "heart-float@2x.png"
    heart.save(h1, format="PNG")
    heart.resize((18, 16), Image.NEAREST).save(h2, format="PNG")
    print(f"Wrote {h1.name} (9x8) and {h2.name} (18x16)")


if __name__ == "__main__":
    main()
