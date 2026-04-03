import layout from './pocketWorldsTownLayout.json';

export type PocketWorldsDistrict = {
  id: string;
  label: string;
  description: string;
  center: { x: number; y: number };
  scale: number;
};

export type SocialSpot = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  district: string;
  type: string;
};

export const backgroundImageVariants = {
  verdant: './assets/pocket-worlds/pocket-worlds-town-verdant.png',
  autumn: './assets/pocket-worlds/pocket-worlds-town-autumn.png',
  winter: './assets/pocket-worlds/pocket-worlds-town-winter.png',
  night: './assets/pocket-worlds/pocket-worlds-town-night.png',
  winterNight: './assets/pocket-worlds/pocket-worlds-town-winter-night.png',
} as const;

export type PocketWorldsBackdrop = keyof typeof backgroundImageVariants;

type RectShape = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type EllipseShape = {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export const mapwidth = layout.runtimeWidth;
export const mapheight = layout.runtimeHeight;
export const tiledim = layout.tileSize;
export const screenxtiles = mapwidth;
export const screenytiles = mapheight;
export const tilesetpath = './assets/pocket-worlds/sunnyside_tileset.png';
export const tilesetpxw = 1024;
export const tilesetpxh = 1024;
export const backgroundImageUrl = backgroundImageVariants.verdant;

export const districts: PocketWorldsDistrict[] = layout.districts as PocketWorldsDistrict[];

// Social spots are open gathering areas (plazas, parks, docks, viewpoints).
// They are NOT collision blockers — residents can walk through them.
// They are exported so conversation targeting can prefer these locations.
export const socialSpots: SocialSpot[] = (layout.socialSpots ?? []) as SocialSpot[];

function createLayer(fill = -1) {
  return Array.from({ length: mapwidth }, () => Array.from({ length: mapheight }, () => fill));
}

function fillRect(layer: number[][], x: number, y: number, width: number, height: number, value = 0) {
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(mapwidth, x + width);
  const endY = Math.min(mapheight, y + height);

  for (let tileX = startX; tileX < endX; tileX += 1) {
    for (let tileY = startY; tileY < endY; tileY += 1) {
      layer[tileX][tileY] = value;
    }
  }
}

function clearRect(layer: number[][], x: number, y: number, width: number, height: number) {
  fillRect(layer, x, y, width, height, -1);
}

function fillEllipse(
  layer: number[][],
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  value = 0,
) {
  const startX = Math.max(0, Math.floor(centerX - radiusX - 1));
  const endX = Math.min(mapwidth - 1, Math.ceil(centerX + radiusX + 1));
  const startY = Math.max(0, Math.floor(centerY - radiusY - 1));
  const endY = Math.min(mapheight - 1, Math.ceil(centerY + radiusY + 1));

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      const dx = (tileX + 0.5 - centerX) / radiusX;
      const dy = (tileY + 0.5 - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        layer[tileX][tileY] = value;
      }
    }
  }
}

const emptyBackground = createLayer(-1);
const collisionLayer = createLayer(-1);

// Step 1: Block water
for (const ellipse of layout.waterEllipses as EllipseShape[]) {
  fillEllipse(collisionLayer, ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry);
}
for (const rect of layout.waterRects as RectShape[]) {
  fillRect(collisionLayer, rect.x, rect.y, rect.width, rect.height);
}

// Step 2: Punch through walkways and bridges (these override water blockers)
for (const rect of layout.walkwayRects as RectShape[]) {
  clearRect(collisionLayer, rect.x, rect.y, rect.width, rect.height);
}

// Step 3: Block building bases
for (const rect of layout.buildingRects as RectShape[]) {
  fillRect(collisionLayer, rect.x, rect.y, rect.width, rect.height);
}

// Step 4: Any hand-authored extra blockers
for (const rect of layout.manualCollisionRects as RectShape[]) {
  fillRect(collisionLayer, rect.x, rect.y, rect.width, rect.height);
}

// Social spots are NOT added to the collision layer — they stay walkable.

export const bgtiles = [emptyBackground];
export const objmap: number[][][] = [];
export const collisionTiles = [collisionLayer];
export const animatedsprites: never[] = [];
