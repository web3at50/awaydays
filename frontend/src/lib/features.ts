// Which optional integrations this installation has keys for. Server-only
// (reads secret env vars); pages use these to hide UI that could never
// work here rather than showing buttons that fail.

/** Research search on the plan page (Vercel AI Gateway). */
export function planSearchEnabled(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

/** Tripadvisor ratings on saved ideas (Terra API). */
export function tripadvisorEnabled(): boolean {
  return Boolean(process.env.TRIPADVISOR_API_KEY);
}
