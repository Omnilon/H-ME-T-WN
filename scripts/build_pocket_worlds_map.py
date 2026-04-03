from __future__ import annotations

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
DOWNLOADS = Path.home() / "Downloads"
SUNNYSIDE_PACK = DOWNLOADS / "Sunnyside_World_ASSET_PACK_V2.1" / "Sunnyside_World_Assets"
VENDOR = WORKSPACE / "vendor" / "sunnyside_extract"
OUTPUT_DIR = ROOT / "public" / "assets" / "pocket-worlds"

MAP_WIDTH = 96 * 32
MAP_HEIGHT = 64 * 32
TILE = 32

OUTPUTS = {
    "verdant": OUTPUT_DIR / "pocket-worlds-town-verdant.png",
    "autumn": OUTPUT_DIR / "pocket-worlds-town-autumn.png",
    "winter": OUTPUT_DIR / "pocket-worlds-town-winter.png",
    "night": OUTPUT_DIR / "pocket-worlds-town-night.png",
    "winter-night": OUTPUT_DIR / "pocket-worlds-town-winter-night.png",
}

TILESET_PATH = SUNNYSIDE_PACK / "Tileset" / "spr_tileset_sunnysideworld_16px.png"
TREE_1_PATH = SUNNYSIDE_PACK / "Elements" / "Plants" / "spr_deco_tree_01_strip4.png"
TREE_2_PATH = SUNNYSIDE_PACK / "Elements" / "Plants" / "spr_deco_tree_02_strip4.png"
WINDMILL_PATH = SUNNYSIDE_PACK / "Elements" / "Other" / "spr_deco_windmill_withshadow_strip9.png"
CORACLE_PATH = SUNNYSIDE_PACK / "Elements" / "Other" / "spr_deco_coracle_land.png"
CORACLE_WATER_PATH = SUNNYSIDE_PACK / "Elements" / "Other" / "spr_deco_coracle_strip4.png"
SOIL_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "soil_01.png"
PUMPKIN_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "pumpkin_05.png"
WHEAT_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "wheat_05.png"
ROCK_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "rock.png"
WOOD_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "wood.png"
CRATE_PATH = SUNNYSIDE_PACK / "Elements" / "Crops" / "crate_top.png"
DUCK_PATH = SUNNYSIDE_PACK / "Elements" / "Animals" / "spr_deco_duck_01_strip4.png"
SHEEP_PATH = SUNNYSIDE_PACK / "Elements" / "Animals" / "spr_deco_sheep_01_strip4.png"
COW_PATH = SUNNYSIDE_PACK / "Elements" / "Animals" / "spr_deco_cow_strip4.png"

BUILDINGS_PATH = VENDOR / "buildings" / "SUNNYSIDE_WORLD_BUILDINGS_V0.01.png"
WELL_PATH = (
    DOWNLOADS
    / "Sunnyside_World_ASSET_PACK_V2.1"
    / "Sunnyside_World_Gamemaker"
    / "sprites"
    / "spr_deco_well_covered"
    / "28ee3935-0d63-4141-b01a-2338fa50e040.png"
)
FLOWERS_PATH = (
    DOWNLOADS
    / "Sunnyside_World_ASSET_PACK_V2.1"
    / "Sunnyside_World_Gamemaker"
    / "sprites"
    / "spr_deco_flowers_house_01"
    / "36388643-e82c-4037-97b4-3d1fa4cb65fb.png"
)

RNG = random.Random(17)


