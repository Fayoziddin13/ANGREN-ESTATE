/**
 * Multi-trial Concurrent Race Condition Test for PATCH /api/admin/content
 *
 * Runs 5 independent concurrency trials.
 * In each trial:
 * 1. Read current expected_updated_at.
 * 2. Send Request A and Request B concurrently using Promise.all with the EXACT same expected_updated_at.
 * 3. Inspect results.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const BASE_URL = "http://localhost:3000";

function makeAdminToken() {
  const secret = env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is required to generate admin token");
  const payload = {
    id: "admin-primary-1",
    username: "admin",
    email: "admin@angrenestate.uz",
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    rememberMe: true,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
  return `${payloadStr}.${sig}`;
}

async function runTrial(trialIndex, headers) {
  // 1. Fetch current canonical state from database
  const { data: initialRow, error: initialErr } = await supabaseAdmin
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", "cms_announcement")
    .single();

  if (initialErr || !initialRow) {
    throw new Error("Failed to read initial cms_announcement: " + initialErr?.message);
  }

  const initialUpdatedAt = initialRow.updated_at;

  // 2. Prepare two distinct concurrent requests with the EXACT same expected_updated_at
  const idA = `TRIAL_${trialIndex}_REQ_A_${Date.now()}`;
  const idB = `TRIAL_${trialIndex}_REQ_B_${Date.now()}`;

  const payloadA = {
    section: "announcement",
    data: {
      is_active: true,
      text_uz: idA,
      text_ru: idA + "_RU",
    },
    expected_updated_at: initialUpdatedAt,
  };

  const payloadB = {
    section: "announcement",
    data: {
      is_active: true,
      text_uz: idB,
      text_ru: idB + "_RU",
    },
    expected_updated_at: initialUpdatedAt,
  };

  const [resA, resB] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/content`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payloadA),
    }),
    fetch(`${BASE_URL}/api/admin/content`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payloadB),
    }),
  ]);

  const jsonA = await resA.json();
  const jsonB = await resB.json();

  // 3. Inspect final database value
  const { data: finalRow } = await supabaseAdmin
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", "cms_announcement")
    .single();

  const finalUz = finalRow.value?.text_uz;
  const isWinnerA = finalUz === idA;
  const isWinnerB = finalUz === idB;

  console.log(`Trial ${trialIndex}:`);
  console.log(`  - Status A: ${resA.status} (Success: ${jsonA.success}, Error: ${jsonA.error || "none"})`);
  console.log(`  - Status B: ${resB.status} (Success: ${jsonB.success}, Error: ${jsonB.error || "none"})`);
  console.log(`  - Winner in DB: ${isWinnerA ? "Request A" : isWinnerB ? "Request B" : "Unknown ('" + finalUz + "')"}`);

  return {
    statusA: resA.status,
    statusB: resB.status,
    both200: resA.status === 200 && resB.status === 200,
    one200one409:
      (resA.status === 200 && resB.status === 409) ||
      (resA.status === 409 && resB.status === 200),
    winner: isWinnerA ? "A" : isWinnerB ? "B" : "OTHER",
  };
}

async function runAllTrials() {
  console.log("========================================================================");
  console.log("  TESTING REAL CONCURRENT RACE CONDITION (5 TRIALS)                     ");
  console.log("========================================================================\n");

  const adminToken = makeAdminToken();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
    Cookie: `angren_admin_token=${adminToken}`,
  };

  // Backup initial
  const { data: backupRow } = await supabaseAdmin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "cms_announcement")
    .single();

  const trialResults = [];

  try {
    for (let i = 1; i <= 5; i++) {
      const res = await runTrial(i, headers);
      trialResults.push(res);
      // Brief pause between trials
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    // Restore backup
    if (backupRow) {
      await supabaseAdmin.from("app_settings").upsert({
        key: "cms_announcement",
        value: backupRow.value,
        updated_at: backupRow.updated_at,
      });
      console.log("\nRestored original database announcement state.");
    }
  }

  const raceDetected = trialResults.some((t) => t.both200);
  const allAtomic = trialResults.every((t) => t.one200one409);

  console.log("\n========================================================================");
  console.log("  CONCURRENCY TEST SUMMARY:");
  console.log(`  Total Trials: ${trialResults.length}`);
  console.log(`  Atomic (one 200, one 409): ${trialResults.filter((t) => t.one200one409).length}`);
  console.log(`  Race Condition (both 200): ${trialResults.filter((t) => t.both200).length}`);
  console.log("========================================================================");

  if (raceDetected) {
    console.error("\n>>> RACE CONDITION DETECTED! Both concurrent requests succeeded! <<<");
    process.exit(2);
  } else if (allAtomic) {
    console.log("\n>>> ALL 5 CONCURRENT TRIALS CONFIRMED ATOMIC (1x 200, 1x 409)! <<<");
    process.exit(0);
  } else {
    console.warn("\n>>> Unexpected test outcomes occurred. <<<");
    process.exit(1);
  }
}

runAllTrials();
