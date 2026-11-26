/**
 * Guards that keep local development, tests and the Mock payment provider away from
 * the production database.
 *
 * Anything that writes test data (tests, seeds, mock payments, migration helpers)
 * must call `assertTestDb()` first. It fails closed: only an allow-listed test
 * project passes, so an unknown or mistyped project is refused as well as production.
 *
 * `next dev` has its own guard in next.config.mjs (it refuses to start against
 * production unless ALLOW_PRODUCTION_DB_IN_DEV=1).
 */

export const PRODUCTION_SUPABASE_REF = "gemozzkmoogjxtdwvepz";

/** Supabase projects that tests, seeds and the Mock payment provider may use. */
export const TEST_SUPABASE_REFS: readonly string[] = ["lesaumhlzjagrcfvjqqf"]; // angren-estate-test

type Env = Record<string, string | undefined>;

/** Env vars that can point at a Supabase project. */
const DB_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL"] as const;

export class ProductionDatabaseError extends Error {
  constructor(context: string) {
    super(
      `[safety] Refusing to run "${context}": the configured database is the PRODUCTION Supabase project (${PRODUCTION_SUPABASE_REF}). ` +
        "Point NEXT_PUBLIC_SUPABASE_URL / DATABASE_URL at the test project (.env.development.local / .env.test.local)."
    );
    this.name = "ProductionDatabaseError";
  }
}

/** True when any database-related env var references the production project. */
export function pointsAtProductionDb(env: Env = process.env): boolean {
  return DB_ENV_KEYS.some((key) => (env[key] || "").toLowerCase().includes(PRODUCTION_SUPABASE_REF));
}

/** Project ref of NEXT_PUBLIC_SUPABASE_URL (e.g. "abcd1234" for https://abcd1234.supabase.co). */
export function supabaseRef(env: Env = process.env): string | null {
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "").host.toLowerCase();
    return host.endsWith(".supabase.co") ? host.split(".")[0] : null;
  } catch {
    return null;
  }
}

/** True only for an allow-listed test project, with no production reference in any DB variable. */
export function isAllowedTestDb(env: Env = process.env): boolean {
  const ref = supabaseRef(env);
  return ref !== null && TEST_SUPABASE_REFS.includes(ref) && !pointsAtProductionDb(env);
}

/** Throws unless an allow-listed test Supabase project is configured. */
export function assertTestDb(context: string, env: Env = process.env): void {
  if (pointsAtProductionDb(env)) throw new ProductionDatabaseError(context);
  const ref = supabaseRef(env);
  if (!ref) {
    throw new Error(`[safety] Refusing to run "${context}": no test Supabase project is configured.`);
  }
  if (!TEST_SUPABASE_REFS.includes(ref)) {
    throw new Error(
      `[safety] Refusing to run "${context}": Supabase project "${ref}" is not an allow-listed test project.`
    );
  }
}

/**
 * The Mock payment provider may only run on a developer machine against the test
 * project. It is refused on Vercel (production and preview), in production builds,
 * without the explicit MOCK_PAYMENTS=1 opt-in, and for any database that is not an
 * allow-listed test project.
 */
export function mockPaymentsAllowed(env: Env = process.env): { allowed: boolean; reason?: string } {
  if (env.VERCEL || env.VERCEL_ENV) return { allowed: false, reason: "running on Vercel" };
  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "test") {
    return { allowed: false, reason: `NODE_ENV is ${env.NODE_ENV || "unset"}` };
  }
  if (env.MOCK_PAYMENTS !== "1") return { allowed: false, reason: "MOCK_PAYMENTS is not 1" };
  if (pointsAtProductionDb(env)) return { allowed: false, reason: "database is production" };
  if (!isAllowedTestDb(env)) return { allowed: false, reason: "database is not an allow-listed test project" };
  return { allowed: true };
}