def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def crop(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    return sheet.crop(box).copy()


def crop_trimmed(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    sprite = crop(sheet, box)
    bbox = sprite.getbbox()
    if bbox is None:
        return sprite
    return sprite.crop(bbox)


def first_frame(path: Path, frames: int) -> Image.Image:
    strip = load_image(path)
    frame_width = strip.width // frames
    return crop(strip, (0, 0, frame_width, strip.height))


def resize(sprite: Image.Image, *, scale: float | None = None, width: int | None = None) -> Image.Image:
    if width is not None:
        scale = width / sprite.width
    if scale is None:
        raise ValueError("scale or width is required")
    return sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.NEAREST,
    )


def shadow(sprite: Image.Image, opacity: int = 110) -> Image.Image:
    result = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    alpha = sprite.getchannel("A").point(lambda value: min(255, round(value * opacity / 255)))
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
        shadow_sprite = shadow(art)
        canvas.alpha_composite(shadow_sprite, (round(x + 6), round(y + 10)))
    canvas.alpha_composite(art, (round(x), round(y)))
    return (round(x), round(y), round(x + art.width), round(y + art.height))


def tiled_fill(tile: Image.Image, width: int, height: int) -> Image.Image:
    result = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for x in range(0, width, tile.width):
        for y in range(0, height, tile.height):
            result.alpha_composite(tile, (x, y))
    return result


def tile_rect(x: int, y: int, width: int, height: int) -> tuple[int, int, int, int]:
    return (x * TILE, y * TILE, (x + width) * TILE, (y + height) * TILE)


def point_tiles(x: float, y: float) -> tuple[int, int]:
    return (round(x * TILE), round(y * TILE))


def draw_mottled_ground(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, MAP_WIDTH, MAP_HEIGHT), fill=(127, 185, 96, 255))
    colors = [
        (138, 196, 103, 255),
        (118, 178, 92, 255),
        (151, 205, 112, 255),
        (103, 161, 80, 255),
    ]
    for _ in range(2200):
        radius_x = RNG.randint(18, 54)
        radius_y = RNG.randint(14, 42)
        x = RNG.randint(-32, MAP_WIDTH + 32)
        y = RNG.randint(-32, MAP_HEIGHT + 32)
        color = list(RNG.choice(colors))
        color[-1] = RNG.randint(28, 64)
        draw.ellipse((x, y, x + radius_x, y + radius_y), fill=tuple(color))


def add_water(canvas: Image.Image, water_tile: Image.Image) -> None:
    water = tiled_fill(water_tile, MAP_WIDTH, MAP_HEIGHT)
    mask = Image.new("L", (MAP_WIDTH, MAP_HEIGHT), 0)
    draw = ImageDraw.Draw(mask)

    draw.ellipse((940, -20, 2120, 320), fill=255)
    draw.rounded_rectangle((2464, 120, 2896, 968), radius=160, fill=255)
    draw.ellipse((2580, 640, 3056, 1160), fill=255)
    draw.ellipse((210, 420, 930, 980), fill=255)
    draw.ellipse((1120, 1180, 1920, 1630), fill=255)
    draw.rounded_rectangle((1460, 1352, 3060, 2050), radius=260, fill=255)
    draw.rounded_rectangle((1430, 1180, 1710, 1650), radius=74, fill=255)
    draw.rounded_rectangle((2672, 912, 2930, 1512), radius=84, fill=255)

    # Keep road crossings intact.
    draw.rectangle((1452, 1388, 1676, 1488), fill=0)
    draw.rectangle((2310, 884, 2580, 978), fill=0)
    draw.rectangle((1304, 1048, 1454, 1170), fill=0)
    draw.rectangle((2645, 864, 2768, 906), fill=0)

    canvas.paste(water, (0, 0), mask)

    shoreline = ImageDraw.Draw(canvas)
    for box in (
        (1452, 1388, 1676, 1488),
        (2310, 884, 2580, 978),
        (1304, 1048, 1454, 1170),
    ):
        shoreline.rounded_rectangle(box, radius=18, fill=(160, 146, 110, 255))
    shoreline.rounded_rectangle((1408, 1512, 1712, 1562), radius=18, fill=(104, 107, 118, 255))

    # Waterfall hints on the east cascade and south spillway.
    for x in (2810, 2848, 2886):
        shoreline.rectangle((x, 82, x + 14, 312), fill=(201, 244, 255, 120))
    for x in (1552, 1588, 1624):
        shoreline.rectangle((x, 1470, x + 12, 1562), fill=(220, 244, 255, 145))


