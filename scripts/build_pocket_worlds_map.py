"""
HØME TØWN — Backdrop Painter
Derives all geometry from pocketWorldsTownLayout.json so the art
and the collision map stay in sync. No magic pixel coordinates.

Tile → pixel: px = tile * TILE
Building art is anchored to the tile footprint origin, centred
horizontally and bottom-aligned so the base matches the collision base.
"""
from __future__ import annotations

import json
from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
LAYOUT_PATH = ROOT / "data" / "pocketWorldsTownLayout.json"
SUNNYSIDE_PACK = Path.home() / "Downloads" / "Sunnyside_World_ASSET_PACK_V2.1" / "Sunnyside_World_Assets"
VENDOR = ROOT.parent / "vendor" / "sunnyside_extract"
OUTPUT_DIR = ROOT / "public" / "assets" / "pocket-worlds"

# ── Load layout ────────────────────────────────────────────────────────────────
with open(LAYOUT_PATH) as f:
    LAYOUT = json.load(f)

TILE = LAYOUT["tileSize"]          # 32
MAP_W = LAYOUT["runtimeWidth"]     # 96  tiles
MAP_H = LAYOUT["runtimeHeight"]    # 64  tiles
PX_W = MAP_W * TILE                # 3072 px
PX_H = MAP_H * TILE                # 2048 px

OUTPUTS = {
    "verdant":      OUTPUT_DIR / "pocket-worlds-town-verdant.png",
    "autumn":       OUTPUT_DIR / "pocket-worlds-town-autumn.png",
    "winter":       OUTPUT_DIR / "pocket-worlds-town-winter.png",
    "night":        OUTPUT_DIR / "pocket-worlds-town-night.png",
    "winter-night": OUTPUT_DIR / "pocket-worlds-town-winter-night.png",
}

# Sunnyside asset paths
TILESET_PATH    = SUNNYSIDE_PACK / "Tileset" / "spr_tileset_sunnysideworld_16px.png"
TREE_1_PATH     = SUNNYSIDE_PACK / "Elements" / "Plants"  / "spr_deco_tree_01_strip4.png"
TREE_2_PATH     = SUNNYSIDE_PACK / "Elements" / "Plants"  / "spr_deco_tree_02_strip4.png"
BUILDINGS_PATH  = VENDOR / "buildings" / "SUNNYSIDE_WORLD_BUILDINGS_V0.01.png"
CORACLE_PATH    = SUNNYSIDE_PACK / "Elements" / "Other"   / "spr_deco_coracle_land.png"
CORACLE_WATER   = SUNNYSIDE_PACK / "Elements" / "Other"   / "spr_deco_coracle_strip4.png"
CRATE_PATH      = SUNNYSIDE_PACK / "Elements" / "Crops"   / "crate_top.png"
WOOD_PATH       = SUNNYSIDE_PACK / "Elements" / "Crops"   / "wood.png"
ROCK_PATH       = SUNNYSIDE_PACK / "Elements" / "Crops"   / "rock.png"
DUCK_PATH       = SUNNYSIDE_PACK / "Elements" / "Animals" / "spr_deco_duck_01_strip4.png"

RNG = random.Random(17)


# ── Utility ────────────────────────────────────────────────────────────────────

def tx(tiles: float) -> int:
    """Tile x/y position → pixel."""
    return round(tiles * TILE)

def trect(x: float, y: float, w: float, h: float) -> tuple[int, int, int, int]:
    return (tx(x), tx(y), tx(x + w), tx(y + h))

def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")

