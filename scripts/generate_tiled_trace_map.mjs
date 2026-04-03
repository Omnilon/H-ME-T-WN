import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutPath = path.join(repoRoot, 'data', 'pocketWorldsTownLayout.json');
const layout = JSON.parse(await fs.readFile(layoutPath, 'utf8'));
const tileSize = 32;
const referenceWidth = layout.runtimeWidth / layout.referenceScale;
const referenceHeight = layout.runtimeHeight / layout.referenceScale;
const runtimeScale = layout.referenceScale;

const mapPath = path.join(home, 'Home Town Layout.tmj');
const sessionPath = path.join(home, 'HØME TØWN.tiled-session');
const tilesetSource = 'Home Town Base.tsx';

let nextObjectId = 1;

function scaleTiles(value) {
  return value / runtimeScale;
}

function toPixels(tiles) {
  return tiles * tileSize;
}

function number(value) {
  return Number(value.toFixed(3));
}

function property(name, type, value) {
  return { name, type, value };
}

function makeRectObject({ name, x, y, width, height, objectType, extraProperties = [] }) {
  return {
    height: number(toPixels(scaleTiles(height))),
    id: nextObjectId++,
    name,
    rotation: 0,
    type: objectType,
    visible: true,
    width: number(toPixels(scaleTiles(width))),
    x: number(toPixels(scaleTiles(x))),
    y: number(toPixels(scaleTiles(y))),
    properties: [
      property('runtimeX', 'float', x),
      property('runtimeY', 'float', y),
      property('runtimeWidth', 'float', width),
      property('runtimeHeight', 'float', height),
      ...extraProperties,
    ],
  };
}

function makeEllipseObject({ name, cx, cy, rx, ry, objectType, extraProperties = [] }) {
  const scaledX = scaleTiles(cx - rx);
  const scaledY = scaleTiles(cy - ry);
  const scaledWidth = scaleTiles(rx * 2);
  const scaledHeight = scaleTiles(ry * 2);
  return {
    ellipse: true,
    height: number(toPixels(scaledHeight)),
    id: nextObjectId++,
    name,
    rotation: 0,
    type: objectType,
    visible: true,
    width: number(toPixels(scaledWidth)),
    x: number(toPixels(scaledX)),
    y: number(toPixels(scaledY)),
    properties: [
      property('runtimeCenterX', 'float', cx),
      property('runtimeCenterY', 'float', cy),
      property('runtimeRadiusX', 'float', rx),
      property('runtimeRadiusY', 'float', ry),
      ...extraProperties,
    ],
  };
}

function makePointObject({ name, x, y, extraProperties = [] }) {
  return {
    id: nextObjectId++,
    name,
    point: true,
    rotation: 0,
    type: 'district_center',
    visible: true,
    x: number(toPixels(scaleTiles(x))),
    y: number(toPixels(scaleTiles(y))),
    properties: [
      property('runtimeCenterX', 'float', x),
      property('runtimeCenterY', 'float', y),
      ...extraProperties,
    ],
  };
}

function buildReferenceLayer() {
  return {
    data: Array.from({ length: referenceWidth * referenceHeight }, (_, index) => index + 1),
    height: referenceHeight,
    id: 1,
    locked: true,
    name: 'Reference Map',
    opacity: 1,
    type: 'tilelayer',
    visible: true,
    width: referenceWidth,
    x: 0,
    y: 0,
  };
}

