// Lightweight error logger. Vercel captures console.error into the function
// logs / observability, so failures in background work are no longer silent.
// Swap the body for Sentry etc. later without touching call sites.
export function logError(context: string, err: unknown) {
  const detail = err instanceof Error ? (err.stack || err.message) : JSON.stringify(err)
  console.error(`[GoldPoints] ${context} —`, detail)
}
