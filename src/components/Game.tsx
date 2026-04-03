import { useEffect, useMemo, useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { type ServerGame, useServerGame } from '../hooks/serverGame.ts';
import {
  backgroundImageVariants,
  type PocketWorldsBackdrop,
} from '../../data/pocketWorldsTownScene.ts';
import { WorldMap } from '../../convex/aiTown/worldMap.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game(props: {
  backdropMode: PocketWorldsBackdrop;
  focusDistrictId?: string | null;
  hudVisible: boolean;
  onHudActivity?: () => void;
  onHudReveal?: () => void;
}) {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const snapshot = useMemo(
    () =>
      renderGameToText({
        backdropMode: props.backdropMode,
        worldStatus,
        engineId,
        game,
        focusDistrictId: props.focusDistrictId,
        hudVisible: props.hudVisible,
        selectedPlayerId: selectedElement?.id,
      }),
    [
      engineId,
      game,
      props.backdropMode,
      props.focusDistrictId,
      props.hudVisible,
      selectedElement?.id,
      worldStatus,
    ],
  );

  const scenicMap = useMemo<WorldMap | undefined>(() => {
    if (!game) {
      return undefined;
    }
    const backgroundImageUrl =
      backgroundImageVariants[props.backdropMode] ?? game.worldMap.backgroundImageUrl;
    const emptyVisualLayer = Array.from({ length: game.worldMap.width }, () =>
      Array.from({ length: game.worldMap.height }, () => -1),
    );
    return new WorldMap({
      ...game.worldMap.serialize(),
      backgroundImageUrl,
      bgTiles: [emptyVisualLayer],
      objectTiles: [],
    });
  }, [game, props.backdropMode]);

  useEffect(() => {
    window.render_game_to_text = () => snapshot;

    return () => {
      delete window.render_game_to_text;
    };
  }, [snapshot]);

  if (!worldId || !engineId || !game) {
    return (
      <div className="grid h-full w-full place-items-center bg-brown-900/90 p-8 text-brown-100">
        <div className="box max-w-2xl p-6 text-center">
          <h2 className="bg-brown-700 p-2 font-display text-3xl tracking-wider shadow-solid">
            Connecting to Pocket Worlds
          </h2>
          <p className="mt-4 text-base sm:text-lg">
            The bundled AI Town frontend is waiting for the Convex world state to load.
          </p>
          <p className="mt-2 text-sm text-brown-200">
            Snapshot status: {snapshot.replace(/\n/g, ' ')}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className="relative h-full w-full overflow-hidden bg-brown-900" ref={gameWrapperRef}>
        <div className="absolute inset-0">
          <div className="h-full w-full">
            <Stage width={width} height={height} options={{ backgroundColor: 0x7ab5ff }}>
              {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
              <ConvexProvider client={convex}>
                <PixiGame
                  engineId={engineId}
                  focusDistrictId={props.focusDistrictId}
                  game={game}
                  height={height}
                  historicalTime={historicalTime}
                  hudVisible={props.hudVisible}
                  map={scenicMap ?? game.worldMap}
                  onHudActivity={props.onHudActivity}
                  onHudReveal={props.onHudReveal}
                  setSelectedElement={setSelectedElement}
                  width={width}
                  worldId={worldId}
                />
              </ConvexProvider>
            </Stage>
          </div>
        </div>

        {props.hudVisible && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-full justify-end p-4 sm:p-6">
            <div className="pointer-events-auto flex h-full w-full max-w-[380px] flex-col overflow-hidden rounded-[30px] border border-white/15 bg-black/60 text-brown-100 shadow-2xl backdrop-blur-md">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.28em] text-stone-300">
                  Resident Feed
                </div>
                <div className="mt-2 text-sm text-stone-100">
                  Select any citizen to inspect their social life, history, and live chat state.
                </div>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5"
                ref={scrollViewRef}
              >
                <PlayerDetails
                  engineId={engineId}
                  game={game}
                  playerId={selectedElement?.id}
                  scrollViewRef={scrollViewRef}
                  setSelectedElement={setSelectedElement}
                  worldId={worldId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function renderGameToText(props: {
  backdropMode: PocketWorldsBackdrop;
  worldStatus:
    | {
        worldId: string;
        engineId: string;
        status: string;
      }
    | null
    | undefined;
  engineId: string | undefined;
  focusDistrictId: string | null | undefined;
  game: ServerGame | undefined;
  hudVisible: boolean;
  selectedPlayerId: GameId<'players'> | undefined;
}) {
  const lines = ['Pocket Worlds AI Town'];

  if (!props.worldStatus || !props.engineId) {
    lines.push('State: waiting for default world status from Convex.');
    return lines.join('\n');
  }

  lines.push(`World status: ${props.worldStatus.status}`);
  lines.push(`World ID: ${props.worldStatus.worldId}`);
  lines.push(`Engine ID: ${props.engineId}`);
  lines.push(`HUD: ${props.hudVisible ? 'visible' : 'hidden'}`);
  lines.push(`Backdrop: ${props.backdropMode}`);
  lines.push(`Focused district: ${props.focusDistrictId ?? 'free roam'}`);

  if (!props.game) {
    lines.push('State: world metadata ready, but gameplay snapshot is still loading.');
    return lines.join('\n');
  }

  const { game, selectedPlayerId } = props;
  const players = [...game.world.players.values()].sort((left, right) => left.id.localeCompare(right.id));
  lines.push(`Map: ${game.worldMap.width} x ${game.worldMap.height} tiles @ ${game.worldMap.tileDim}px`);
  lines.push(`Residents: ${players.length}`);
  lines.push(`Agent minds: ${game.world.agents.size}`);
  lines.push(`Active conversations: ${game.world.conversations.size}`);

  if (players.length === 0) {
    lines.push('Residents list: empty');
  } else {
    lines.push('Residents:');
    for (const player of players.slice(0, 12)) {
      const description = game.playerDescriptions.get(player.id);
      const conversation = game.world.playerConversation(player);
      const fragments = [`@ (${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)})`];

      if (player.activity?.description) {
        fragments.push(player.activity.description);
      } else if (player.pathfinding) {
        fragments.push('moving');
      } else {
        fragments.push('idle');
      }

      if (conversation) {
        fragments.push(`conversation ${conversation.id}`);
      }

      lines.push(`- ${description?.name ?? player.id} [${player.id}] ${fragments.join(' | ')}`);
    }

    if (players.length > 12) {
      lines.push(`- ... ${players.length - 12} more residents`);
    }
  }

  if (selectedPlayerId) {
    const selectedPlayer = game.world.players.get(selectedPlayerId);
    const description = selectedPlayerId && game.playerDescriptions.get(selectedPlayerId);
    lines.push('Selected resident:');
    if (!selectedPlayer) {
      lines.push(`- ${selectedPlayerId} is no longer present in the world.`);
    } else {
      lines.push(`- Name: ${description?.name ?? selectedPlayer.id}`);
      lines.push(`- Character: ${description?.character ?? 'unknown'}`);
      lines.push(`- Position: (${selectedPlayer.position.x.toFixed(1)}, ${selectedPlayer.position.y.toFixed(1)})`);
      lines.push(`- Activity: ${selectedPlayer.activity?.description ?? 'idle'}`);
      if (description?.description) {
        lines.push(`- Description: ${description.description}`);
      }
      const conversation = game.world.playerConversation(selectedPlayer);
      if (conversation) {
        lines.push(`- Conversation: ${conversation.id} with ${conversation.participants.size} participants`);
      }
    }
  }

  return lines.join('\n');
}
