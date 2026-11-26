import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { pathToFileURL } from "url";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";

type ConfigFactory = (phase: string) => { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };

const configUrl = pathToFileURL(path.resolve(__dirname, "../../next.config.mjs")).href;
const loadConfig = async (): Promise<ConfigFactory> => (await import(/* @vite-ignore */ configUrl)).default;

const PROD_URL = "https://gemozzkmoogjxtdwvepz.supabase.co";
const TEST_URL = "https://lesaumhlzjagrcfvjqqf.supabase.co";
const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "ALLOW_PRODUCTION_DB_IN_DEV"];

describe("next.config.mjs: next dev refuses the production database", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("throws for next dev when the Supabase URL is production", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    const config = await loadConfig();
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).toThrow(/PRODUCTION/);
  });

  it("also catches a production DATABASE_URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_URL;
    process.env.DATABASE_URL = "postgresql://postgres.gemozzkmoogjxtdwvepz:x@pooler.supabase.com:6543/postgres";
    const config = await loadConfig();
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).toThrow(/PRODUCTION/);
  });

  it("allows production in next dev only with the explicit override", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    process.env.ALLOW_PRODUCTION_DB_IN_DEV = "1";
    const config = await loadConfig();
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  });

  it("allows next dev with the test project or with no database", async () => {
    const config = await loadConfig();
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_URL;
    expect(() => config(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  });

  it("never blocks production builds or the production server", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    const config = await loadConfig();
    expect(() => config(PHASE_PRODUCTION_BUILD)).not.toThrow();
    expect(() => config(PHASE_PRODUCTION_SERVER)).not.toThrow();
  });

  it("keeps the production CSP Supabase hosts unchanged", async () => {
    const config = await loadConfig();
    const rules = await config(PHASE_PRODUCTION_SERVER).headers();
    const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")?.value || "";
    expect(csp).toContain("https://gemozzkmoogjxtdwvepz.supabase.co");
    expect(csp).toContain("wss://gemozzkmoogjxtdwvepz.supabase.co");
    // The module is first evaluated with the production URL (first test) or with no URL
    // at all, so no other Supabase project may appear in the policy.
    expect(csp.match(/[a-z0-9]{20}\.supabase\.co/g)?.every((h) => h.startsWith("gemozzkmoogjxtdwvepz"))).toBe(true);
  });
});
