import { describe, it, expect } from "vitest";
import {
  assertTestDb,
  isAllowedTestDb,
  mockPaymentsAllowed,
  pointsAtProductionDb,
  ProductionDatabaseError,
  PRODUCTION_SUPABASE_REF,
  TEST_SUPABASE_REFS,
} from "@/lib/env/safety";

const PROD_URL = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;
const TEST_URL = `https://${TEST_SUPABASE_REFS[0]}.supabase.co`;
const UNKNOWN_URL = "https://someotherproject1.supabase.co";

describe("production database guard", () => {
  it("detects production in any database variable", () => {
    expect(pointsAtProductionDb({ NEXT_PUBLIC_SUPABASE_URL: PROD_URL })).toBe(true);
    expect(pointsAtProductionDb({ SUPABASE_URL: PROD_URL })).toBe(true);
    expect(
      pointsAtProductionDb({ DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:x@host:6543/postgres` })
    ).toBe(true);
    expect(pointsAtProductionDb({ NEXT_PUBLIC_SUPABASE_URL: PROD_URL.toUpperCase() })).toBe(true);
    expect(pointsAtProductionDb({ NEXT_PUBLIC_SUPABASE_URL: TEST_URL })).toBe(false);
  });

  it("throws for production, even when only DATABASE_URL is production", () => {
    expect(() => assertTestDb("x", { NEXT_PUBLIC_SUPABASE_URL: PROD_URL })).toThrow(ProductionDatabaseError);
    expect(() =>
      assertTestDb("x", { NEXT_PUBLIC_SUPABASE_URL: TEST_URL, DATABASE_URL: `db.${PRODUCTION_SUPABASE_REF}.supabase.co` })
    ).toThrow(ProductionDatabaseError);
  });

  it("throws when no database is configured", () => {
    expect(() => assertTestDb("x", {})).toThrow(/no test Supabase project/);
  });

  it("fails closed for a project that is not allow-listed", () => {
    expect(() => assertTestDb("x", { NEXT_PUBLIC_SUPABASE_URL: UNKNOWN_URL })).toThrow(/not an allow-listed/);
    expect(isAllowedTestDb({ NEXT_PUBLIC_SUPABASE_URL: UNKNOWN_URL })).toBe(false);
  });

  it("passes only for the allow-listed test project", () => {
    expect(() => assertTestDb("x", { NEXT_PUBLIC_SUPABASE_URL: TEST_URL })).not.toThrow();
    expect(isAllowedTestDb({ NEXT_PUBLIC_SUPABASE_URL: TEST_URL })).toBe(true);
  });

  it("the production project is never on the allow-list", () => {
    expect(TEST_SUPABASE_REFS).not.toContain(PRODUCTION_SUPABASE_REF);
  });

  it("test runs never inherit production variables", () => {
    expect(pointsAtProductionDb(process.env)).toBe(false);
  });
});

describe("mock payments switch", () => {
  const ok = { NODE_ENV: "development", MOCK_PAYMENTS: "1", NEXT_PUBLIC_SUPABASE_URL: TEST_URL };

  it("allowed only locally, opted in, against the test project", () => {
    expect(mockPaymentsAllowed(ok).allowed).toBe(true);
  });
  it("refused in production builds", () => {
    expect(mockPaymentsAllowed({ ...ok, NODE_ENV: "production" }).allowed).toBe(false);
  });
  it("refused on Vercel (production and preview)", () => {
    expect(mockPaymentsAllowed({ ...ok, VERCEL: "1" }).allowed).toBe(false);
    expect(mockPaymentsAllowed({ ...ok, VERCEL_ENV: "preview" }).allowed).toBe(false);
  });
  it("refused without the explicit opt-in", () => {
    expect(mockPaymentsAllowed({ ...ok, MOCK_PAYMENTS: undefined }).allowed).toBe(false);
  });
  it("refused against the production database", () => {
    expect(mockPaymentsAllowed({ ...ok, NEXT_PUBLIC_SUPABASE_URL: PROD_URL }).allowed).toBe(false);
  });
  it("refused against a project that is not allow-listed", () => {
    expect(mockPaymentsAllowed({ ...ok, NEXT_PUBLIC_SUPABASE_URL: UNKNOWN_URL }).allowed).toBe(false);
  });
});
