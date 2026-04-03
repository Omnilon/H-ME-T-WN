type PocketWorldsRuntimeConfig = {
  convexUrl?: string;
  citizenMindEndpoint?: string;
};

function cleanString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveRuntimeConfig(): PocketWorldsRuntimeConfig {
  return {
    convexUrl:
      cleanString(window.PocketWorldsConfig?.convexUrl) ?? cleanString(import.meta.env.VITE_CONVEX_URL),
    citizenMindEndpoint: cleanString(window.PocketWorldsConfig?.citizenMindEndpoint),
  };
}

export const runtimeConfig = resolveRuntimeConfig();

export function runtimeSummary(config: PocketWorldsRuntimeConfig): string {
  const backend = config.convexUrl
    ? `Convex deployment: ${config.convexUrl}`
    : 'Convex deployment missing. Set PocketWorldsConfig.convexUrl or VITE_CONVEX_URL.';

  if (!config.citizenMindEndpoint) {
    return backend;
  }

  return `${backend} Citizen relay override: ${config.citizenMindEndpoint}`;
}