def crop(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    return sheet.crop(box).copy()

def crop_trimmed(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    sprite = crop(sheet, box)
    bbox = sprite.getbbox()
    return sprite.crop(bbox) if bbox else sprite

def first_frame(path: Path, frames: int) -> Image.Image:
    strip = load_image(path)
    return crop(strip, (0, 0, strip.width // frames, strip.height))

def resize(sprite: Image.Image, *, scale: float | None = None, width: int | None = None) -> Image.Image:
    if width is not None:
        scale = width / sprite.width
    assert scale is not None
    return sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.NEAREST,
    )

def shadow(sprite: Image.Image, opacity: int = 100) -> Image.Image:
    result = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    alpha = sprite.getchannel("A").point(lambda v: min(255, round(v * opacity / 255)))
    result.putalpha(alpha)
    return result

def paste(
    canvas: Image.Image,
    sprite: Image.Image,
    x: int,
    y: int,
    *,
    scale: float | None = None,
    width: int | None = None,
    flip: bool = False,
    with_shadow: bool = False,
) -> tuple[int, int, int, int]:
    art = sprite
    if scale is not None or width is not None:
        art = resize(art, scale=scale, width=width)
    if flip:
        art = ImageOps.mirror(art)
    if with_shadow:
        sh = shadow(art)
        canvas.alpha_composite(sh, (round(x + 5), round(y + 8)))
    canvas.alpha_composite(art, (round(x), round(y)))
    return (round(x), round(y), round(x + art.width), round(y + art.height))

def tiled_fill(tile: Image.Image, width: int, height: int) -> Image.Image:
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for ox in range(0, width, tile.width):
        for oy in range(0, height, tile.height):
            result.alpha_composite(tile, (ox, oy))
    return result


# ── Ground ─────────────────────────────────────────────────────────────────────

def draw_ground(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    # Base green
    draw.rectangle((0, 0, PX_W, PX_H), fill=(124, 183, 93, 255))
    # Mottled patches for natural variation
    colors = [(136, 194, 101, 255), (114, 174, 86, 255), (148, 201, 108, 255), (100, 157, 76, 255)]
    for _ in range(2400):
        rx = RNG.randint(16, 56)
        ry = RNG.randint(12, 40)
        x  = RNG.randint(-32, PX_W + 32)
        y  = RNG.randint(-32, PX_H + 32)
        col = list(RNG.choice(colors))
        col[-1] = RNG.randint(24, 60)
        draw.ellipse((x, y, x + rx, y + ry), fill=tuple(col))


# ── Water — derived from layout ────────────────────────────────────────────────

def add_water(canvas: Image.Image, water_tile: Image.Image) -> None:
    water = tiled_fill(water_tile, PX_W, PX_H)
    mask  = Image.new("L", (PX_W, PX_H), 0)
    draw  = ImageDraw.Draw(mask)

    water_col  = (84, 163, 210, 255)
    shore_col  = (160, 146, 110, 255)
    bridge_col = (116, 113, 126, 255)

    # Paint each water shape from the layout
    for e in LAYOUT["waterEllipses"]:
        cx, cy, rx, ry = e["cx"], e["cy"], e["rx"], e["ry"]
        draw.ellipse(
            (tx(cx - rx), tx(cy - ry), tx(cx + rx), tx(cy + ry)),
            fill=255,
        )

    for r in LAYOUT["waterRects"]:
        draw.rectangle(trect(r["x"], r["y"], r["width"], r["height"]), fill=255)

    # Punch out walkway bridges so they stay walkable
    for w in LAYOUT["walkwayRects"]:
        draw.rectangle(trect(w["x"], w["y"], w["width"], w["height"]), fill=0)

    canvas.paste(water, (0, 0), mask)

    # Shore and bridge parapets
    cdraw = ImageDraw.Draw(canvas)
    for w in LAYOUT["walkwayRects"]:
        # Only draw parapets for crossings that bisect water
        name = w.get("name", "")
        if "Bridge" in name or "Crossing" in name:
            box = trect(w["x"], w["y"], w["width"], w["height"])
            cdraw.rounded_rectangle(box, radius=14, fill=shore_col)
            # Parapet rail on top
            cdraw.rounded_rectangle(
                (box[0], box[1], box[2], box[1] + 10),
                radius=5,
                fill=bridge_col,
            )

    # Waterfall streaks on the spillway
    spillway = next((r for r in LAYOUT["waterRects"] if r["name"] == "Spillway"), None)
    if spillway:
        sx = tx(spillway["x"])
        sy = tx(spillway["y"])
        sw = tx(spillway["width"])
        for i in range(3):
            ex = sx + 6 + i * (sw // 3)
            cdraw.rectangle((ex, sy, ex + 10, sy + tx(spillway["height"])), fill=(210, 244, 255, 130))


# ── Roads — derived from walkwayRects ─────────────────────────────────────────

def add_roads(canvas: Image.Image) -> None:
    draw  = ImageDraw.Draw(canvas)
    dirt  = (218, 200, 152, 255)
    edge  = (172, 150, 104, 255)
    stone = (192, 190, 181, 255)
    stone_edge = (148, 145, 138, 255)

    # Use walkwayRects as the road network — paint each one
    for w in LAYOUT["walkwayRects"]:
        name = w.get("name", "")
        box  = trect(w["x"], w["y"], w["width"], w["height"])

        # Waterfront quay gets stone paving; everything else is dirt
        fill, outline = (stone, stone_edge) if "Waterfront" in name else (dirt, edge)
        draw.rounded_rectangle(box, radius=16, fill=fill, outline=outline, width=6)

    # Civic plaza gets a cobblestone grid overlay
    plaza = next((w for w in LAYOUT["walkwayRects"] if w.get("name") == "Civic Plaza"), None)
    if plaza:
        px0, py0, px1, py1 = trect(plaza["x"], plaza["y"], plaza["width"], plaza["height"])
        for gx in range(px0, px1, 38):
            draw.line((gx, py0, gx, py1), fill=(176, 164, 128, 80), width=2)
        for gy in range(py0, py1, 36):
            draw.line((px0, gy, px1, gy), fill=(176, 164, 128, 80), width=2)

        # Small fountain / garden feature in the plaza
        mid_x = (px0 + px1) // 2
        mid_y = (py0 + py1) // 2
        draw.ellipse(
            (mid_x - 28, mid_y - 28, mid_x + 28, mid_y + 28),
            fill=(93, 149, 90, 255),
            outline=(58, 91, 54, 255),
            width=4,
        )
        draw.ellipse(
            (mid_x - 14, mid_y - 14, mid_x + 14, mid_y + 14),
            fill=(104, 178, 221, 255),
        )


# ── Waterfront dock structure ──────────────────────────────────────────────────

def add_harbor(canvas: Image.Image) -> None:
    """Draw a modern quayside: concrete apron, dock fingers, bollards."""
    draw  = ImageDraw.Draw(canvas)
    stone = (196, 193, 185, 255)
    stone_dark = (158, 155, 148, 255)
    wood  = (122, 88, 58, 255)

    # Quay apron — spans the Waterfront Quay Road and extends south to water edge
    quay = next((w for w in LAYOUT["walkwayRects"] if "Waterfront" in w.get("name", "")), None)
    if quay:
        qx0 = tx(quay["x"])
        qy0 = tx(quay["y"])
        qx1 = tx(quay["x"] + quay["width"])
        qy1 = PX_H  # extend to bottom edge

        draw.rounded_rectangle((qx0, qy0, qx1, qy1), radius=48, fill=stone, outline=stone_dark, width=6)

        # Dock fingers (3 evenly spaced piers extending south from quay)
        finger_w = tx(2)
        finger_h = tx(5)
        spacing  = (qx1 - qx0) // 4
        for i in range(1, 4):
            fx = qx0 + spacing * i - finger_w // 2
            fy = qy0 + tx(4)
            draw.rectangle((fx, fy, fx + finger_w, fy + finger_h), fill=stone_dark)

            # Bollards at pier end
            bx = fx + finger_w // 2
            by = fy + finger_h
            draw.ellipse((bx - 6, by - 6, bx + 6, by + 6), fill=wood)

        # Cross-beam line
        draw.rectangle((qx0 + 8, qy0 + tx(5), qx1 - 8, qy0 + tx(5) + 14), fill=stone_dark)


# ── Trees ──────────────────────────────────────────────────────────────────────

def scatter_trees(canvas: Image.Image, trees: list[Image.Image]) -> None:
    placements: list[tuple[int, int, Image.Image, int]] = []

    # Border fringe
    for x in range(-60, PX_W + 40, 108):
        placements.append((x + RNG.randint(-16, 16), -22 + RNG.randint(-10, 10), RNG.choice(trees), RNG.randint(52, 68)))
        placements.append((x + RNG.randint(-24, 16), PX_H - 90 + RNG.randint(-10, 20), RNG.choice(trees), RNG.randint(54, 70)))
    for y in range(40, PX_H - 80, 88):
        placements.append((-22 + RNG.randint(-8, 8), y + RNG.randint(-16, 16), RNG.choice(trees), RNG.randint(52, 70)))
        placements.append((PX_W - 70 + RNG.randint(-10, 10), y + RNG.randint(-16, 16), RNG.choice(trees), RNG.randint(52, 70)))

    # Interior clusters — away from roads and buildings
    clusters = [
        (tx(5),  tx(4),   14),   # Far north-west corner
        (tx(13), tx(4),   10),   # North of Northside
        (tx(44), tx(2),   18),   # North Marsh fringe
        (tx(72), tx(4),   12),   # North of Canal Row
        (tx(4),  tx(34),  10),   # West mid-strip
        (tx(38), tx(36),  8),    # Central between districts
        (tx(28), tx(58),  12),   # South-west
        (tx(50), tx(56),  10),   # South of spillway
    ]
    for cx, cy, count in clusters:
        for _ in range(count):
            placements.append((
                cx + RNG.randint(-160, 160),
                cy + RNG.randint(-100, 100),
                RNG.choice(trees),
                RNG.randint(54, 72),
            ))

    for x, y, sprite, w in placements:
        paste(canvas, sprite, x, y, width=w, flip=RNG.random() > 0.5, with_shadow=True)


# ── Buildings — anchored to layout footprints ──────────────────────────────────

def add_buildings(
    canvas: Image.Image,
    *,
    cottages: list[Image.Image],
    civic_body: Image.Image,
    shop_body: Image.Image,
    warehouse_body: Image.Image,
) -> list[tuple[int, int, int]]:
    """
    For each buildingRect in the layout, centre the art sprite horizontally
    inside the tile footprint and bottom-align it. This keeps the building
    base on the correct ground tiles regardless of art height.
    """
    lights: list[tuple[int, int, int]] = []

    style_map = {
        "residence":        cottages,
        "residential-multi": [civic_body],
        "civic":            [civic_body],
        "commercial":       [shop_body],
        "industrial":       [warehouse_body],
    }
    width_map = {
        "residence":        100,
        "residential-multi": 148,
        "civic":            168,
        "commercial":       128,
        "industrial":       160,
    }

    for idx, b in enumerate(LAYOUT["buildingRects"]):
        btype  = b.get("type", "residence")
        sprites = style_map.get(btype, cottages)
        sprite  = sprites[idx % len(sprites)]
        target_w = width_map.get(btype, 110)

        # Tile footprint in pixels
        fx0, fy0, fx1, fy1 = trect(b["x"], b["y"], b["width"], b["height"])

        art = resize(sprite, width=target_w)
        # Centre horizontally over tile footprint; bottom-align with 6px nudge up
        left = fx0 + (fx1 - fx0 - art.width) // 2
        top  = fy1 - art.height + 6

        box = paste(canvas, art, left, top, with_shadow=True)
        cx  = box[0] + art.width  // 2
        cy  = box[1] + art.height // 2 + 8
        lights.append((cx, cy, max(44, target_w // 2)))

    return lights


# ── Dock props ─────────────────────────────────────────────────────────────────

def add_dock_props(
    canvas: Image.Image,
    *,
    crate: Image.Image,
    wood: Image.Image,
    coracle_land: Image.Image,
    coracle_water: Image.Image,
    rock: Image.Image,
    duck: Image.Image,
) -> list[tuple[int, int, int]]:
    lights: list[tuple[int, int, int]] = []
    quay = next((w for w in LAYOUT["walkwayRects"] if "Waterfront" in w.get("name", "")), None)
    if quay:
        qx0 = tx(quay["x"])
        qy0 = tx(quay["y"])

        paste(canvas, crate, qx0 + 28,  qy0 + tx(3), width=30)
        paste(canvas, crate, qx0 + 68,  qy0 + tx(3), width=30)
        paste(canvas, wood,  qx0 + 110, qy0 + tx(4), width=28)
        paste(canvas, wood,  qx0 + 148, qy0 + tx(4), width=28)
        paste(canvas, coracle_land,  qx0 + 200, qy0 + tx(2), width=50, with_shadow=True)
        paste(canvas, coracle_water, qx0 + tx(28), qy0 + tx(5), width=46)
        paste(canvas, rock,  qx0 + 8,   qy0 + tx(2), width=38)
        paste(canvas, duck,  tx(quay["x"] + 4), tx(quay["y"] + 7), width=24)

        lights.extend([
            (qx0 + 40,  qy0 + tx(5) - 10, 60),
            (qx0 + 100, qy0 + tx(5) - 10, 60),
        ])
    return lights


# ── Scene assembly ─────────────────────────────────────────────────────────────

def build_base_scene() -> tuple[Image.Image, list[tuple[int, int, int]]]:
    tileset    = load_image(TILESET_PATH)
    buildings  = load_image(BUILDINGS_PATH)

    water_tile = crop(tileset, (176, 288, 240, 352))

    # House sprites (different roof colours)
    house_blue   = crop_trimmed(tileset, (520, 168, 552, 224))
    house_green  = crop_trimmed(tileset, (520, 296, 552, 352))
    house_orange = crop_trimmed(tileset, (520, 424, 552, 480))
    house_red    = crop_trimmed(tileset, (520, 552, 552, 608))
    house_purple = crop_trimmed(tileset, (520, 680, 552, 736))

    # Re-use the "church body" sprite as a civic/apartment block (it reads as a
    # larger flat-roofed building once we drop the tower and resize it down).
    civic_body     = crop(buildings, (93, 121, 179, 176))
    # Shop/warehouse — use the church body mirrored and tinted; or any other
    # building sprite in the sheet. These are fallbacks when the Sunnyside pack
    # does not include dedicated modern sprites.
    shop_body      = ImageOps.mirror(civic_body)
    warehouse_body = civic_body

    tree_1 = first_frame(TREE_1_PATH, 4)
    tree_2 = first_frame(TREE_2_PATH, 4)

    coracle_land  = load_image(CORACLE_PATH)
    coracle_water = first_frame(CORACLE_WATER, 4)
    crate  = load_image(CRATE_PATH)
    wood   = load_image(WOOD_PATH)
    rock   = load_image(ROCK_PATH)
    duck   = first_frame(DUCK_PATH, 4)

    canvas = Image.new("RGBA", (PX_W, PX_H), (0, 0, 0, 0))

    draw_ground(canvas)
    add_water(canvas, water_tile)
    add_roads(canvas)
    add_harbor(canvas)
    scatter_trees(canvas, [tree_1, tree_2])

    building_lights = add_buildings(
        canvas,
        cottages=[house_blue, house_green, house_orange, house_red, house_purple],
        civic_body=civic_body,
        shop_body=shop_body,
        warehouse_body=warehouse_body,
    )
    dock_lights = add_dock_props(
        canvas,
        crate=crate,
        wood=wood,
        coracle_land=coracle_land,
        coracle_water=coracle_water,
        rock=rock,
        duck=duck,
    )
    return canvas, building_lights + dock_lights


# ── Colour variants ────────────────────────────────────────────────────────────

def transform_pixels(image: Image.Image, fn) -> Image.Image:
    src  = image.convert("RGBA")
    data = [fn(*p) for p in src.getdata()]
    result = Image.new("RGBA", src.size)
    result.putdata(data)
    return result

def to_autumn(image: Image.Image) -> Image.Image:
    def fn(r, g, b, a):
        if a == 0:
            return (r, g, b, a)
        if g > r + 18 and g > b + 16:
            warmth = g - max(r, b)
            return (min(255, round(r + warmth * 0.92 + 18)), min(255, round(g * 0.86 + warmth * 0.15 + 8)), min(255, round(b * 0.75)), a)
        return (min(255, round(r * 1.06 + 6)), min(255, round(g * 0.96)), min(255, round(b * 0.92)), a)
    result = transform_pixels(image, fn)
    overlay = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(260):
        rad = RNG.randint(16, 52)
        x   = RNG.randint(0, PX_W)
        y   = RNG.randint(0, PX_H)
        col = RNG.choice([(244, 156, 68, 26), (231, 119, 66, 24), (211, 164, 61, 22)])
        draw.ellipse((x, y, x + rad, y + rad), fill=col)
    return Image.alpha_composite(result, overlay)

def to_winter(image: Image.Image) -> Image.Image:
    def fn(r, g, b, a):
        if a == 0:
            return (r, g, b, a)
        if g > r + 12 and g > b + 8:
            white = min(255, round((r + g + b) / 3 + 78))
            return (max(0, white - 10), min(255, white - 2), min(255, white + 16), a)
        avg  = round((r + g + b) / 3)
        cold = min(255, avg + 18)
        return (max(0, cold - 10), cold, min(255, cold + 18), a)
    result = transform_pixels(image, fn)
    snow   = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw   = ImageDraw.Draw(snow)
    for _ in range(14000):
        x = RNG.randint(0, PX_W)
        y = RNG.randint(0, PX_H)
        draw.rectangle((x, y, x + 1, y + 1), fill=(255, 255, 255, RNG.randint(24, 70)))
    return Image.alpha_composite(result, snow)

def add_night_glow(image: Image.Image, lights: list[tuple[int, int, int]]) -> Image.Image:
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for x, y, radius in lights:
        for scale, alpha in ((1.6, 20), (1.05, 44), (0.6, 110)):
            r = round(radius * scale)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=(246, 195, 105, alpha))
    blur = glow.filter(ImageFilter.GaussianBlur(radius=22))
    return Image.alpha_composite(image, blur)

def to_night(image: Image.Image, lights: list[tuple[int, int, int]]) -> Image.Image:
    def fn(r, g, b, a):
        if a == 0:
            return (r, g, b, a)
        return (max(0, round(r * 0.28)), max(0, round(g * 0.34)), min(255, round(b * 0.56 + 18)), a)
    result  = transform_pixels(image, fn)
    overlay = Image.new("RGBA", result.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle((0, 0, PX_W, PX_H), fill=(8, 18, 44, 34))
    result = Image.alpha_composite(result, overlay)
    return add_night_glow(result, lights)


# ── Main ───────────────────────────────────────────────────────────────────────

def save_variants() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    base, lights = build_base_scene()
    variants = {
        "verdant":      base,
        "autumn":       to_autumn(base),
        "winter":       to_winter(base),
        "night":        to_night(base, lights),
        "winter-night": to_night(to_winter(base), lights),
    }
    for name, image in variants.items():
        image.save(OUTPUTS[name])
        print(f"Saved {OUTPUTS[name]}")


if __name__ == "__main__":
    save_variants()
