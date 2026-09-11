// Edge-compatible session verification using Web Crypto API

const DEFAULT_DEV_JWT_SECRET = "angren_estate_super_secret_admin_jwt_key_2026_x89!";

function getSecretKey(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim() === "" || secret === DEFAULT_DEV_JWT_SECRET || secret.length < 32) {
      throw new Error("[AdminAuth] Fatal: ADMIN_JWT_SECRET must be explicitly configured with at least 32 characters in production.");
    }
    return secret;
  }
  return secret || DEFAULT_DEV_JWT_SECRET;
}

export async function verifyTokenEdge(token: string): Promise<{ valid: boolean; error?: string }> {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Missing token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Malformed token" };
  }

  const [payloadStr, signature] = parts;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(getSecretKey());
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert signature from base64url to Uint8Array
    const base64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLength);
    const rawSig = atob(padded);
    const sigBytes = new Uint8Array(rawSig.length);
    for (let i = 0; i < rawSig.length; i++) {
      sigBytes[i] = rawSig.charCodeAt(i);
    }

    const isValidSig = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      sigBytes,
      encoder.encode(payloadStr)
    );

    if (!isValidSig) {
      return { valid: false, error: "Invalid signature" };
    }

    // Decode payload
    const payloadJson = atob(payloadStr.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired" };
    }

    if (payload.role !== "admin") {
      return { valid: false, error: "Unauthorized role" };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: "Verification failed: " + String(err) };
  }
}
