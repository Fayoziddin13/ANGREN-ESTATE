/**
 * The monetization DEMO exists only on a developer's computer: never in a
 * production build and never on Vercel (production or preview).
 */
export function demoModeAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL === "1" || env.VERCEL_ENV) return false;
  return true;
}
