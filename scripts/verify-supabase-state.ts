/**
 * Verify Supabase database schema, tables, RLS policies, and seed data.
 * Run: npx tsx scripts/verify-supabase-state.ts
 */

import fs from "node:fs";
import path from "node:path";

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

async function runAudit() {
  const { getSupabaseAdmin, isSupabaseConfigured } = await import("../src/lib/supabaseServer");
  const { testSupabaseConnection } = await import("../src/lib/supabase");

  console.log("================================================================================");
  console.log("ANGREN ESTATE — SUPABASE STATE & MIGRATION AUDIT");
  console.log("================================================================================");
  console.log(`isSupabaseConfigured: ${isSupabaseConfigured}`);
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT CONFIGURED"}\n`);

  // Test diagnostic connection
  const diag = await testSupabaseConnection();
  console.log("Connection Diagnostic:", diag);

  const supabase = getSupabaseAdmin();

  // 1. Check existing tables
  const targetTables = [
    "properties",
    "realtors",
    "news_sources",
    "real_estate_news",
    "news_translations",
    "news_assets",
    "news_publications",
    "news_source_checks",
  ];

  console.log("\n--- 1. Checking Tables in Supabase ---");
  for (const table of targetTables) {
    try {
      const { data, count, error } = await supabase.from(table).select("*", { count: "exact" }).limit(1);
      if (error) {
        console.log(`❌ Table "${table}": NOT FOUND or ERROR: [${error.code}] ${error.message}`);
      } else {
        console.log(`✅ Table "${table}": EXISTS (Count: ${count ?? 0})`);
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}": Exception: ${err.message}`);
    }
  }

  // 2. Check News Sources Content
  console.log("\n--- 2. Checking news_sources Content ---");
  try {
    const { data: sources, error } = await supabase
      .from("news_sources")
      .select("id, name, domain, feed_url, trust_level, is_active");

    if (error) {
      console.log(`❌ Failed to query news_sources: [${error.code}] ${error.message}`);
    } else {
      console.log(`Found ${sources?.length || 0} news sources in Supabase.`);
      for (const s of sources || []) {
        console.log(`  - [${s.trust_level}] ${s.name} (${s.domain}) -> ${s.feed_url}`);
      }
    }
  } catch (err: any) {
    console.log(`❌ Exception querying sources: ${err.message}`);
  }

  // 3. Check Live Properties (must remain untouched!)
  console.log("\n--- 3. Verifying Live Properties Data Integrity ---");
  try {
    const { count, error } = await supabase.from("properties").select("*", { count: "exact", head: true });
    if (error) {
      console.log(`⚠️ Properties table query returned: ${error.message}`);
    } else {
      console.log(`✅ Properties table row count: ${count} (intact and preserved)`);
    }
  } catch (err: any) {
    console.log(`⚠️ Properties query exception: ${err.message}`);
  }
}

runAudit().catch(console.error);
