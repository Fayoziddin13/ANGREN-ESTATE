import { describe, it, expect } from "vitest";
import {
  approveListing, approveStatus, createListing, createSeedState, createStatusOrder, currentUser, decideRefund, hasFreeRight, listingQuote,
  login, logout, normalizeState, payOrder, publicListings, rejectListing, rejectStatus, requestRevision, resubmitListing, savePromo,
  savePromotion, shiftClock, statusPhase, statusQuote, togglePromo, updateSettings, DEMO_CREDENTIALS,
  type ActionResult, type DemoState, type ListingInput,
} from "@/lib/demo/engine";
import { demoModeAllowed } from "@/lib/demo/gate";

const U = "u-demo";
const A = "u-admin";
const DAY = 86400000;
const input = (title = "2 xonali kvartira"): ListingInput => ({
  title, dealType: "sale", propertyType: "apartment", price: 30000, currency: "USD", rooms: 2, area: 55,
  location: "Angren, 6-mavze", description: "test", phone: "+998 90 000 00 01", photos: [],
});

function ok(r: ActionResult): DemoState {
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r.state;
}

function setup() {
  let s = createSeedState();
  s = ok(login(s, "user", DEMO_CREDENTIALS.user.login, DEMO_CREDENTIALS.user.password));
  s = ok(login(s, "admin", DEMO_CREDENTIALS.admin.login, DEMO_CREDENTIALS.admin.password));
  return s;
}

/** Creates a listing for U; pays it when it is paid; returns state and listing id. */
function newListing(s: DemoState, title: string, plan: "standard" | "premium" = "standard", promo?: string) {
  const r = createListing(s, U, input(title), plan, promo);
  let st = ok(r);
  if (r.orderId && st.orders.find((o) => o.id === r.orderId)!.paymentStatus === "pending") st = ok(payOrder(st, r.orderId, "success", U));
  return { s: st, id: r.listingId!, orderId: r.orderId };
}