def add_roads(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    dirt = (221, 203, 156, 255)
    dirt_edge = (177, 154, 108, 255)
    stone = (192, 190, 181, 255)
    stone_edge = (148, 145, 138, 255)

    def path(box: tuple[int, int, int, int], *, radius: int, fill: tuple[int, int, int, int], outline):
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=8)

    path((905, 380, 2190, 1080), radius=172, fill=dirt, outline=dirt_edge)
    path((1178, 1078, 1762, 1488), radius=96, fill=dirt, outline=dirt_edge)
    path((170, 286, 826, 932), radius=110, fill=dirt, outline=dirt_edge)
    path((2362, 298, 2950, 1032), radius=96, fill=dirt, outline=dirt_edge)
    path((126, 1365, 970, 1914), radius=132, fill=dirt, outline=dirt_edge)
    path((2148, 1388, 3036, 1938), radius=82, fill=stone, outline=stone_edge)

    draw.rectangle((1490, 256, 1574, 1502), fill=dirt, outline=dirt_edge)
    draw.rectangle((516, 1470, 1550, 1546), fill=dirt, outline=dirt_edge)
    draw.rectangle((1540, 828, 2570, 894), fill=dirt, outline=dirt_edge)
    draw.rectangle((512, 606, 1188, 670), fill=dirt, outline=dirt_edge)
    draw.rectangle((2442, 774, 2720, 834), fill=dirt, outline=dirt_edge)

    # The old square gets a cobblestone grid so it feels like an actual town core.
    for x in range(968, 2140, 42):
        draw.line((x, 480, x, 1028), fill=(180, 168, 132, 72), width=2)
    for y in range(468, 1040, 40):
        draw.line((948, y, 2140, y), fill=(180, 168, 132, 72), width=2)

    # Bridge parapets.
    draw.rounded_rectangle((1408, 1502, 1712, 1568), radius=18, fill=(116, 113, 126, 255))
    draw.rounded_rectangle((2312, 882, 2580, 982), radius=20, fill=(142, 128, 98, 255))
    draw.rounded_rectangle((1302, 1048, 1456, 1170), radius=12, fill=(164, 148, 116, 255))


