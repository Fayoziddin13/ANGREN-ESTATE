/**
 * Test environment bootstrap.
 *
 * 1. Drops every database/secret variable inherited from the shell, so nothing from
 *    .env.local (production) can leak into a test run.
 * 2. Loads ONLY .env.test.local (test Supabase project) when it exists.
 * 3. Refuses to continue unless that file points at an allow-listed test project.
 *
 * Integration tests that need the database check `process.env.TEST_DATABASE === "1"`
 * and skip otherwise.
 */
import fs from "fs";
import path from "path";
import { assertTestDb } from "../../src/lib/env/safety";

const SENSITIVE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "ADMIN_JWT_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MOCK_PAYMENTS",
  "ALLOW_PRODUCTION_DB_IN_DEV",
  "VERCEL",
  "VERCEL_ENV",
];
for (const key of SENSITIVE) delete process.env[key];

const testEnvFile = path.resolve(__dirname, "../../.env.test.local");
if (fs.existsSync(testEnvFile)) {
  for (const line of fs.readFileSync(testEnvFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  assertTestDb("test run (.env.test.local)");
  // Database tests run only once the test project's service key has been filled in.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.TEST_DATABASE = "1";
}
