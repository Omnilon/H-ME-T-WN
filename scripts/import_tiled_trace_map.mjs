import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutPath = path.join(repoRoot, 'data', 'pocketWorldsTownLayout.json');
const mapPath = path.join(home, 'Home Town Layout.tmj');

const existingLayout = JSON.parse(await fs.readFile(layoutPath, 'utf8'));
const mapDocument = JSON.parse(await fs.readFile(mapPath, 'utf8'));

const runtimeScale = existingLayout.referenceScale;
const tileSize = existingLayout.tileSize;

function getLayer(name) {
  const layer = mapDocument.layers.find((candidate) => candidate.name === name);
  if (!layer) {
    throw new Error(`Missing layer "${name}" in ${mapPath}`);
  }
  return layer;
}

function getProperty(object, name) {
  return object.properties?.find((property) => property.name === name)?.value;
}

function roundRuntime(value) {
  return Math.round(value);
}

function pixelsToRuntimeTiles(value) {
  return roundRuntime((value / tileSize) * runtimeScale);
}

function rectFromObject(object) {
  return {
    name: object.name || `Rect ${object.id}`,
    x: pixelsToRuntimeTiles(object.x),
    y: pixelsToRuntimeTiles(object.y),
    width: pixelsToRuntimeTiles(object.width),
    height: pixelsToRuntimeTiles(object.height),
  };
}

function ellipseFromObject(object) {
  return {
    name: object.name || `Ellipse ${object.id}`,
    cx: pixelsToRuntimeTiles(object.x + object.width / 2),
    cy: pixelsToRuntimeTiles(object.y + object.height / 2),
    rx: pixelsToRuntimeTiles(object.width / 2),
    ry: pixelsToRuntimeTiles(object.height / 2),
  };
}

function importDistricts() {
  const layer = getLayer('District Centers');
  return layer.objects.map((object) => {
    const districtId = getProperty(object, 'districtId');
    const existing =
      existingLayout.districts.find((district) => district.id === districtId) ??
      existingLayout.districts.find((district) => district.label === object.name);
    return {
      id: districtId ?? existing?.id ?? object.name.toLowerCase().replace(/\s+/g, '-'),
      label: object.name,
      description:
        getProperty(object, 'description') ??
        existing?.description ??
        'Update this district description in Tiled.',
      center: {
        x: pixelsToRuntimeTiles(object.x),
        y: pixelsToRuntimeTiles(object.y),
      },
      scale: existing?.scale ?? 1.6,
    };
  });
}

function importRectsFromLayer(name, extra = () => ({})) {
  const layer = getLayer(name);
  return layer.objects
    .filter((object) => !object.ellipse && !object.point)
    .map((object) => ({
      ...rectFromObject(object),
      ...extra(object),
    }));
}

function importEllipsesFromLayer(name) {
  const layer = getLayer(name);
  return layer.objects.filter((object) => object.ellipse).map(ellipseFromObject);
}

const nextLayout = {
  ...existingLayout,
  districts: importDistricts(),
  waterEllipses: importEllipsesFromLayer('Water Blockers'),
  waterRects: importRectsFromLayer('Water Blockers'),
  walkwayRects: importRectsFromLayer('Bridge And Road Guides'),
  buildingRects: importRectsFromLayer('Building Footprints', (object) => ({
    district:
      getProperty(object, 'district') ??
      existingLayout.buildingRects.find((entry) => entry.name === object.name)?.district ??
      'Unassigned',
  })),
  manualCollisionRects: importRectsFromLayer('Manual Collision Edits'),
};

await fs.writeFile(layoutPath, `${JSON.stringify(nextLayout, null, 2)}\n`, 'utf8');
console.log(`Synced ${mapPath} -> ${layoutPath}`);