def add_harbor(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    stone = (196, 193, 185, 255)
    stone_shadow = (158, 155, 148, 255)
    wood = (126, 91, 62, 255)

    draw.rounded_rectangle((2178, 1402, 3036, 1960), radius=56, fill=stone, outline=stone_shadow, width=8)
    draw.rectangle((2322, 1510, 2432, 1898), fill=stone)
    draw.rectangle((2546, 1502, 2660, 1942), fill=stone)
    draw.rectangle((2792, 1436, 2910, 1784), fill=stone)
    draw.rectangle((2288, 1568, 3032, 1648), fill=stone_shadow)
    draw.rectangle((2210, 1674, 2920, 1718), fill=stone_shadow)
    for y in (1498, 1636, 1776):
        draw.rectangle((2896, y, 3072, y + 26), fill=wood)
    draw.rectangle((2348, 1536, 2460, 1820), fill=wood)
    draw.rectangle((2588, 1540, 2690, 1848), fill=wood)


def add_fields(canvas: Image.Image, soil: Image.Image, wheat: Image.Image, pumpkin: Image.Image) -> None:
    field = tiled_fill(soil, 208, 140)
    canvas.alpha_composite(field, (412, 520))

    for index, sprite in enumerate((wheat, wheat, wheat, pumpkin, pumpkin, wheat)):
        px = 432 + (index % 3) * 56
        py = 536 + (index // 3) * 52
        paste(canvas, sprite, px, py, width=42)

    draw = ImageDraw.Draw(canvas)
    draw.ellipse((236, 642, 336, 744), fill=(95, 177, 230, 255), outline=(226, 250, 255, 255), width=6)


def scatter_trees(canvas: Image.Image, trees: list[Image.Image]) -> None:
    placements: list[tuple[int, int, Image.Image, int]] = []
    for x in range(-60, MAP_WIDTH + 40, 106):
        placements.append((x + RNG.randint(-18, 18), -20 + RNG.randint(-12, 12), RNG.choice(trees), RNG.randint(54, 70)))
        placements.append((x + RNG.randint(-26, 18), MAP_HEIGHT - 92 + RNG.randint(-12, 22), RNG.choice(trees), RNG.randint(56, 72)))
    for y in range(40, MAP_HEIGHT - 80, 86):
        placements.append((-24 + RNG.randint(-10, 10), y + RNG.randint(-18, 18), RNG.choice(trees), RNG.randint(54, 72)))
        placements.append((MAP_WIDTH - 72 + RNG.randint(-12, 12), y + RNG.randint(-18, 18), RNG.choice(trees), RNG.randint(54, 72)))

    interior_clusters = [
        (1050, 126, 17),
        (1400, 114, 24),
        (1760, 160, 18),
        (2260, 210, 12),
        (2580, 1040, 16),
        (640, 1060, 16),
        (470, 1460, 11),
        (1810, 1730, 22),
    ]
    for center_x, center_y, count in interior_clusters:
        for _ in range(count):
            placements.append(
                (
                    center_x + RNG.randint(-180, 180),
                    center_y + RNG.randint(-120, 120),
                    RNG.choice(trees),
                    RNG.randint(56, 74),
                ),
            )

    for x, y, sprite, width in placements:
        paste(canvas, sprite, x, y, width=width, flip=RNG.random() > 0.5, with_shadow=True)


def add_decoration(
    canvas: Image.Image,
    *,
    well: Image.Image,
    flowers: Image.Image,
    duck: Image.Image,
    sheep: Image.Image,
    cow: Image.Image,
    rock: Image.Image,
    crate: Image.Image,
    wood: Image.Image,
    coracle_land: Image.Image,
    coracle_water: Image.Image,
    windmill: Image.Image,
) -> list[tuple[int, int, int]]:
    lights: list[tuple[int, int, int]] = []

    paste(canvas, well, 235, 618, width=108, with_shadow=True)
    paste(canvas, flowers, 1470, 772, width=44)
    paste(canvas, flowers, 1628, 782, width=42)
    paste(canvas, flowers, 1704, 772, width=40)
    paste(canvas, rock, 310, 470, width=46)
    paste(canvas, rock, 2700, 360, width=40)
    paste(canvas, crate, 2320, 1516, width=32)
    paste(canvas, crate, 2598, 1522, width=32)
    paste(canvas, wood, 2842, 1582, width=30)
    paste(canvas, wood, 2912, 1588, width=30)
    paste(canvas, coracle_land, 2860, 820, width=54, with_shadow=True)
    paste(canvas, coracle_land, 1786, 1902, width=54, with_shadow=True)
    paste(canvas, coracle_water, 2978, 1816, width=48)
    paste(canvas, coracle_water, 2744, 1860, width=44)
    paste(canvas, duck, 2640, 264, width=26)
    paste(canvas, duck, 448, 760, width=24)
    paste(canvas, sheep, 2688, 336, width=34)
    paste(canvas, sheep, 2740, 382, width=34)
    paste(canvas, sheep, 2800, 420, width=34)
    paste(canvas, cow, 354, 438, width=42)
    paste(canvas, cow, 266, 556, width=42)
    paste(canvas, windmill, 420, 1542, width=180, with_shadow=True)
    lights.extend(
        [
            (2860, 1640, 82),
            (2932, 1648, 82),
            (2360, 1528, 72),
            (2630, 1534, 72),
        ]
    )
    return lights


def add_buildings(
    canvas: Image.Image,
    *,
    cottages: list[Image.Image],
    church_body: Image.Image,
    church_tower: Image.Image,
) -> list[tuple[int, int, int]]:
    lights: list[tuple[int, int, int]] = []

    def place_house(
        sprite: Image.Image,
        site: tuple[int, int, int, int],
        *,
        width: int,
        nudge_x: int = 0,
        nudge_y: int = 8,
        flip: bool = False,
    ) -> tuple[int, int, int, int]:
        x, y, w, h = site
        px, py, pw, ph = tile_rect(x, y, w, h)
        art = resize(sprite, width=width)
        left = round(px + (pw - art.width) / 2 + nudge_x)
        top = round(py + ph - art.height + nudge_y)
        box = paste(canvas, art, left, top, flip=flip, with_shadow=True)
        lights.append((box[0] + art.width // 2, box[1] + art.height // 2 + 10, max(50, art.width // 2)))
        return box

    # Meadow homes.
    meadow_sites = [(9, 10, 6, 5), (16, 9, 6, 5), (23, 10, 6, 5), (11, 17, 6, 5)]
    for index, site in enumerate(meadow_sites):
        place_house(
            cottages[index % len(cottages)],
            site,
            width=112 + (index % 2) * 8,
            nudge_x=(-10 if index % 2 == 0 else 8),
            nudge_y=10,
        )

    # Old square and central homes.
    central_sites = [
        ((30, 13, 8, 6), cottages[1], 136, -16, 12),
        ((40, 11, 11, 7), cottages[0], 156, 2, 14),
        ((32, 22, 8, 6), cottages[2], 132, -8, 12),
        ((41, 20, 10, 6), cottages[1], 122, 0, 16),
        ((55, 21, 8, 7), cottages[3], 148, 12, 14),
        ((63, 18, 7, 7), cottages[2], 118, 8, 12),
    ]
    for site, sprite, width, nudge_x, nudge_y in central_sites:
        place_house(sprite, site, width=width, nudge_x=nudge_x, nudge_y=nudge_y)

    # Church + tower landmark.
    church_site = (53, 11, 7, 7)
    px, py, pw, ph = tile_rect(*church_site)
    church_width = 210
    church_art = resize(church_body, width=church_width)
    church_left = round(px + (pw - church_art.width) / 2 + 14)
    church_top = round(py + ph - church_art.height + 18)
    church_box = paste(canvas, church_art, church_left, church_top, with_shadow=True)
    tower_art = resize(church_tower, scale=4.4)
    tower_left = church_box[0] + round(church_art.width * 0.44)
    tower_top = church_box[1] - tower_art.height + 26
    paste(canvas, tower_art, tower_left, tower_top, with_shadow=True)
    lights.append((church_box[0] + church_art.width // 2, church_box[1] + church_art.height // 2, 94))
    lights.append((tower_left + tower_art.width // 2, tower_top + tower_art.height // 2, 74))

    # River walk.
    river_sites = [(76, 10, 6, 5), (82, 12, 7, 6), (76, 20, 6, 5), (84, 21, 7, 6)]
    for index, site in enumerate(river_sites):
        place_house(
            cottages[(index + 2) % len(cottages)],
            site,
            width=106 + (index % 2) * 12,
            nudge_x=(-12 if index % 2 == 0 else 8),
            nudge_y=12,
        )

    # South bridge cabins.
    south_sites = [(10, 45, 7, 6), (16, 49, 7, 6), (6, 53, 7, 6), (15, 57, 7, 5)]
    for index, site in enumerate(south_sites):
        place_house(
            cottages[(index + 1) % len(cottages)],
            site,
            width=116 if index < 2 else 126,
            nudge_x=(-12 if index % 2 == 0 else 10),
            nudge_y=12,
        )

    # Harbor warehouses and shops.
    harbor_sites = [(69, 44, 10, 6), (80, 44, 9, 6), (69, 52, 10, 6), (80, 52, 9, 6)]
    for index, site in enumerate(harbor_sites):
        place_house(
            cottages[index % len(cottages)],
            site,
            width=136 if index < 2 else 148,
            nudge_x=(-8 if index % 2 == 0 else 10),
            nudge_y=14,
        )

    return lights


def add_square_gardens(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((1506, 760, 1760, 880), radius=26, fill=(93, 149, 90, 255), outline=(58, 91, 54, 255), width=5)
    draw.ellipse((1602, 786, 1662, 846), fill=(104, 178, 221, 255))
    draw.ellipse((1668, 788, 1728, 848), fill=(227, 205, 106, 255))


def build_base_scene() -> tuple[Image.Image, list[tuple[int, int, int]]]:
    tileset = load_image(TILESET_PATH)
    buildings = load_image(BUILDINGS_PATH)

    water_tile = crop(tileset, (176, 288, 240, 352))
    house_blue = crop_trimmed(tileset, (520, 168, 552, 224))
    house_green = crop_trimmed(tileset, (520, 296, 552, 352))
    house_orange = crop_trimmed(tileset, (520, 424, 552, 480))
    house_red = crop_trimmed(tileset, (520, 552, 552, 608))
    house_purple = crop_trimmed(tileset, (520, 680, 552, 736))
    church_body = crop(buildings, (93, 121, 179, 176))
    church_tower = crop(buildings, (89, 28, 119, 109))

    tree_1 = first_frame(TREE_1_PATH, 4)
    tree_2 = first_frame(TREE_2_PATH, 4)
    soil = load_image(SOIL_PATH)
    wheat = load_image(WHEAT_PATH)
    pumpkin = load_image(PUMPKIN_PATH)
    duck = first_frame(DUCK_PATH, 4)
    sheep = first_frame(SHEEP_PATH, 4)
    cow = first_frame(COW_PATH, 4)
    windmill = first_frame(WINDMILL_PATH, 9)
    coracle_land = load_image(CORACLE_PATH)
    coracle_water = first_frame(CORACLE_WATER_PATH, 4)
    well = load_image(WELL_PATH)
    flowers = load_image(FLOWERS_PATH)
    rock = load_image(ROCK_PATH)
    wood = load_image(WOOD_PATH)
    crate = load_image(CRATE_PATH)

    canvas = Image.new("RGBA", (MAP_WIDTH, MAP_HEIGHT), (0, 0, 0, 0))
    draw_mottled_ground(canvas)
    add_water(canvas, water_tile)
    add_roads(canvas)
    add_harbor(canvas)
    add_fields(canvas, soil, wheat, pumpkin)
    scatter_trees(canvas, [tree_1, tree_2])
    add_square_gardens(canvas)
    building_lights = add_buildings(
        canvas,
        cottages=[house_blue, house_green, house_orange, house_red, house_purple],
        church_body=church_body,
        church_tower=church_tower,
    )
    decoration_lights = add_decoration(
        canvas,
        well=well,
        flowers=flowers,
        duck=duck,
        sheep=sheep,
        cow=cow,
        rock=rock,
        crate=crate,
        wood=wood,
        coracle_land=coracle_land,
        coracle_water=coracle_water,
        windmill=windmill,
    )
    return canvas, building_lights + decoration_lights


def transform_pixels(image: Image.Image, transform) -> Image.Image:
    src = image.convert("RGBA")
    data = [transform(*pixel) for pixel in src.getdata()]
    result = Image.new("RGBA", src.size)
    result.putdata(data)
    return result


def to_autumn(image: Image.Image) -> Image.Image:
    def transform(r: int, g: int, b: int, a: int):
        if a == 0:
            return (r, g, b, a)
        if g > r + 18 and g > b + 16:
            warmth = g - max(r, b)
            return (
                min(255, round(r + warmth * 0.92 + 18)),
                min(255, round(g * 0.86 + warmth * 0.15 + 8)),
                min(255, round(b * 0.75)),
                a,
            )
        return (
            min(255, round(r * 1.06 + 6)),
            min(255, round(g * 0.96)),
            min(255, round(b * 0.92)),
            a,
        )

    result = transform_pixels(image, transform)
    foliage_overlay = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(foliage_overlay)
    for _ in range(260):
        radius = RNG.randint(16, 52)
        x = RNG.randint(0, MAP_WIDTH)
        y = RNG.randint(0, MAP_HEIGHT)
        color = RNG.choice(
            [
                (244, 156, 68, 26),
                (231, 119, 66, 24),
                (211, 164, 61, 22),
            ]
        )
        draw.ellipse((x, y, x + radius, y + radius), fill=color)
    return Image.alpha_composite(result, foliage_overlay)


def to_winter(image: Image.Image) -> Image.Image:
    def transform(r: int, g: int, b: int, a: int):
        if a == 0:
            return (r, g, b, a)
        if g > r + 12 and g > b + 8:
            white = min(255, round((r + g + b) / 3 + 78))
            return (max(0, white - 10), min(255, white - 2), min(255, white + 16), a)
        average = round((r + g + b) / 3)
        cold = min(255, average + 18)
        return (max(0, cold - 10), cold, min(255, cold + 18), a)

    result = transform_pixels(image, transform)
    snow = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(snow)
    for _ in range(14000):
        x = RNG.randint(0, MAP_WIDTH)
        y = RNG.randint(0, MAP_HEIGHT)
        draw.rectangle((x, y, x + 1, y + 1), fill=(255, 255, 255, RNG.randint(24, 70)))
    return Image.alpha_composite(result, snow)


def add_night_glow(image: Image.Image, lights: list[tuple[int, int, int]]) -> Image.Image:
    glow_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow_layer)
    for x, y, radius in lights:
        for scale, alpha in ((1.6, 20), (1.05, 44), (0.6, 110)):
            current_radius = round(radius * scale)
            draw.ellipse(
                (x - current_radius, y - current_radius, x + current_radius, y + current_radius),
                fill=(246, 195, 105, alpha),
            )
    blur = glow_layer.filter(ImageFilter.GaussianBlur(radius=22))
    return Image.alpha_composite(image, blur)


def to_night(image: Image.Image, lights: list[tuple[int, int, int]]) -> Image.Image:
    def transform(r: int, g: int, b: int, a: int):
        if a == 0:
            return (r, g, b, a)
        return (
            max(0, round(r * 0.28)),
            max(0, round(g * 0.34)),
            min(255, round(b * 0.56 + 18)),
            a,
        )

    result = transform_pixels(image, transform)
    overlay = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0, 0, MAP_WIDTH, MAP_HEIGHT), fill=(8, 18, 44, 34))
    result = Image.alpha_composite(result, overlay)
    return add_night_glow(result, lights)


def save_variants() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    base, lights = build_base_scene()
    autumn = to_autumn(base)
    winter = to_winter(base)
    night = to_night(base, lights)
    winter_night = to_night(winter, lights)

    variants = {
        "verdant": base,
        "autumn": autumn,
        "winter": winter,
        "night": night,
        "winter-night": winter_night,
    }

    for name, image in variants.items():
        image.save(OUTPUTS[name])
        print(OUTPUTS[name])


if __name__ == "__main__":
    save_variants()
