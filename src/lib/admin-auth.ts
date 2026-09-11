import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "angren_admin_token";
const DEFAULT_DEV_JWT_SECRET = "angren_estate_super_secret_admin_jwt_key_2026_x89!";

export function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim() === "" || secret === DEFAULT_DEV_JWT_SECRET || secret.length < 32) {
      throw new Error("[AdminAuth] Fatal: ADMIN_JWT_SECRET must be explicitly configured with at least 32 characters in production.");
    }
    return secret;
  }
  return secret || DEFAULT_DEV_JWT_SECRET;
}

// Configured admin public accounts (identifiers)
export const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@angrenestate.uz";
export const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";

// In-memory rate limiting store: key -> { count: number, resetTime: number }
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface AdminSession {
  id: string;
  username: string;
  email: string;
  role: "admin";
  exp: number;
  iat: number;
  rememberMe: boolean;
}

// 1. Password Hashing (PBKDF2 with crypto salt)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, generatedSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// Fixed salt for admin verification
const defaultSalt = "a1b2c3d4e5f6789012345678abcdef01";

// 2. Rate Limiting Check
export function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 0, resetTime: now + LOCKOUT_WINDOW_MS });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSec };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count };
}

export function recordFailedAttempt(ip: string): { remainingAttempts: number; isLocked: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + LOCKOUT_WINDOW_MS };
  } else {
    record.count += 1;
  }
  rateLimitStore.set(ip, record);

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - record.count);
  const isLocked = record.count >= MAX_ATTEMPTS;
  const retryAfterSec = isLocked ? Math.ceil((record.resetTime - now) / 1000) : undefined;

  return { remainingAttempts, isLocked, retryAfterSec };
}

export function resetRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}

// 3. Cryptographic Session Token (HMAC-SHA256 signed)
export function createAdminSessionToken(username: string, email: string, rememberMe = false): string {
  const iat = Math.floor(Date.now() / 1000);
  const ttlSeconds = rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60; // 30 days or 8 hours
  const exp = iat + ttlSeconds;
  const secretKey = getAdminJwtSecret();

  const payload: AdminSession = {
    id: "admin-primary-1",
    username,
    email,
    role: "admin",
    iat,
    exp,
    rememberMe,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(payloadStr)
    .digest("base64url");

  return `${payloadStr}.${signature}`;
}

export function verifyAdminSessionToken(token: string): { valid: boolean; session?: AdminSession; error?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token" };
  }

  const [payloadStr, signature] = parts;
  let secretKey: string;
  try {
    secretKey = getAdminJwtSecret();
  } catch (err: any) {
    return { valid: false, error: err?.message || "Secret key error" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(payloadStr)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false, error: "Invalid signature" };
  }

  try {
    const payload: AdminSession = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Session expired" };
    }

    if (payload.role !== "admin") {
      return { valid: false, error: "Unauthorized role" };
    }

    return { valid: true, session: payload };
  } catch {
    return { valid: false, error: "Payload decoding error" };
  }
}

// 4. Verify Credentials Function
export function authenticateAdmin(identifier: string, passwordAttempt: string): { success: boolean; username: string; email: string } | null {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || configuredPassword.trim() === "") {
    console.warn("[AdminAuth] Login attempt rejected: ADMIN_PASSWORD is not configured in environment.");
    return null;
  }

  const cleanId = identifier.trim().toLowerCase();
  const validEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const validUsername = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).toLowerCase();

  const isIdMatch = cleanId === validEmail || cleanId === validUsername;
  if (!isIdMatch) {
    return null;
  }

  const { hash: expectedHash } = hashPassword(configuredPassword, defaultSalt);
  const isPasswordValid = verifyPassword(passwordAttempt, expectedHash, defaultSalt);
  if (!isPasswordValid) {
    return null;
  }

  return {
    success: true,
    username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
  };
}

// 5. Server Helper to Read Session from Next.js Headers/Cookies
export async function getAdminSessionServer(): Promise<AdminSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = verifyAdminSessionToken(token);
  return result.valid && result.session ? result.session : null;
}