describe("demo gate", () => {
  it("is local only", () => {
    expect(demoModeAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(demoModeAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(demoModeAllowed({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
    expect(demoModeAllowed({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
  });
});

describe("demo login", () => {
  it("separates user and admin, rejects wrong passwords", () => {
    const s = createSeedState();
    expect(login(s, "user", "demo", "wrong").ok).toBe(false);
    expect(login(s, "admin", "demo", "demo123").ok).toBe(false); // a user is not an admin
    expect(login(s, "user", "admin", "admin123").ok).toBe(false);
    const s2 = setup();
    expect(currentUser(s2, "user")?.id).toBe(U);
    expect(currentUser(s2, "admin")?.id).toBe(A);
    const s3 = ok(logout(s2, "user"));
    expect(currentUser(s3, "user")).toBeNull();
    expect(currentUser(s3, "admin")?.id).toBe(A); // admin session untouched
    expect(currentUser(ok(login(s3, "user", "demo", "demo123")), "user")?.id).toBe(U); // re-login
  });
});

describe("listings and payment", () => {
  it("1) first listing is free and goes straight to moderation", () => {
    const s = setup();
    expect(hasFreeRight(s, U)).toBe(true);
    const r = createListing(s, U, input(), "standard");
    const st = ok(r);
    const l = st.listings.find((x) => x.id === r.listingId)!;
    expect(l.billing).toBe("free");
    expect(l.moderation).toBe("pending");
    expect(r.orderId).toBeUndefined();
    expect(hasFreeRight(st, U)).toBe(false);
  });

  it("2-4) second listing needs payment; success sends it to moderation; payment and moderation are separate", () => {
    let s = setup();
    s = ok(createListing(s, U, input("first"), "standard"));
    const q = listingQuote(s, U, "standard");
    expect(q.free).toBe(false);
    expect(q.total).toBe(50000);
    const r = createListing(s, U, input("second"), "standard");
    s = ok(r);
    const l = () => s.listings.find((x) => x.id === r.listingId)!;
    const o = () => s.orders.find((x) => x.id === r.orderId)!;
    expect(l().billing).toBe("paid");
    expect(l().moderation).toBe("not_submitted");
    expect(o().paymentStatus).toBe("pending");
    s = ok(payOrder(s, r.orderId!, "failed", U));
    expect(o().paymentStatus).toBe("failed");
    expect(l().moderation).toBe("not_submitted");
    s = ok(payOrder(s, r.orderId!, "cancelled", U));
    expect(o().paymentStatus).toBe("cancelled");
    s = ok(payOrder(s, r.orderId!, "success", U));
    expect(o().paymentStatus).toBe("paid");
    expect(l().moderation).toBe("pending");
    expect(payOrder(s, r.orderId!, "success", U).ok).toBe(false); // no double payment
    expect(payOrder(s, r.orderId!, "success", "u-seller").ok).toBe(false); // not someone else's order
  });

  it("5) approval makes the listing public; 6) rejection changes the state and opens a refund", () => {
    let s = setup();
    s = ok(createListing(s, U, input("free one"), "standard"));
    const paid = newListing(s, "paid one");
    s = paid.s;
    expect(publicListings(s).some((p) => p.listing.id === paid.id)).toBe(false);
    s = ok(approveListing(s, A, paid.id));
    expect(publicListings(s).some((p) => p.listing.id === paid.id)).toBe(true);
    s = ok(rejectListing(s, A, paid.id, "Rasmlar noto‘g‘ri"));
    const l = s.listings.find((x) => x.id === paid.id)!;
    expect(l.moderation).toBe("rejected");
    expect(l.rejectReason).toBe("Rasmlar noto‘g‘ri");
    expect(publicListings(s).some((p) => p.listing.id === paid.id)).toBe(false);
    const o = s.orders.find((x) => x.id === paid.orderId)!;
    expect(o.refundStatus).toBe("requested");
    s = ok(decideRefund(s, A, o.id, "refunded"));
    expect(s.orders.find((x) => x.id === o.id)!.refundStatus).toBe("refunded");
    expect(rejectListing(s, A, paid.id, "").ok).toBe(false); // a reason is required
  });

  it("7) a rejected free listing gives the free right back", () => {
    let s = setup();
    const r = createListing(s, U, input(), "standard");
    s = ok(r);
    expect(hasFreeRight(s, U)).toBe(false);
    s = ok(rejectListing(s, A, r.listingId!, "Noto‘g‘ri ma’lumot"));
    expect(hasFreeRight(s, U)).toBe(true);
    expect(listingQuote(s, U, "standard").free).toBe(true);
  });

  it("revision: admin asks, user fixes and resubmits without paying again", () => {
    let s = setup();
    s = ok(createListing(s, U, input("first a"), "standard"));
    const p = newListing(s, "second b");
    s = ok(requestRevision(p.s, A, p.id, "Narxni aniqlang"));
    expect(s.listings.find((x) => x.id === p.id)!.moderation).toBe("revision");
    s = ok(resubmitListing(s, U, p.id, { ...input("b fixed"), price: 31000 }));
    const l = s.listings.find((x) => x.id === p.id)!;
    expect(l.moderation).toBe("pending");
    expect(l.title).toBe("b fixed");
    expect(s.orders.filter((o) => o.targetId === p.id)).toHaveLength(1);
  });
});

describe("pricing", () => {
  it("8) promo codes: percent, fixed, expired, limit, target, disabled", () => {
    let s = setup();
    s = ok(createListing(s, U, input("free"), "standard"));
    expect(listingQuote(s, U, "standard", "DEMO10").total).toBe(45000);
    expect(listingQuote(s, U, "standard", "MINUS20K").total).toBe(30000);
    expect(listingQuote(s, U, "standard", "ESKI50").promoError).toMatch(/muddati/);
    expect(listingQuote(s, U, "standard", "NOPE").promoError).toBeTruthy();
    expect(statusQuote(s, "top", 7, "MINUS20K").promoError).toMatch(/faqat e’lon/);
    // limit 1: after one paid use the code is exhausted
    const p = newListing(s, "with promo", "standard", "MINUS20K");
    expect(p.s.orders.find((o) => o.id === p.orderId)!.amount).toBe(30000);
    expect(listingQuote(p.s, U, "standard", "MINUS20K").promoError).toMatch(/limit/);
    const promoId = s.promoCodes.find((x) => x.code === "DEMO10")!.id;
    const off = ok(togglePromo(s, A, promoId));
    expect(listingQuote(off, U, "standard", "DEMO10").promoError).toMatch(/o‘chirilgan/);
  });

  it("active promotion discounts before the promo code", () => {
    let s = setup();
    s = ok(createListing(s, U, input("free"), "standard"));
    const now = Date.now();
    s = ok(savePromotion(s, A, { name: "Test", description: "", percent: 20, target: "listing", startsAt: new Date(now - DAY).toISOString(), endsAt: new Date(now + DAY).toISOString(), active: true }));
    const q = listingQuote(s, U, "standard", "DEMO10");
    expect(q.promotionDiscount).toBe(10000); // 20% of 50 000
    expect(q.promoDiscount).toBe(4000); // 10% of 40 000
    expect(q.total).toBe(36000);
    expect(statusQuote(s, "top", 7).promotion).toBeNull(); // listing-only promotion
  });

  it("9) admin price changes reach the user's quote immediately", () => {
    let s = setup();
    s = ok(createListing(s, U, input("free"), "standard"));
    s = ok(updateSettings(s, A, { planPrices: { standard: 77000 }, statusPrices: { top: { 7: 33000 } } }));
    expect(listingQuote(s, U, "standard").total).toBe(77000);
    expect(statusQuote(s, "top", 7).total).toBe(33000);
    s = ok(updateSettings(s, A, { monetizationEnabled: false }));
    expect(listingQuote(s, U, "standard").free).toBe(true);
    expect(updateSettings(s, U, { monetizationEnabled: true }).ok).toBe(false); // only admin
    expect(updateSettings(s, A, { planPrices: { standard: -1 } }).ok).toBe(false);
  });

  it("free-first switch off makes even the first listing paid", () => {
    let s = setup();
    s = ok(updateSettings(s, A, { freeFirstEnabled: false }));
    expect(listingQuote(s, U, "standard").free).toBe(false);
  });

  it("promo code validation in admin", () => {
    const s = setup();
    const base = { kind: "percent" as const, value: 10, target: "all" as const, validFrom: new Date().toISOString(), validTo: new Date(Date.now() + DAY).toISOString(), usageLimit: 0, active: true };
    expect(savePromo(s, A, { ...base, code: "DEMO10" }).ok).toBe(false); // duplicate
    expect(savePromo(s, A, { ...base, code: "X" }).ok).toBe(false);
    expect(savePromo(s, A, { ...base, code: "BIG", value: 150 }).ok).toBe(false);
    expect(savePromo(s, A, { ...base, code: "NEW25", value: 25 }).ok).toBe(true);
  });
});

describe("statuses", () => {
  function approvedListing() {
    let s = setup();
    const r = createListing(s, U, input(), "standard");
    s = ok(approveListing(ok(r), A, r.listingId!));
    return { s, id: r.listingId! };
  }

  it("only approved listings can buy a status", () => {
    let s = setup();
    const r = createListing(s, U, input(), "standard");
    s = ok(r);
    expect(createStatusOrder(s, U, r.listingId!, "top", 7).ok).toBe(false);
  });

  it("10) not active before approval; 11) the period starts at approval; expiry", () => {
    let { s, id } = approvedListing();
    const r = createStatusOrder(s, U, id, "top", 7);
    s = ok(r);
    const so = () => s.statusOrders.find((x) => x.orderId === r.orderId)!;
    expect(so().state).toBe("awaiting_payment");
    s = ok(payOrder(s, r.orderId!, "success", U));
    expect(so().state).toBe("pending_approval");
    expect(publicListings(s).find((p) => p.listing.id === id)!.isTop).toBe(false);
    s = ok(shiftClock(s, A, 2)); // admin approves two days later
    s = ok(approveStatus(s, A, so().id));
    const approvedAt = Date.parse(so().approvedAt!);
    expect(Date.parse(so().startsAt!)).toBe(approvedAt);
    expect(Date.parse(so().endsAt!) - approvedAt).toBe(7 * DAY);
    expect(approvedAt - Date.parse(so().createdAt)).toBeGreaterThanOrEqual(2 * DAY - 1000);
    expect(publicListings(s)[0].listing.id).toBe(id); // TOP first
    s = ok(shiftClock(s, A, 6));
    expect(statusPhase(s, so())).toBe("active");
    s = ok(shiftClock(s, A, 1.01));
    expect(statusPhase(s, so())).toBe("expired");
    expect(publicListings(s).find((p) => p.listing.id === id)!.isTop).toBe(false);
  });

  it("rejecting a paid status opens a refund; duplicates are refused", () => {
    let { s, id } = approvedListing();
    const r = createStatusOrder(s, U, id, "tez_sotiladi", 3);
    s = ok(payOrder(ok(r), r.orderId!, "success", U));
    expect(createStatusOrder(s, U, id, "tez_sotiladi", 7).ok).toBe(false);
    const soId = s.statusOrders.find((x) => x.orderId === r.orderId)!.id;
    s = ok(rejectStatus(s, A, soId, "Mos emas"));
    expect(s.orders.find((o) => o.id === r.orderId)!.refundStatus).toBe("requested");
    expect(createStatusOrder(s, U, id, "tez_sotiladi", 7).ok).toBe(true);
  });

  it("premium plan gives TOP from the approval moment", () => {
    let s = setup();
    s = ok(createListing(s, U, input("free"), "standard"));
    const p = newListing(s, "premium", "premium");
    expect(p.s.orders.find((o) => o.id === p.orderId)!.amount).toBe(120000);
    s = ok(approveListing(p.s, A, p.id));
    const bonus = s.statusOrders.find((x) => x.listingId === p.id && x.source === "premium_bonus")!;
    expect(bonus.state).toBe("active");
    expect(Date.parse(bonus.endsAt!) - Date.parse(bonus.startsAt!)).toBe(7 * DAY);
  });
});

describe("persistence shape and reset", () => {
  it("12) state survives a JSON round trip (what localStorage stores)", () => {
    let s = setup();
    s = ok(createListing(s, U, input(), "standard"));
    const back = normalizeState(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
  });

  it("14) unknown or broken data falls back to a clean seed", () => {
    expect(normalizeState(null).listings).toHaveLength(2);
    expect(normalizeState({ version: 999 }).orders).toHaveLength(0);
    expect(normalizeState("garbage").sessions.user).toBeNull();
  });
});
