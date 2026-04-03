import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactModal from 'react-modal';
import { ToastContainer } from 'react-toastify';
import { useMutation, useQuery } from 'convex/react';

import Game from './components/Game.tsx';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import helpImg from '../assets/help.svg';
import { api } from '../convex/_generated/api';
import { runtimeConfig, runtimeSummary } from './runtimeConfig';
import {
  backgroundImageVariants,
  districts,
  type PocketWorldsBackdrop,
} from '../data/pocketWorldsTownScene.ts';

type TokenGrant = {
  amount: number;
  reason: string;
};

type BackdropSelection = 'auto' | PocketWorldsBackdrop;

const backdropLabels: Record<BackdropSelection, string> = {
  auto: 'Live',
  verdant: 'Verdant',
  autumn: 'Harvest',
  winter: 'Snow',
  night: 'Night',
  winterNight: 'Frost Night',
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export default function Home() {
  const [backdropSelection, setBackdropSelection] = useState<BackdropSelection>('auto');
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [focusDistrictId, setFocusDistrictId] = useState<string | null>('old-square');
  const [godTokens, setGodTokens] = useState(0);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [latestGrant, setLatestGrant] = useState<TokenGrant>();
  const hideTimerRef = useRef<number>();
  const hudVisibleRef = useRef(hudVisible);

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const stopAllowed = useQuery(api.testing.stopAllowed) ?? false;
  const freeze = useMutation(api.testing.stop);
  const resume = useMutation(api.testing.resume);

  const frozen = worldStatus?.status === 'stoppedByDeveloper';
  const backendSummary = useMemo(() => runtimeSummary(runtimeConfig), []);
  const worldStateLabel = worldStatus?.status ?? 'booting';
  const selectedDistrict = useMemo(
    () => districts.find((district) => district.id === focusDistrictId) ?? districts[1],
    [focusDistrictId],
  );
  const activeBackdrop = useMemo(
    () => resolveBackdrop(backdropSelection, new Date(clockTick)),
    [backdropSelection, clockTick],
  );

  const clearHudTimer = useCallback(() => {
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const noteHudActivity = useCallback(() => {
    if (!hudVisibleRef.current || helpModalOpen) {
      return;
    }

    clearHudTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHudVisible(false);
    }, 30_000);
  }, [clearHudTimer, helpModalOpen]);

  const revealHud = useCallback(() => {
    setHudVisible(true);
  }, []);

  const focusDistrict = useCallback((districtId: string) => {
    setFocusDistrictId(districtId);
    setHudVisible(true);
  }, []);

  const togglePause = useCallback(async () => {
    if (!stopAllowed) {
      console.info('Pocket Worlds cannot toggle pause because the backend disabled that control.');
      return;
    }
    if (frozen) {
      await resume();
      return;
    }
    await freeze();
  }, [freeze, frozen, resume, stopAllowed]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockTick(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    hudVisibleRef.current = hudVisible;
  }, [hudVisible]);

  useEffect(() => {
    if (!hudVisible || helpModalOpen) {
      clearHudTimer();
      return;
    }

    noteHudActivity();
    return clearHudTimer;
  }, [clearHudTimer, helpModalOpen, hudVisible, noteHudActivity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setHudVisible((current) => !current);
        return;
      }

      if (hudVisibleRef.current) {
        noteHudActivity();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (hudVisibleRef.current && event.pointerType !== 'touch') {
        noteHudActivity();
      }
    };

    const onPointerDown = () => {
      if (hudVisibleRef.current) {
        noteHudActivity();
      }
    };

    const onWheel = () => {
      if (hudVisibleRef.current) {
        noteHudActivity();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('wheel', onWheel);
    };
  }, [noteHudActivity]);

  useEffect(() => {
    window.advanceTime = (ms: number) => {
      console.info(
        `advanceTime(${ms}) is not exposed in the Convex-backed runtime. Time advances on the backend engine.`,
      );
    };

    window.PocketWorldsBridge = {
      grantTokens: (count: number, reason = 'Native StoreKit credit') => {
        const safeCount = Math.max(0, Math.floor(count));
        if (safeCount <= 0) {
          return;
        }
        setGodTokens((current) => current + safeCount);
        setLatestGrant({ amount: safeCount, reason });
        setHudVisible(true);
      },
      getSnapshot: () =>
        window.render_game_to_text?.() ??
        'Pocket Worlds AI Town\nSnapshot unavailable while the runtime is still booting.',
      advanceDays: (days: number) => {
        console.info(
          `advanceDays(${days}) is not wired for the live AI Town backend. Use backend debug controls instead.`,
        );
      },
      applyIntervention: (key: string) => {
        const normalized = key.trim().toLowerCase();
        if (['freeze', 'resume', 'toggle-pause', 'pause-town'].includes(normalized) && stopAllowed) {
          void togglePause();
          return true;
        }
        console.info(`Pocket Worlds has no mapped intervention for "${key}" in the AI Town bridge.`);
        return false;
      },
      togglePause: () => {
        void togglePause();
      },
      requestCitizenMind: () => {
        console.info(
          'Citizen planning runs inside the Convex backend. There is no direct client-side trigger exposed here.',
        );
      },
    };

    return () => {
      delete window.advanceTime;
      delete window.PocketWorldsBridge;
    };
  }, [stopAllowed, togglePause]);

  return (
    <main className="fixed inset-0 overflow-hidden font-body text-white">
      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="Help modal"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-5xl font-bold font-display game-title">Pocket Worlds</h1>
          <p className="mt-5">
            The town now occupies the full screen. Use the world itself as the main interface, and
            summon the HUD only when you need controls or context.
          </p>
          <h2 className="mt-5 text-3xl">Controls</h2>
          <p className="mt-3">Press Space on Mac to show or hide the town HUD.</p>
          <p className="mt-3">
            On touch screens, tap the world to bring the HUD back. It automatically fades again
            after 30 seconds of inactivity.
          </p>
          <p className="mt-3">
            Drag to pan the town, scroll or pinch to zoom, and use the district shortcuts to jump
            directly into the most active parts of the map.
          </p>
          <h2 className="mt-5 text-3xl">Spectating</h2>
          <p className="mt-3">
            Click any resident to reveal their details panel. The panel tracks their recent activity,
            archived chats, and whether they are already involved in a live conversation.
          </p>
        </div>
      </ReactModal>

      <Game
        backdropMode={activeBackdrop}
        focusDistrictId={focusDistrictId}
        hudVisible={hudVisible}
        onHudActivity={noteHudActivity}
        onHudReveal={revealHud}
      />

      {hudVisible ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="pointer-events-auto w-full max-w-[360px] space-y-3">
              <section className="rounded-[28px] border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.28em] text-stone-300">
                  Pocket Worlds
                </div>
                <h1 className="mt-2 font-display text-4xl leading-none game-title">
                  Full Town View
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-100">
                  Space or tap summons this HUD. Leave it alone for 30 seconds and the world takes
                  over again.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <OverlayPill label="Backend" value={runtimeConfig.convexUrl ? 'Connected' : 'Missing'} />
                  <OverlayPill label="World" value={worldStateLabel} />
                  <OverlayPill label="GØD" value={`${godTokens}`} />
                  <OverlayPill label="Scene" value={backdropLabels[activeBackdrop]} />
                </div>
                {latestGrant && (
                  <p className="mt-3 text-xs leading-relaxed text-amber-200">
                    Latest grant: +{latestGrant.amount} GØD Tokens. {latestGrant.reason}
                  </p>
                )}
              </section>

              <section className="rounded-[28px] border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.28em] text-stone-300">
                  District Focus
                </div>
                <p className="mt-2 text-sm text-stone-100">{selectedDistrict.description}</p>
                <div className="mt-3 space-y-2">
                  {districts.map((district) => (
                    <button
                      key={district.id}
                      className={
                        'w-full rounded-2xl border px-4 py-3 text-left transition ' +
                        (district.id === focusDistrictId
                          ? 'border-amber-300/70 bg-amber-300/20 text-white'
                          : 'border-white/10 bg-white/5 text-stone-100 hover:bg-white/10')
                      }
                      onClick={() => {
                        focusDistrict(district.id);
                        noteHudActivity();
                      }}
                    >
                      <div className="text-sm font-semibold uppercase tracking-[0.16em]">
                        {district.label}
                      </div>
                      <div className="mt-1 text-xs text-stone-300">{district.description}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.28em] text-stone-300">
                  World Mood
                </div>
                <p className="mt-2 text-sm text-stone-100">
                  Auto follows your local season and time. Manual modes let you lock the town to a
                  specific look.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['auto', ...Object.keys(backgroundImageVariants)] as BackdropSelection[]).map((mode) => (
                    <button
                      key={mode}
                      className={
                        'rounded-2xl border px-3 py-3 text-left text-sm font-semibold uppercase tracking-[0.14em] transition ' +
                        (mode === backdropSelection
                          ? 'border-sky-300/70 bg-sky-300/20 text-white'
                          : 'border-white/10 bg-white/5 text-stone-100 hover:bg-white/10')
                      }
                      onClick={() => {
                        setBackdropSelection(mode);
                        noteHudActivity();
                      }}
                    >
                      {backdropLabels[mode]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/15 bg-black/55 p-4 shadow-2xl backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.28em] text-stone-300">
                  Town Actions
                </div>
                <p className="mt-2 text-sm text-stone-100">
                  Join the town, pause the simulation, or open help without covering the resident
                  panel.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <InteractButton />
                  <FreezeButton />
                  <MusicButton />
                  <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
                    Help
                  </Button>
                </div>
              </section>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-col items-start gap-2 text-xs text-stone-200 sm:items-end sm:text-right">
            <div>{backendSummary}</div>
            <div>Drag to roam, zoom to inspect, click a resident to open their story.</div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <div className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-center text-xs uppercase tracking-[0.24em] text-stone-100 shadow-xl backdrop-blur-md">
            Space or tap for town controls
          </div>
        </div>
      )}

      <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
    </main>
  );
}

function resolveBackdrop(selection: BackdropSelection, now: Date): PocketWorldsBackdrop {
  if (selection !== 'auto') {
    return selection;
  }

  const month = now.getMonth();
  const hour = now.getHours();
  const winter = month === 11 || month <= 1;
  const autumn = month >= 8 && month <= 10;
  const night = hour < 6 || hour >= 20;

  if (winter && night) {
    return 'winterNight';
  }
  if (night) {
    return 'night';
  }
  if (winter) {
    return 'winter';
  }
  if (autumn) {
    return 'autumn';
  }
  return 'verdant';
}

function OverlayPill(props: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-stone-100">
      <span className="text-stone-300">{props.label}:</span> {props.value}
    </div>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 78%)',
    zIndex: 30,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(720px, 92vw)',
    maxHeight: '80vh',
    overflow: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    background: 'rgba(18, 18, 21, 0.96)',
    color: 'white',
    fontFamily: '"VCR OSD Mono", "sans-serif"',
    boxShadow: '0 32px 80px rgba(0, 0, 0, 0.5)',
  },
};