function buildDistrictLayer() {
  return {
    color: '#7dd3fc',
    draworder: 'topdown',
    id: 2,
    name: 'District Centers',
    objects: layout.districts.map((district) =>
      makePointObject({
        name: district.label,
        x: district.center.x,
        y: district.center.y,
        extraProperties: [
          property('districtId', 'string', district.id),
          property('description', 'string', district.description),
        ],
      }),
    ),
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildWaterLayer() {
  return {
    color: '#38bdf8',
    draworder: 'topdown',
    id: 3,
    name: 'Water Blockers',
    objects: [
      ...layout.waterEllipses.map((shape) =>
        makeEllipseObject({
          ...shape,
          objectType: 'water',
        }),
      ),
      ...layout.waterRects.map((shape) =>
        makeRectObject({
          ...shape,
          objectType: 'water',
        }),
      ),
    ],
    opacity: 0.45,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildBuildingLayer() {
  return {
    color: '#ef4444',
    draworder: 'topdown',
    id: 4,
    name: 'Building Footprints',
    objects: layout.buildingRects.map((shape) =>
      makeRectObject({
        ...shape,
        objectType: 'building',
        extraProperties: [property('district', 'string', shape.district)],
      }),
    ),
    opacity: 0.4,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildBridgeLayer() {
  return {
    color: '#f59e0b',
    draworder: 'topdown',
    id: 5,
    name: 'Bridge And Road Guides',
    objects: layout.walkwayRects.map((shape) =>
      makeRectObject({
        ...shape,
        objectType: 'walkway',
      }),
    ),
    opacity: 0.5,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildManualCollisionLayer() {
  return {
    color: '#a3e635',
    draworder: 'topdown',
    id: 6,
    name: 'Manual Collision Edits',
    objects: layout.manualCollisionRects.map((shape) =>
      makeRectObject({
        ...shape,
        objectType: 'manual_blocker',
      }),
    ),
    opacity: 0.8,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildEntranceLayer() {
  return {
    color: '#c084fc',
    draworder: 'topdown',
    id: 7,
    name: 'Entrances And Social Spots',
    objects: [],
    opacity: 0.9,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildNotesLayer() {
  return {
    color: '#f5f5f4',
    draworder: 'topdown',
    id: 8,
    name: 'Placement Notes',
    objects: [],
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function buildMapDocument() {
  return {
    compressionlevel: -1,
    height: referenceHeight,
    infinite: false,
    layers: [
      buildReferenceLayer(),
      buildDistrictLayer(),
      buildWaterLayer(),
      buildBuildingLayer(),
      buildBridgeLayer(),
      buildManualCollisionLayer(),
      buildEntranceLayer(),
      buildNotesLayer(),
    ],
    nextlayerid: 9,
    nextobjectid: nextObjectId,
    orientation: 'orthogonal',
    properties: [
      property('referenceTileset', 'string', tilesetSource),
      property('layoutSource', 'string', path.relative(home, layoutPath)),
      property('runtimeGridHeight', 'int', layout.runtimeHeight),
      property('runtimeGridWidth', 'int', layout.runtimeWidth),
      property('runtimeTileScale', 'int', runtimeScale),
      property(
        'workflow',
        'string',
        'Use the locked reference layer for tracing. Adjust blockers on object layers, then multiply tile positions by runtimeTileScale when syncing back into Pocket Worlds.',
      ),
    ],
    renderorder: 'right-down',
    tiledversion: '1.12.0',
    tileheight: tileSize,
    tilesets: [{ firstgid: 1, source: tilesetSource }],
    tilewidth: tileSize,
    type: 'map',
    version: '1.10',
    width: referenceWidth,
  };
}

async function updateSession() {
  try {
    const raw = await fs.readFile(sessionPath, 'utf8');
    const session = JSON.parse(raw);
    const fileName = path.basename(mapPath);
    session.activeFile = fileName;
    session.openFiles = Array.from(new Set([fileName, ...(session.openFiles ?? [])]));
    session.recentFiles = Array.from(new Set([fileName, ...(session.recentFiles ?? [])]));
    session.fileStates = session.fileStates ?? {};
    session.fileStates[fileName] = session.fileStates[fileName] ?? {
      dynamicWrapping: false,
      scaleInDock: 1,
      scaleInEditor: 1,
    };
    await fs.writeFile(sessionPath, `${JSON.stringify(session, null, 4)}\n`, 'utf8');
  } catch (error) {
    console.warn(`Could not update Tiled session: ${error}`);
  }
}

async function main() {
  nextObjectId = 1;
  const map = buildMapDocument();
  map.nextobjectid = nextObjectId;
  await fs.writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  await updateSession();
  console.log(`Wrote ${mapPath}`);
}

await main();
