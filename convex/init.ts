import { v } from 'convex/values';
import { internal } from './_generated/api';
import { DatabaseReader, MutationCtx, mutation } from './_generated/server';
import { Descriptions } from '../data/characters';
import * as map from '../data/pocketWorldsTownScene';
import { insertInput } from './aiTown/insertInput';
import { Id } from './_generated/dataModel';
import { createEngine } from './aiTown/main';
import { ENGINE_ACTION_DURATION } from './constants';
import { detectMismatchedLLMProvider } from './util/llm';

function mapDocument(worldId: Id<'worlds'>) {
  return {
    worldId,
    width: map.mapwidth,
    height: map.mapheight,
    tileSetUrl: map.tilesetpath,
    tileSetDimX: map.tilesetpxw,
    tileSetDimY: map.tilesetpxh,
    tileDim: map.tiledim,
    backgroundImageUrl: map.backgroundImageUrl,
    bgTiles: map.bgtiles,
    objectTiles: map.objmap,
    collisionTiles: map.collisionTiles,
    animatedSprites: map.animatedsprites,
  };
}

const init = mutation({
  args: {
    numAgents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    detectMismatchedLLMProvider();
    const { worldStatus, engine } = await getOrCreateDefaultWorld(ctx);
    if (worldStatus.status !== 'running') {
      console.warn(
        `Engine ${engine._id} is not active! Run "npx convex run testing:resume" to restart it.`,
      );
      return;
    }
    const targetCount = args.numAgents !== undefined ? args.numAgents : Descriptions.length;
    const seedPlan = await computeSeedPlan(
      ctx.db,
      worldStatus.worldId,
      worldStatus.engineId,
      targetCount,
    );
    if (seedPlan.length > 0) {
      for (const descriptionIndex of seedPlan) {
        await insertInput(ctx, worldStatus.worldId, 'createAgent', {
          descriptionIndex,
        });
      }
    }
  },
});
export default init;

async function getOrCreateDefaultWorld(ctx: MutationCtx) {
  const now = Date.now();

  let worldStatus = await ctx.db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .unique();
  if (worldStatus) {
    const existingMap = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus!.worldId))
      .unique();
    const desiredMap = mapDocument(worldStatus.worldId);
    if (!existingMap) {
      await ctx.db.insert('maps', desiredMap);
    } else {
      await ctx.db.replace(existingMap._id, desiredMap);
    }
    await syncResidentRoster(ctx, worldStatus.worldId, desiredMap);
    const engine = (await ctx.db.get(worldStatus.engineId))!;
    return { worldStatus, engine };
  }

  const engineId = await createEngine(ctx);
  const engine = (await ctx.db.get(engineId))!;
  const worldId = await ctx.db.insert('worlds', {
    nextId: 0,
    agents: [],
    conversations: [],
    players: [],
  });
  const worldStatusId = await ctx.db.insert('worldStatus', {
    engineId: engineId,
    isDefault: true,
    lastViewed: now,
    status: 'running',
    worldId: worldId,
  });
  worldStatus = (await ctx.db.get(worldStatusId))!;
  await ctx.db.insert('maps', mapDocument(worldId));
  await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
    worldId,
    generationNumber: engine.generationNumber,
    maxDuration: ENGINE_ACTION_DURATION,
  });
  return { worldStatus, engine };
}

