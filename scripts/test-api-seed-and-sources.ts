/**
 * Test API route: POST /api/admin/social/sources with action: "seed_defaults"
 * Run: npx tsx scripts/test-api-seed-and-sources.ts
 */

import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

async function runApiTest() {
  const { POST } = await import("../src/app/api/admin/social/sources/route");
  const { createAdminSessionToken } = await import("../src/lib/admin-auth");

  console.log("================================================================================");
  console.log("TESTING «RASMIY MANBALARNI TO‘LDIRISH» API & REPOSITORY BEHAVIOR");
  console.log("================================================================================\n");

  const adminToken = createAdminSessionToken("admin", "admin@angrenestate.uz", true);

  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  // 1. First Seed Invocation
  console.log("--- 1. Testing First Seed Run (action: seed_defaults) ---");
  const req1 = new NextRequest("http://localhost:3000/api/admin/social/sources", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "seed_defaults" }),
  });

  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.log(`HTTP ${res1.status}:`, data1.message || data1.error);
  console.log(`Result: added=${data1.result?.added}, total=${data1.result?.total}`);

  // 2. Second Seed Invocation (Idempotency Test)
  console.log("\n--- 2. Testing Second Seed Run (Must be Idempotent) ---");
  const req2 = new NextRequest("http://localhost:3000/api/admin/social/sources", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ action: "seed_defaults" }),
  });

  const res2 = await POST(req2);
  const data2 = await res2.json();
  console.log(`HTTP ${res2.status}:`, data2.message || data2.error);
  console.log(`Result: added=${data2.result?.added}, total=${data2.result?.total}`);

  if (data2.result?.added === 0) {
    console.log("✅ PASSED: Second run added 0 duplicates! Fully idempotent.");
  } else {
    console.error("❌ FAILED: Second run created duplicate sources!");
    process.exit(1);
  }

  // 3. Duplicate Prevention Test
  console.log("\n--- 3. Testing Duplicate Source Prevention ---");
  const reqDuplicate = new NextRequest("http://localhost:3000/api/admin/social/sources", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Lex duplicate test",
      domain: "lex.uz",
      feed_url: "https://lex.uz/rss",
    }),
  });

  const resDuplicate = await POST(reqDuplicate);
  const dataDuplicate = await resDuplicate.json();
  console.log(`Duplicate add status: HTTP ${resDuplicate.status}`);
  if (resDuplicate.status === 409) {
    console.log(`✅ PASSED: Correctly rejected duplicate with HTTP 409: "${dataDuplicate.error}"`);
  } else {
    console.error("❌ FAILED: Did not return HTTP 409 on duplicate feed URL");
    process.exit(1);
  }

  // 4. SSRF Defense Test in API Route
  console.log("\n--- 4. Testing SSRF Defense in API Route ---");
  const reqSsrf = new NextRequest("http://localhost:3000/api/admin/social/sources", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Malicious internal test",
      domain: "localhost",
      feed_url: "http://127.0.0.1:8080/admin/secrets.xml",
    }),
  });

  const resSsrf = await POST(reqSsrf);
  const dataSsrf = await resSsrf.json();
  console.log(`SSRF attempt status: HTTP ${resSsrf.status}`);
  if (resSsrf.status === 400 && dataSsrf.error?.includes("Ichki tarmoq")) {
    console.log(`✅ PASSED: Correctly blocked SSRF with HTTP 400: "${dataSsrf.error}"`);
  } else {
    console.error("❌ FAILED: SSRF was not blocked by API endpoint!");
    process.exit(1);
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL API & SEEDING TESTS PASSED!");
  console.log("================================================================================");
}

runApiTest().catch(console.error);
