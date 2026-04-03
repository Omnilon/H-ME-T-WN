import { runtimeConfig, runtimeSummary } from '../runtimeConfig';

export default function RuntimeBootstrapScreen() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12 font-body game-background text-white">
      <div className="box max-w-3xl p-8">
        <h1 className="bg-brown-700 p-2 text-center font-display text-5xl tracking-wider shadow-solid game-title">
          Pocket Worlds
        </h1>
        <p className="mt-6 text-lg leading-relaxed">
          The imported AI Town frontend is bundled correctly, but it cannot connect to a live town
          until a Convex deployment URL is injected.
        </p>
        <p className="mt-4 text-sm text-stone-200">{runtimeSummary(runtimeConfig)}</p>
        <div className="mt-6 space-y-2 text-sm text-stone-200">
          <p>Configure one of the following before launching this build:</p>
          <p>`window.PocketWorldsConfig.convexUrl` from the native shell</p>
          <p>`VITE_CONVEX_URL` for local browser development</p>
        </div>
      </div>
    </main>
  );
}
