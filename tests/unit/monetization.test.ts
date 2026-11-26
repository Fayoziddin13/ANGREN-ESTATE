import { describe, it, expect } from "vitest";
import { devToolsAllowed, mockPaymentsAllowed } from "@/lib/env/safety";
import { signMockCheckout, verifyMockSignature, getPaymentProvider } from "@/lib/monetization/payments";
import { sniffImage, isOwnPhotoPath } from "@/lib/monetization/uploads";
import { normalizeE164 } from "@/lib/monetization/customer";
import { validateSubmissionInput } from "@/lib/monetization/submissions";
import { validateSettingsPatch } from "@/lib/monetization/settings";
import { validateBoostInput } from "@/lib/monetization/boosts";
import { fromDbError, MonetizationError } from "@/lib/monetization/errors";

const TEST_URL = "https://lesaumhlzjagrcfvjqqf.supabase.co";
const PROD_URL = "https://gemozzkmoogjxtdwvepz.supabase.co";
const ACC = "0fab0acb-329b-4902-ac5c-8f5299d198a6";
const PHOTO = `${ACC}/11111111-2222-4333-8444-555555555555.jpg`;

describe("dev tools guard (test login, mock page)", () => {
  const ok = { NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: TEST_URL };
  it("allowed locally against the test project", () => expect(devToolsAllowed(ok).allowed).toBe(true));
  it("refused on Vercel", () => expect(devToolsAllowed({ ...ok, VERCEL: "1" }).allowed).toBe(false));
  it("refused in production builds", () => expect(devToolsAllowed({ ...ok, NODE_ENV: "production" }).allowed).toBe(false));
  it("refused against production", () => expect(devToolsAllowed({ ...ok, NEXT_PUBLIC_SUPABASE_URL: PROD_URL }).allowed).toBe(false));
});

describe("mock payment signature", () => {
  it("accepts the server-signed amount only", () => {
    const sig = signMockCheckout("order-1", 45000);
    expect(verifyMockSignature("order-1", 45000, sig)).toBe(true);
    expect(verifyMockSignature("order-1", 1000, sig)).toBe(false); // tampered amount
    expect(verifyMockSignature("order-2", 45000, sig)).toBe(false); // other order
    expect(verifyMockSignature("order-1", 45000, "00".repeat(32))).toBe(false); // forged
    expect(verifyMockSignature("order-1", 45000, undefined)).toBe(false);
  });
  it("a payment provider exists only where the Mock is allowed", () => {
    expect(Boolean(getPaymentProvider())).toBe(mockPaymentsAllowed().allowed);
    const saved = { VERCEL: process.env.VERCEL };
    process.env.VERCEL = "1";
    expect(getPaymentProvider()).toBeNull(); // Vercel (production / preview): never the Mock
    if (saved.VERCEL === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = saved.VERCEL;
  });
});

describe("photo checks", () => {
  it("detects real image bytes, not the file name", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF1234WEBPVP8 "))?.ext).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
  it("a customer can only reference photos in their own folder", () => {
    expect(isOwnPhotoPath(ACC, PHOTO)).toBe(true);
    expect(isOwnPhotoPath("99999999-0000-4000-8000-000000000000", PHOTO)).toBe(false);
    expect(isOwnPhotoPath(ACC, `${ACC}/../other/x.jpg`)).toBe(false);
  });
});

describe("phone normalisation", () => {
  it("normalises Uzbek numbers to E.164", () => {
    expect(normalizeE164("+998 90 123-45-67")).toBe("+998901234567");
    expect(normalizeE164("998901234567")).toBe("+998901234567");
    expect(normalizeE164("901234567")).toBe("+998901234567");
    expect(normalizeE164("+998")).toBeNull();
    expect(normalizeE164("abc")).toBeNull();
  });
});

describe("application validation", () => {
  const base = {
    deal_type: "sale", property_type: "apartment", location: "Angren 5", description: "3 xonali",
    contact_name: "Ali", contact_phone: "+998901234567", photos: [PHOTO], idempotency_key: "abcdefgh-123",
  };
  it("keeps only known fields; prices from the browser are ignored", () => {
    const v = validateSubmissionInput({ ...base, amount: 1, final_amount_uzs: 1, billing: "free", user_id: "x" }, ACC);
    expect(Object.keys(v.payload).sort()).toEqual(["area", "currency", "deal_type", "description", "location", "price", "property_type", "rooms"].sort());
    expect((v as any).billing).toBeUndefined();
  });
  it("rejects photos of another account and unknown types", () => {
    expect(() => validateSubmissionInput({ ...base, photos: ["someone/else.jpg"] }, ACC)).toThrow(MonetizationError);
    expect(() => validateSubmissionInput({ ...base, property_type: "castle" }, ACC)).toThrow(MonetizationError);
    expect(() => validateSubmissionInput({ ...base, contact_phone: "123" }, ACC)).toThrow(MonetizationError);
  });
  it("normalises the promo code", () => {
    expect(validateSubmissionInput({ ...base, promo_code: " check10 " }, ACC).promoCode).toBe("CHECK10");
    expect(() => validateSubmissionInput({ ...base, promo_code: "a'; drop" }, ACC)).toThrow(MonetizationError);
  });
});

describe("admin settings and sticker input", () => {
  it("validates types and ranges", () => {
    expect(validateSettingsPatch({ enabled: true, free_listing_limit: 2 })).toEqual({ enabled: true, free_listing_limit: 2 });
    expect(() => validateSettingsPatch({ enabled: "yes" })).toThrow(MonetizationError);
    expect(() => validateSettingsPatch({ order_ttl_minutes: 1 })).toThrow(MonetizationError);
    expect(() => validateSettingsPatch({ unknown: 1 })).toThrow(MonetizationError);
  });
  it("sticker request needs a known sticker and a sane duration", () => {
    expect(validateBoostInput({ property_id: "prop-1", sticker_type: "top", duration_days: 7 }).days).toBe(7);
    expect(() => validateBoostInput({ property_id: "prop-1", sticker_type: "vip", duration_days: 7 })).toThrow();
    expect(() => validateBoostInput({ property_id: "prop-1", sticker_type: "top", duration_days: 0 })).toThrow();
  });
});

describe("database errors", () => {
  it("maps MON:* to business errors and hides the rest", () => {
    expect(fromDbError({ message: "MON:account_blocked" }).code).toBe("account_blocked");
    expect(fromDbError({ message: "MON:account_blocked" }).status).toBe(403);
    expect(fromDbError({ message: "relation does not exist" }).code).toBe("internal");
  });
});
