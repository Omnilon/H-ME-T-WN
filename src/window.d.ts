export {};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    PocketWorldsConfig?: {
      convexUrl?: string;
      citizenMindEndpoint?: string;
    };
    PocketWorldsBridge?: {
      grantTokens: (count: number, reason?: string) => void;
      getSnapshot: () => string;
      advanceDays: (days: number) => void;
      applyIntervention: (key: string) => boolean;
      togglePause: () => void;
      requestCitizenMind: () => void;
    };
  }
}