async function syncResidentRoster(ctx: MutationCtx, worldId: Id<'worlds'>, desiredMap: ReturnType<typeof mapDocument>) {
  const world = await ctx.db.get(worldId);
  if (!world) {
    throw new Error(`Invalid world ID: ${worldId}`);
  }

  const aiPlayers = world.players.filter((player) => !player.human);
  const playerDescriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  const agentDescriptions = await ctx.db
    .query('agentDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();

  const playerDescriptionsByPlayerId = new Map(
    playerDescriptions.map((description) => [description.playerId, description] as const),
  );
  const agentDescriptionsByAgentId = new Map(
    agentDescriptions.map((description) => [description.agentId, description] as const),
  );
  const agentsByPlayerId = new Map(world.agents.map((agent) => [agent.playerId, agent] as const));

  for (let i = 0; i < Math.min(aiPlayers.length, Descriptions.length); i += 1) {
    const player = aiPlayers[i];
    const template = Descriptions[i];
    const playerDescription = playerDescriptionsByPlayerId.get(player.id);
    if (playerDescription) {
      if (
        playerDescription.name !== template.name ||
        playerDescription.description !== template.identity ||
        playerDescription.character !== template.character
      ) {
        await ctx.db.patch(playerDescription._id, {
          name: template.name,
          description: template.identity,
          character: template.character,
        });
      }
    } else {
      await ctx.db.insert('playerDescriptions', {
        worldId,
        playerId: player.id,
        name: template.name,
        description: template.identity,
        character: template.character,
      });
    }

    const agent = agentsByPlayerId.get(player.id);
    if (!agent) {
      continue;
    }
    const agentDescription = agentDescriptionsByAgentId.get(agent.id);
    if (agentDescription) {
      if (agentDescription.identity !== template.identity || agentDescription.plan !== template.plan) {
        await ctx.db.patch(agentDescription._id, {
          identity: template.identity,
          plan: template.plan,
        });
      }
    } else {
      await ctx.db.insert('agentDescriptions', {
        worldId,
        agentId: agent.id,
        identity: template.identity,
        plan: template.plan,
      });
    }
  }

  const occupied = new Set<string>();
  let playersChanged = false;
  const updatedPlayers = world.players.map((player) => {
    const clampedTile = {
      x: clamp(Math.floor(player.position.x), 0, desiredMap.width - 1),
      y: clamp(Math.floor(player.position.y), 0, desiredMap.height - 1),
    };
    const target =
      isWalkableTile(desiredMap, clampedTile.x, clampedTile.y) && !occupied.has(tileKey(clampedTile.x, clampedTile.y))
        ? clampedTile
        : findNearestOpenTile(desiredMap, clampedTile, occupied);
    occupied.add(tileKey(target.x, target.y));
    const needsSnap =
      player.position.x !== target.x ||
      player.position.y !== target.y ||
      player.speed !== 0 ||
      !!player.pathfinding ||
      !!player.activity;
    if (!needsSnap) {
      return player;
    }
    playersChanged = true;
    const nextPlayer = {
      ...player,
      position: target,
      speed: 0,
    };
    delete nextPlayer.pathfinding;
    delete nextPlayer.activity;
    return nextPlayer;
  });

  if (playersChanged) {
    await ctx.db.patch(worldId, { players: updatedPlayers });
  }
}

function isWalkableTile(mapDoc: ReturnType<typeof mapDocument>, x: number, y: number) {
  if (x < 0 || y < 0 || x >= mapDoc.width || y >= mapDoc.height) {
    return false;
  }
  for (const layer of mapDoc.collisionTiles) {
    if (layer[x][y] !== -1) {
      return false;
    }
  }
  return true;
}

function findNearestOpenTile(
  mapDoc: ReturnType<typeof mapDocument>,
  start: { x: number; y: number },
  occupied: Set<string>,
) {
  const queue = [start];
  const visited = new Set([tileKey(start.x, start.y)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (isWalkableTile(mapDoc, current.x, current.y) && !occupied.has(tileKey(current.x, current.y))) {
      return current;
    }
    for (const neighbor of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      if (
        neighbor.x < 0 ||
        neighbor.y < 0 ||
        neighbor.x >= mapDoc.width ||
        neighbor.y >= mapDoc.height
      ) {
        continue;
      }
      const key = tileKey(neighbor.x, neighbor.y);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return { x: 1, y: 1 };
}

function tileKey(x: number, y: number) {
  return `${x}:${y}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function computeSeedPlan(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  engineId: Id<'engines'>,
  targetCount: number,
) {
  const world = await db.get(worldId);
  if (!world) {
    throw new Error(`Invalid world ID: ${worldId}`);
  }
  const pendingCreateInputs = await db
    .query('inputs')
    .withIndex('byInputNumber', (q) => q.eq('engineId', engineId))
    .order('asc')
    .filter((q) => q.eq(q.field('name'), 'createAgent'))
    .filter((q) => q.eq(q.field('returnValue'), undefined))
    .collect();

  const playerDescriptions = await db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();

  const existingNames = new Set(playerDescriptions.map((description) => description.name));
  const pendingIndexes = new Set(
    pendingCreateInputs
      .map((input) => input.args?.descriptionIndex)
      .filter((descriptionIndex): descriptionIndex is number => typeof descriptionIndex === 'number'),
  );

  const queuedAgents = world.agents.length + pendingCreateInputs.length;
  const openSlots = Math.max(0, Math.min(targetCount, Descriptions.length) - queuedAgents);
  if (openSlots === 0) {
    return [];
  }

  const missingIndexes: number[] = [];
  for (let i = 0; i < Descriptions.length; i += 1) {
    if (pendingIndexes.has(i)) {
      continue;
    }
    if (existingNames.has(Descriptions[i].name)) {
      continue;
    }
    missingIndexes.push(i);
  }

  return missingIndexes.slice(0, openSlots);
}
