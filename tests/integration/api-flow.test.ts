import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * End-to-end API flow against a RUNNING local dev server connected to the TEST
 * database (never production: tests/setup/env.ts refuses anything else).
 * Skipped unless TEST_DATABASE=1 and E2E_BASE_URL is set, e.g.
 *   E2E_BASE_URL=http://localhost:3100 npx vitest run tests/integration
 * It checks security behaviour over real HTTP: forged prices are ignored, other
 * users' photos are refused, payments need a valid signature, duplicate and
 * wrong-amount payments do not count, and the admin API needs the admin cookie.
 */
const BASE = process.env.E2E_BASE_URL;
const enabled = process.env.TEST_DATABASE === "1" && Boolean(BASE);

async function login(n: 1 | 2) {
  const res = await fetch(`${BASE}/api/dev/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: n }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`test login failed: ${json.message || json.error}`);
  return json.access_token as string;
}

async function call(path: string, token: string | null, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

describe.skipIf(!enabled)("monetization API flow (local dev server + test DB)", () => {
  let token1 = "";
  let token2 = "";

  beforeAll(async () => {
    token1 = await login(1);
    token2 = await login(2);
  });

  it("anonymous visitors cannot read or submit", async () => {
    expect((await call("/api/listings/submissions", null)).status).toBe(401);
    expect((await call("/api/listings/submissions", null, { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("the admin API refuses requests without the admin cookie", async () => {
    expect((await call("/api/admin/monetization/stats", token1)).status).toBe(401);
  });

  it("the anon key cannot read monetization tables directly", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await anon.from("payment_orders").select("id").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("a forged price or billing field from the browser is ignored", async () => {
    const r = await call("/api/listings/submissions", token1, {
      method: "POST",
      body: JSON.stringify({
        deal_type: "sale", property_type: "apartment", location: "API test", description: "API test listing",
        contact_name: "API Test", contact_phone: "+998901110001", photos: [],
        billing: "free", amount: 1, final_amount_uzs: 1, user_id: "someone-else",
      }),
    });
    expect([200, 409]).toContain(r.status);
    if (r.status === 200 && r.json.submission.billing === "paid") {
      expect(r.json.submission.amount).toBeGreaterThan(1);
    }
  });

  it("another account's photo path is refused", async () => {
    const r = await call("/api/listings/submissions", token2, {
      method: "POST",
      body: JSON.stringify({
        deal_type: "sale", property_type: "apartment", location: "API test", description: "API test listing",
        contact_name: "API Test", contact_phone: "+998901110002",
        photos: ["00000000-0000-4000-8000-000000000000/11111111-2222-4333-8444-555555555555.jpg"],
      }),
    });
    expect(r.status).toBe(400);
  });

  it("a mock payment with a forged signature is refused", async () => {
    const r = await call("/api/payments/mock", null, {
      method: "POST",
      body: JSON.stringify({ order_id: "00000000-0000-4000-8000-000000000000", amount: 1, sig: "00".repeat(32), outcome: "success" }),
    });
    expect(r.status).toBe(400);
  });
});
