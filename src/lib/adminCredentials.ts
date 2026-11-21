import crypto from "crypto";
import { promisify } from "util";
import { supabaseAdmin, isSupabaseConfigured } from "./supabaseServer";
import { adminIdentityMatches, getAdminIdentity, verifyEnvAdminPassword } from "./admin-auth";

/**
 * Admin password set from the admin panel ("Изменить пароль").
 *
 * Stored server-side only, in app_settings under a private key: the public RLS
 * policy exposes just `cms_*` and `site_settings`, and every API route reads
 * app_settings by explicit key, so this row never reaches a browser.
 *
 * While the row exists it is the only valid admin password (ADMIN_PASSWORD
 * stops working). Deleting the row in Supabase restores ADMIN_PASSWORD — the
 * recovery path if the new password is lost.
 */
export const ADMIN_CREDENTIALS_KEY = "admin_credentials";

const pbkdf2 = promisify(crypto.pbkdf2);
const ITERATIONS = 210_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

interface StoredAdminCredential {
  v: 1;
  algo: "pbkdf2-sha512";
  iterations: number;
  salt: string;
  hash: string;
  changed_at: string;
}

export type AdminCredentialLookup =
  | { status: "none" }
  | { status: "set"; record: StoredAdminCredential }
  | { status: "error" };

function isStoredCredential(value: unknown): value is StoredAdminCredential {
  const v = value as StoredAdminCredential | null;
  return (
    !!v &&
    v.v === 1 &&
    v.algo === "pbkdf2-sha512" &&
    typeof v.iterations === "number" &&
    v.iterations >= 100_000 &&
    typeof v.salt === "string" &&
    /^[0-9a-f]{32,}$/.test(v.salt) &&
    typeof v.hash === "string" &&
    /^[0-9a-f]{128}$/.test(v.hash)
  );
}

export async function loadAdminCredential(): Promise<AdminCredentialLookup> {
  if (!isSupabaseConfigured) return { status: "none" };
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", ADMIN_CREDENTIALS_KEY)
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "none" };
    // A malformed row must not silently re-enable ADMIN_PASSWORD.
    if (!isStoredCredential(data.value)) return { status: "error" };
    return { status: "set", record: data.value };
  } catch {
    return { status: "error" };
  }
}

async function derive(password: string, salt: string, iterations: number): Promise<Buffer> {
  return pbkdf2(password, salt, iterations, KEY_LENGTH, DIGEST);
}

async function verifyAgainstRecord(password: string, record: StoredAdminCredential): Promise<boolean> {
  const derived = await derive(password, record.salt, record.iterations);
  const stored = Buffer.from(record.hash, "hex");
  return stored.length === derived.length && crypto.timingSafeEqual(derived, stored);
}

export type AdminPasswordCheck = "valid" | "invalid" | "unavailable";

/**
 * Verifies the admin password: the panel-set password when one exists,
 * otherwise ADMIN_PASSWORD. Fails closed ("unavailable") when the store cannot
 * be read, so an old password never works during a database outage.
 */
export async function checkAdminPassword(password: string): Promise<AdminPasswordCheck> {
  const lookup = await loadAdminCredential();
  if (lookup.status === "error") return "unavailable";
  if (lookup.status === "set") {
    return (await verifyAgainstRecord(password, lookup.record)) ? "valid" : "invalid";
  }
  return verifyEnvAdminPassword(password) ? "valid" : "invalid";
}

export async function authenticateAdminWithStore(
  identifier: string,
  password: string
): Promise<{ status: "ok"; username: string; email: string } | { status: "invalid" | "unavailable" }> {
  if (!adminIdentityMatches(identifier)) return { status: "invalid" };
  const check = await checkAdminPassword(password);
  if (check !== "valid") return { status: check };
  return { status: "ok", ...getAdminIdentity() };
}

export type NewPasswordError =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NEEDS_LETTERS_AND_DIGITS"
  | "SAME_AS_CURRENT"
  | "CONTAINS_IDENTITY"
  | "MISMATCH";

export function validateNewAdminPassword(
  newPassword: string,
  confirmPassword: string,
  currentPassword: string
): NewPasswordError | null {
  if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) return "TOO_SHORT";
  if (newPassword.length > ADMIN_PASSWORD_MAX_LENGTH) return "TOO_LONG";
  if (!/\p{L}/u.test(newPassword) || !/\d/.test(newPassword)) return "NEEDS_LETTERS_AND_DIGITS";
  if (newPassword === currentPassword) return "SAME_AS_CURRENT";
  const lower = newPassword.toLowerCase();
  const { username, email } = getAdminIdentity();
  const emailLocal = email.split("@")[0]?.toLowerCase() || "";
  if (
    (username.length >= 4 && lower.includes(username.toLowerCase())) ||
    (emailLocal.length >= 4 && lower.includes(emailLocal))
  ) {
    return "CONTAINS_IDENTITY";
  }
  if (newPassword !== confirmPassword) return "MISMATCH";
  return null;
}

export async function saveAdminPassword(newPassword: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await derive(newPassword, salt, ITERATIONS);
  const now = new Date().toISOString();
  const record: StoredAdminCredential = {
    v: 1,
    algo: "pbkdf2-sha512",
    iterations: ITERATIONS,
    salt,
    hash: derived.toString("hex"),
    changed_at: now,
  };
  try {
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: ADMIN_CREDENTIALS_KEY, value: record, updated_at: now });
    return !error;
  } catch {
    return false;
  }
}
