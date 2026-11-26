/**
 * ANGREN ESTATE — Local Monetization DEMO engine.
 *
 * Pure functions over one plain JSON state object. Nothing here talks to a
 * server, a database or a payment provider: the state lives in the browser's
 * localStorage (see ./store.ts). Every action returns a NEW state plus a
 * human-readable result, so the UI can show what happened after each click.
 *
 * Rules (mirroring the real monetization design):
 *  - The first listing of a user is free while "free first" is on and the user
 *    has no other free listing that is not rejected. A rejected free listing
 *    gives the right back (the right is derived, never stored as a flag).
 *  - Any other listing needs a paid order. Payment status (order) and
 *    moderation status (listing) are separate fields.
 *  - A listing reaches moderation only after its order is paid (or it is free).
 *  - A status (sticker) can be bought for an approved listing; after payment it
 *    waits for admin approval and its 3/7/30-day period starts at approval.
 *  - Rejecting something that was paid opens a refund request for the admin.
 *  - Prices always come from admin settings at the moment the order is made;
 *    an active promotion and then a promo code reduce the amount.
 */

export const DEMO_STATE_VERSION = 1;
export const DEMO_STORAGE_KEY = "angren_demo_v1";

export type Locale = "uz" | "ru";
export type Role = "user" | "admin";
export type ListingPlanId = "standard" | "premium";
export type StatusType = "top" | "tez_sotiladi" | "yaxshi_taklif";
export type StatusDays = 3 | 7 | 30;
export const STATUS_TYPES: StatusType[] = ["top", "tez_sotiladi", "yaxshi_taklif"];
export const STATUS_DAYS: StatusDays[] = [3, 7, 30];

export type Moderation = "not_submitted" | "pending" | "approved" | "rejected" | "revision";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type RefundStatus = "none" | "requested" | "refunded" | "declined";
export type StatusOrderState = "awaiting_payment" | "pending_approval" | "active" | "rejected" | "cancelled";
export type PromoTarget = "all" | "listing" | "status";

export interface DemoUser {
  id: string;
  role: Role;
  name: string;
  login: string;
  password: string;
  phone: string;
}

export interface ListingPlan {
  id: ListingPlanId;
  nameUz: string;
  nameRu: string;
  price: number;
  /** Premium: a TOP status for this many days, started at approval. 0 = none. */
  bonusTopDays: number;
}

export interface Settings {
  monetizationEnabled: boolean;
  freeFirstEnabled: boolean;
  plans: Record<ListingPlanId, ListingPlan>;
  statusPrices: Record<StatusType, Record<StatusDays, number>>;
  /** Demo-only clock shift so expiry can be tested without waiting days. */
  clockOffsetMs: number;
}

export interface PromoCode {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  target: PromoTarget;
  validFrom: string; // ISO
  validTo: string; // ISO
  usageLimit: number; // 0 = unlimited
  used: number;
  active: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  percent: number;
  target: PromoTarget;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

export interface Order {
  id: string;
  userId: string;
  kind: "listing" | "status";
  targetId: string;
  title: string;
  baseAmount: number;
  promotionId: string | null;
  promotionDiscount: number;
  promoCode: string | null;
  promoDiscount: number;
  amount: number;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  refundNote: string | null;
  attempts: { at: string; outcome: "success" | "failed" | "cancelled" }[];
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

export interface Listing {
  id: string;
  userId: string;
  title: string;
  dealType: "sale" | "rent";
  propertyType: "apartment" | "house" | "commercial" | "land";
  price: number;
  currency: "UZS" | "USD";
  rooms: number | null;
  area: number | null;
  location: string;
  description: string;
  phone: string;
  photos: string[];
  plan: ListingPlanId;
  billing: "free" | "paid";
  orderId: string | null;
  moderation: Moderation;
  rejectReason: string | null;
  revisionNote: string | null;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  history: { at: string; text: string }[];
}

export interface StatusOrder {
  id: string;
  userId: string;
  listingId: string;
  type: StatusType;
  days: number;
  orderId: string | null;
  state: StatusOrderState;
  source: "purchase" | "premium_bonus";
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface DemoState {
  version: number;
  createdAt: string;
  users: DemoUser[];
  sessions: { user: string | null; admin: string | null };
  settings: Settings;
  listings: Listing[];
  orders: Order[];
  statusOrders: StatusOrder[];
  promoCodes: PromoCode[];
  promotions: Promotion[];
  log: { at: string; actor: string; text: string }[];
}

export interface ActionResult {
  state: DemoState;
  ok: boolean;
  message: string;
  /** e.g. the order id to open the payment page for. */
  orderId?: string;
  listingId?: string;
}

// ---------------------------------------------------------------- helpers

const DAY = 24 * 60 * 60 * 1000;

export function nowMs(state: DemoState, real: number = Date.now()): number {
  return real + (state.settings.clockOffsetMs || 0);
}
export function nowIso(state: DemoState, real?: number): string {
  return new Date(nowMs(state, real)).toISOString();
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function fail(state: DemoState, message: string): ActionResult {
  return { state, ok: false, message };
}

function addLog(s: DemoState, actor: string, text: string) {
  s.log.unshift({ at: nowIso(s), actor, text });
  if (s.log.length > 200) s.log.length = 200;
}

export function formatSum(value: number, locale: Locale = "uz"): string {
  const n = Math.round(Number(value) || 0);
  return `${n.toLocaleString("ru-RU").replace(/[ ,]/g, " ")} ${locale === "uz" ? "so‘m" : "сум"}`;
}

// ---------------------------------------------------------------- seed

export const DEMO_CREDENTIALS = {
  user: { login: "demo", password: "demo123" },
  admin: { login: "admin", password: "admin123" },
} as const;

export function createSeedState(real: number = Date.now()): DemoState {
  const iso = (offsetDays: number) => new Date(real + offsetDays * DAY).toISOString();
  const users: DemoUser[] = [
    { id: "u-demo", role: "user", name: "Demo Foydalanuvchi", login: DEMO_CREDENTIALS.user.login, password: DEMO_CREDENTIALS.user.password, phone: "+998 90 000 00 01" },
    { id: "u-seller", role: "user", name: "Demo Sotuvchi", login: "seller", password: "seller123", phone: "+998 90 000 00 02" },
    { id: "u-admin", role: "admin", name: "Demo Admin", login: DEMO_CREDENTIALS.admin.login, password: DEMO_CREDENTIALS.admin.password, phone: "+998 90 000 00 09" },
  ];
  const seedListing = (id: string, title: string, extra: Partial<Listing>): Listing => ({
    id,
    userId: "u-seller",
    title,
    dealType: "sale",
    propertyType: "apartment",
    price: 0,
    currency: "USD",
    rooms: null,
    area: null,
    location: "Angren",
    description: "",
    phone: "+998 90 000 00 02",
    photos: [],
    plan: "standard",
    billing: "free",
    orderId: null,
    moderation: "approved",
    rejectReason: null,
    revisionNote: null,
    createdAt: iso(-5),
    submittedAt: iso(-5),
    decidedAt: iso(-4),
    history: [{ at: iso(-4), text: "Demo: boshlang‘ich namuna e’lon" }],
    ...extra,
  });
  return {
    version: DEMO_STATE_VERSION,
    createdAt: new Date(real).toISOString(),
    users,
    sessions: { user: null, admin: null },
    settings: {
      monetizationEnabled: true,
      freeFirstEnabled: true,
      plans: {
        standard: { id: "standard", nameUz: "Standart", nameRu: "Стандарт", price: 50000, bonusTopDays: 0 },
        premium: { id: "premium", nameUz: "Premium (TOP 7 kun bilan)", nameRu: "Премиум (с ТОП 7 дней)", price: 120000, bonusTopDays: 7 },
      },
      statusPrices: {
        top: { 3: 15000, 7: 30000, 30: 90000 },
        tez_sotiladi: { 3: 10000, 7: 20000, 30: 60000 },
        yaxshi_taklif: { 3: 8000, 7: 16000, 30: 45000 },
      },
      clockOffsetMs: 0,
    },
    listings: [
      seedListing("l-seed-1", "3 xonali kvartira, 5-mavze", { price: 38000, rooms: 3, area: 72, location: "Angren, 5-mavze", description: "Demo namuna: ta’mirlangan, 3-qavat." }),
      seedListing("l-seed-2", "Hovli uy, Obliq yo‘li", { propertyType: "house", price: 65000, rooms: 5, area: 180, location: "Angren, Obliq yo‘li", description: "Demo namuna: 6 sotix yer, garaj." }),
    ],
    orders: [],
    statusOrders: [
      {
        id: "s-seed-1", userId: "u-seller", listingId: "l-seed-2", type: "top", days: 7, orderId: null, state: "active",
        source: "purchase", rejectReason: null, createdAt: iso(-2), approvedAt: iso(-2), startsAt: iso(-2), endsAt: iso(5),
      },
    ],
    promoCodes: [
      { id: "p-1", code: "DEMO10", kind: "percent", value: 10, target: "all", validFrom: iso(-30), validTo: iso(60), usageLimit: 100, used: 0, active: true },
      { id: "p-2", code: "MINUS20K", kind: "fixed", value: 20000, target: "listing", validFrom: iso(-30), validTo: iso(60), usageLimit: 1, used: 0, active: true },
      { id: "p-3", code: "ESKI50", kind: "percent", value: 50, target: "all", validFrom: iso(-60), validTo: iso(-1), usageLimit: 0, used: 0, active: true },
    ],
    promotions: [
      { id: "a-1", name: "Kuzgi aksiya", description: "Barcha xizmatlarga 15% chegirma", percent: 15, target: "all", startsAt: iso(-1), endsAt: iso(30), active: false },
    ],
    log: [{ at: new Date(real).toISOString(), actor: "system", text: "Demo ma’lumotlar yaratildi" }],
  };
}

/** Accept only a state that looks like ours; otherwise start from the seed. */
export function normalizeState(raw: unknown, real: number = Date.now()): DemoState {
  const s = raw as Partial<DemoState> | null;
  if (!s || typeof s !== "object" || s.version !== DEMO_STATE_VERSION || !Array.isArray(s.users) || !s.settings) {
    return createSeedState(real);
  }
  const seed = createSeedState(real);
  return {
    ...seed,
    ...s,
    sessions: { user: s.sessions?.user ?? null, admin: s.sessions?.admin ?? null },
    settings: { ...seed.settings, ...s.settings },
    listings: s.listings ?? [],
    orders: s.orders ?? [],
    statusOrders: s.statusOrders ?? [],
    promoCodes: s.promoCodes ?? [],
    promotions: s.promotions ?? [],
    log: s.log ?? [],
  } as DemoState;
}

// ---------------------------------------------------------------- auth

export function login(state: DemoState, role: Role, loginName: string, password: string): ActionResult {
  const u = state.users.find((x) => x.login === loginName.trim().toLowerCase() && x.password === password);
  if (!u) return fail(state, "Login yoki parol noto‘g‘ri");
  if (u.role !== role) return fail(state, role === "admin" ? "Bu hisob admin emas" : "Admin hisobi bilan foydalanuvchi paneliga kirib bo‘lmaydi");
  const s = clone(state);
  s.sessions[role] = u.id;
  addLog(s, u.name, role === "admin" ? "Admin panelga kirdi" : "Tizimga kirdi");
  return { state: s, ok: true, message: `Xush kelibsiz, ${u.name}` };
}

export function logout(state: DemoState, role: Role): ActionResult {
  const s = clone(state);
  s.sessions[role] = null;
  return { state: s, ok: true, message: "Tizimdan chiqdingiz" };
}

export function currentUser(state: DemoState, role: Role): DemoUser | null {
  const id = state.sessions[role];
  return state.users.find((u) => u.id === id && u.role === role) ?? null;
}

// ---------------------------------------------------------------- pricing

export function hasFreeRight(state: DemoState, userId: string): boolean {
  if (!state.settings.monetizationEnabled) return true;
  if (!state.settings.freeFirstEnabled) return false;
  return !state.listings.some((l) => l.userId === userId && l.billing === "free" && l.moderation !== "rejected");
}

export function activePromotion(state: DemoState, target: "listing" | "status"): Promotion | null {
  const now = nowMs(state);
  const list = state.promotions
    .filter((p) => p.active && (p.target === "all" || p.target === target))
    .filter((p) => Date.parse(p.startsAt) <= now && now <= Date.parse(p.endsAt))
    .sort((a, b) => b.percent - a.percent);
  return list[0] ?? null;
}

export type PromoCheck = { ok: true; promo: PromoCode } | { ok: false; reason: string };

export function checkPromo(state: DemoState, code: string, target: "listing" | "status"): PromoCheck {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, reason: "Promokod kiritilmagan" };
  const promo = state.promoCodes.find((p) => p.code.toUpperCase() === c);
  if (!promo) return { ok: false, reason: "Bunday promokod topilmadi" };
  if (!promo.active) return { ok: false, reason: "Promokod o‘chirilgan" };
  const now = nowMs(state);
  if (now < Date.parse(promo.validFrom)) return { ok: false, reason: "Promokod hali boshlanmagan" };
  if (now > Date.parse(promo.validTo)) return { ok: false, reason: "Promokod muddati tugagan" };
  if (promo.usageLimit > 0 && promo.used >= promo.usageLimit) return { ok: false, reason: "Promokoddan foydalanish limiti tugagan" };
  if (promo.target !== "all" && promo.target !== target) {
    return { ok: false, reason: promo.target === "listing" ? "Bu promokod faqat e’lon uchun" : "Bu promokod faqat status uchun" };
  }
  return { ok: true, promo };
}

export interface Quote {
  base: number;
  promotion: Promotion | null;
  promotionDiscount: number;
  promo: PromoCode | null;
  promoDiscount: number;
  promoError: string | null;
  total: number;
  free: boolean;
}

export function quote(state: DemoState, base: number, target: "listing" | "status", promoCode?: string, free = false): Quote {
  if (free) {
    return { base: 0, promotion: null, promotionDiscount: 0, promo: null, promoDiscount: 0, promoError: null, total: 0, free: true };
  }
  const promotion = activePromotion(state, target);
  const promotionDiscount = promotion ? Math.round((base * promotion.percent) / 100) : 0;
  let rest = base - promotionDiscount;
  let promo: PromoCode | null = null;
  let promoDiscount = 0;
  let promoError: string | null = null;
  if (promoCode && promoCode.trim()) {
    const chk = checkPromo(state, promoCode, target);
    if (chk.ok) {
      promo = chk.promo;
      promoDiscount = promo.kind === "percent" ? Math.round((rest * promo.value) / 100) : Math.min(promo.value, rest);
      rest -= promoDiscount;
    } else promoError = chk.reason;
  }
  return { base, promotion, promotionDiscount, promo, promoDiscount, promoError, total: Math.max(0, rest), free: false };
}

export function listingQuote(state: DemoState, userId: string, plan: ListingPlanId, promoCode?: string): Quote {
  const free = plan === "standard" && hasFreeRight(state, userId);
  const base = state.settings.monetizationEnabled ? state.settings.plans[plan].price : 0;
  if (!state.settings.monetizationEnabled) return quote(state, 0, "listing", undefined, true);
  return quote(state, base, "listing", promoCode, free);
}

export function statusQuote(state: DemoState, type: StatusType, days: StatusDays, promoCode?: string): Quote {
  return quote(state, state.settings.statusPrices[type][days], "status", promoCode);
}

// ---------------------------------------------------------------- listings

export interface ListingInput {
  title: string;
  dealType: Listing["dealType"];
  propertyType: Listing["propertyType"];
  price: number;
  currency: Listing["currency"];
  rooms: number | null;
  area: number | null;
  location: string;
  description: string;
  phone: string;
  photos: string[];
}

export function validateListingInput(input: ListingInput): string | null {
  if (!input.title || input.title.trim().length < 3) return "Sarlavha kamida 3 ta belgi bo‘lsin";
  if (!input.location || input.location.trim().length < 2) return "Manzilni kiriting";
  if (!Number.isFinite(input.price) || input.price <= 0) return "Narxni to‘g‘ri kiriting";
  if (!/^\+?[0-9 ()-]{9,20}$/.test(input.phone.trim())) return "Telefon raqamini to‘g‘ri kiriting";
  if (input.photos.length > 4) return "Ko‘pi bilan 4 ta rasm";
  return null;
}

function makeOrder(s: DemoState, userId: string, kind: Order["kind"], targetId: string, title: string, q: Quote): Order {
  return {
    id: newId("o"),
    userId,
    kind,
    targetId,
    title,
    baseAmount: q.base,
    promotionId: q.promotion?.id ?? null,
    promotionDiscount: q.promotionDiscount,
    promoCode: q.promo?.code ?? null,
    promoDiscount: q.promoDiscount,
    amount: q.total,
    paymentStatus: "pending",
    refundStatus: "none",
    refundNote: null,
    attempts: [],
    createdAt: nowIso(s),
    paidAt: null,
    refundedAt: null,
  };
}

/** Marks an order paid and pushes its target forward (moderation / admin approval). */
function settlePaid(s: DemoState, order: Order, how: string) {
  order.paymentStatus = "paid";
  order.paidAt = nowIso(s);
  if (order.promoCode) {
    const p = s.promoCodes.find((x) => x.code === order.promoCode);
    if (p) p.used += 1;
  }
  if (order.kind === "listing") {
    const l = s.listings.find((x) => x.id === order.targetId);
    if (l && l.moderation === "not_submitted") {
      l.moderation = "pending";
      l.submittedAt = nowIso(s);
      l.history.push({ at: nowIso(s), text: `${how}; moderatsiyaga yuborildi` });
    }
  } else {
    const so = s.statusOrders.find((x) => x.id === order.targetId);
    if (so && so.state === "awaiting_payment") so.state = "pending_approval";
  }
}

export function createListing(state: DemoState, userId: string, input: ListingInput, plan: ListingPlanId, promoCode?: string): ActionResult {
  const user = state.users.find((u) => u.id === userId && u.role === "user");
  if (!user) return fail(state, "Avval demo foydalanuvchi sifatida kiring");
  const err = validateListingInput(input);
  if (err) return fail(state, err);
  const q = listingQuote(state, userId, plan, promoCode);
  if (q.promoError) return fail(state, q.promoError);
  const s = clone(state);
  const listing: Listing = {
    id: newId("l"),
    userId,
    ...input,
    title: input.title.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
    phone: input.phone.trim(),
    plan,
    billing: q.free ? "free" : "paid",
    orderId: null,
    moderation: "not_submitted",
    rejectReason: null,
    revisionNote: null,
    createdAt: nowIso(s),
    submittedAt: null,
    decidedAt: null,
    history: [{ at: nowIso(s), text: "E’lon yaratildi" }],
  };
  s.listings.unshift(listing);
  if (q.free) {
    listing.moderation = "pending";
    listing.submittedAt = nowIso(s);
    listing.history.push({ at: nowIso(s), text: s.settings.monetizationEnabled ? "Bepul e’lon huquqi ishlatildi; moderatsiyaga yuborildi" : "Monetizatsiya o‘chiq: bepul; moderatsiyaga yuborildi" });
    addLog(s, user.name, `Bepul e’lon yubordi: ${listing.title}`);
    return { state: s, ok: true, message: "E’lon bepul joylandi va moderatsiyaga yuborildi", listingId: listing.id };
  }
  const order = makeOrder(s, userId, "listing", listing.id, `E’lon: ${listing.title} (${s.settings.plans[plan].nameUz})`, q);
  listing.orderId = order.id;
  s.orders.unshift(order);
  if (order.amount === 0) {
    settlePaid(s, order, "Chegirma 100%: to‘lov talab qilinmadi");
    addLog(s, user.name, `E’lon 100% chegirma bilan yuborildi: ${listing.title}`);
    return { state: s, ok: true, message: "Chegirma 100%: e’lon to‘lovsiz moderatsiyaga yuborildi", listingId: listing.id, orderId: order.id };
  }
  addLog(s, user.name, `Pullik e’lon uchun buyurtma: ${formatSum(order.amount)}`);
  return { state: s, ok: true, message: `Buyurtma yaratildi: ${formatSum(order.amount)}. Demo to‘lov sahifasiga o‘ting`, listingId: listing.id, orderId: order.id };
}

/** After "revision requested": the owner edits the listing and sends it back; no new payment. */
export function resubmitListing(state: DemoState, userId: string, listingId: string, input: ListingInput): ActionResult {
  const l = state.listings.find((x) => x.id === listingId && x.userId === userId);
  if (!l) return fail(state, "E’lon topilmadi");
  if (l.moderation !== "revision") return fail(state, "Bu e’lonni hozir tahrirlab bo‘lmaydi");
  const err = validateListingInput(input);
  if (err) return fail(state, err);
  const s = clone(state);
  const m = s.listings.find((x) => x.id === listingId)!;
  Object.assign(m, input, { title: input.title.trim(), location: input.location.trim(), description: input.description.trim(), phone: input.phone.trim() });
  m.moderation = "pending";
  m.submittedAt = nowIso(s);
  m.history.push({ at: nowIso(s), text: "Tuzatildi va qayta moderatsiyaga yuborildi" });
  addLog(s, "Foydalanuvchi", `E’lon qayta yuborildi: ${m.title}`);
  return { state: s, ok: true, message: "E’lon tuzatildi va qayta moderatsiyaga yuborildi", listingId };
}

// ---------------------------------------------------------------- payment (demo only)

export function payOrder(state: DemoState, orderId: string, outcome: "success" | "failed" | "cancelled", actorUserId: string): ActionResult {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o) return fail(state, "Buyurtma topilmadi");
  if (o.userId !== actorUserId) return fail(state, "Bu buyurtma boshqa foydalanuvchiga tegishli");
  if (o.paymentStatus === "paid") return fail(state, "Bu buyurtma allaqachon to‘langan (ikki marta to‘lab bo‘lmaydi)");
  if (o.amount <= 0) return fail(state, "Bu buyurtma uchun to‘lov talab qilinmaydi");
  const s = clone(state);
  const order = s.orders.find((x) => x.id === orderId)!;
  order.attempts.push({ at: nowIso(s), outcome });
  if (outcome === "success") {
    // Re-check the promo limit at payment time (another payment may have used it).
    if (order.promoCode) {
      const p = s.promoCodes.find((x) => x.code === order.promoCode);
      if (p && p.usageLimit > 0 && p.used >= p.usageLimit) {
        order.attempts[order.attempts.length - 1].outcome = "failed";
        order.paymentStatus = "failed";
        return { state: s, ok: false, message: "Promokod limiti tugagan: buyurtmani qaytadan yarating", orderId };
      }
    }
    settlePaid(s, order, "Demo to‘lov muvaffaqiyatli");
    addLog(s, "Demo to‘lov", `To‘landi: ${order.title} — ${formatSum(order.amount)}`);
    const next = order.kind === "listing" ? "E’lon moderatsiyaga yuborildi" : "Status admin tasdig‘ini kutmoqda";
    return { state: s, ok: true, message: `To‘lov muvaffaqiyatli (DEMO). ${next}`, orderId };
  }
  order.paymentStatus = outcome;
  addLog(s, "Demo to‘lov", `${outcome === "failed" ? "To‘lov o‘tmadi" : "To‘lov bekor qilindi"}: ${order.title}`);
  return {
    state: s,
    ok: true,
    message: outcome === "failed" ? "To‘lov amalga oshmadi (DEMO). Qayta urinib ko‘rishingiz mumkin" : "To‘lov bekor qilindi (DEMO). E’lon moderatsiyaga yuborilmadi",
    orderId,
  };
}

// ---------------------------------------------------------------- status purchase

export function createStatusOrder(state: DemoState, userId: string, listingId: string, type: StatusType, days: StatusDays, promoCode?: string): ActionResult {
  const l = state.listings.find((x) => x.id === listingId && x.userId === userId);
  if (!l) return fail(state, "E’lon topilmadi");
  if (l.moderation !== "approved") return fail(state, "Status faqat tasdiqlangan e’lon uchun sotib olinadi");
  if (!STATUS_TYPES.includes(type) || !STATUS_DAYS.includes(days)) return fail(state, "Status yoki muddat noto‘g‘ri");
  const busy = state.statusOrders.some(
    (x) => x.listingId === listingId && x.type === type && (x.state === "awaiting_payment" || x.state === "pending_approval" || (x.state === "active" && statusPhase(state, x) === "active"))
  );
  if (busy) return fail(state, "Bu e’londa shu status allaqachon bor yoki kutilmoqda");
  const q = statusQuote(state, type, days, promoCode);
  if (q.promoError) return fail(state, q.promoError);
  const s = clone(state);
  const so: StatusOrder = {
    id: newId("s"), userId, listingId, type, days, orderId: null, state: "awaiting_payment", source: "purchase",
    rejectReason: null, createdAt: nowIso(s), approvedAt: null, startsAt: null, endsAt: null,
  };
  s.statusOrders.unshift(so);
  const order = makeOrder(s, userId, "status", so.id, `Status: ${STATUS_NAMES[type].uz} ${days} kun — ${l.title}`, q);
  so.orderId = order.id;
  s.orders.unshift(order);
  if (order.amount === 0) {
    settlePaid(s, order, "Chegirma 100%");
    return { state: s, ok: true, message: "Chegirma 100%: status admin tasdig‘iga yuborildi", orderId: order.id };
  }
  addLog(s, "Foydalanuvchi", `Status buyurtmasi: ${order.title}`);
  return { state: s, ok: true, message: `Status buyurtmasi yaratildi: ${formatSum(order.amount)}`, orderId: order.id };
}

export const STATUS_NAMES: Record<StatusType, { uz: string; ru: string }> = {
  top: { uz: "TOP", ru: "ТОП" },
  tez_sotiladi: { uz: "Tez sotiladi", ru: "Срочно" },
  yaxshi_taklif: { uz: "Yaxshi taklif", ru: "Выгодно" },
};

export type StatusPhase = StatusOrderState | "expired";

/** The real phase of a status at "now" (an active status whose end passed is expired). */
export function statusPhase(state: DemoState, so: StatusOrder): StatusPhase {
  if (so.state === "active" && so.endsAt && Date.parse(so.endsAt) <= nowMs(state)) return "expired";
  return so.state;
}

export function activeStatusesFor(state: DemoState, listingId: string): StatusOrder[] {
  return state.statusOrders.filter((x) => x.listingId === listingId && statusPhase(state, x) === "active");
}

// ---------------------------------------------------------------- admin: moderation

function requireAdmin(state: DemoState, adminId: string): DemoUser | null {
  return state.users.find((u) => u.id === adminId && u.role === "admin") ?? null;
}

function openRefund(s: DemoState, orderId: string | null, why: string) {
  if (!orderId) return false;
  const o = s.orders.find((x) => x.id === orderId);
  if (!o || o.paymentStatus !== "paid" || o.amount <= 0 || o.refundStatus !== "none") return false;
  o.refundStatus = "requested";
  o.refundNote = why;
  return true;
}

export function approveListing(state: DemoState, adminId: string, listingId: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  const l = state.listings.find((x) => x.id === listingId);
  if (!l) return fail(state, "E’lon topilmadi");
  if (l.moderation !== "pending") return fail(state, "Faqat moderatsiyadagi e’lon tasdiqlanadi");
  const s = clone(state);
  const m = s.listings.find((x) => x.id === listingId)!;
  m.moderation = "approved";
  m.decidedAt = nowIso(s);
  m.rejectReason = null;
  m.revisionNote = null;
  m.history.push({ at: nowIso(s), text: "Admin tasdiqladi — e’lon ommaga chiqdi" });
  let extra = "";
  const bonusDays = s.settings.plans[m.plan]?.bonusTopDays ?? 0;
  if (m.plan === "premium" && m.billing === "paid" && bonusDays > 0 && !s.statusOrders.some((x) => x.listingId === m.id && x.source === "premium_bonus")) {
    const start = nowMs(s);
    s.statusOrders.unshift({
      id: newId("s"), userId: m.userId, listingId: m.id, type: "top", days: bonusDays, orderId: m.orderId, state: "active", source: "premium_bonus",
      rejectReason: null, createdAt: nowIso(s), approvedAt: nowIso(s), startsAt: new Date(start).toISOString(), endsAt: new Date(start + bonusDays * DAY).toISOString(),
    });
    extra = ` Premium: TOP ${bonusDays} kun shu daqiqadan boshlandi.`;
  }
  addLog(s, admin.name, `Tasdiqladi: ${m.title}`);
  return { state: s, ok: true, message: `E’lon tasdiqlandi va saytda ko‘rinadi.${extra}` };
}

export function rejectListing(state: DemoState, adminId: string, listingId: string, reason: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  if (!reason.trim()) return fail(state, "Rad etish sababini yozing");
  const l = state.listings.find((x) => x.id === listingId);
  if (!l) return fail(state, "E’lon topilmadi");
  if (l.moderation !== "pending" && l.moderation !== "approved" && l.moderation !== "revision") return fail(state, "Bu holatdagi e’lonni rad etib bo‘lmaydi");
  const s = clone(state);
  const m = s.listings.find((x) => x.id === listingId)!;
  m.moderation = "rejected";
  m.rejectReason = reason.trim();
  m.decidedAt = nowIso(s);
  m.history.push({ at: nowIso(s), text: `Rad etildi: ${reason.trim()}` });
  // Stop its statuses.
  s.statusOrders.forEach((x) => {
    if (x.listingId === m.id && (x.state === "active" || x.state === "pending_approval")) {
      if (x.state === "pending_approval") openRefund(s, x.orderId, "E’lon rad etildi, status bekor qilindi");
      x.state = "cancelled";
    }
  });
  let msg = "E’lon rad etildi.";
  if (m.billing === "paid" && openRefund(s, m.orderId, `E’lon rad etildi: ${reason.trim()}`)) msg += " To‘langan summa uchun qaytarish so‘rovi ochildi.";
  if (m.billing === "free") msg += " Foydalanuvchiga bepul e’lon huquqi qaytdi.";
  addLog(s, admin.name, `Rad etdi: ${m.title} (${reason.trim()})`);
  return { state: s, ok: true, message: msg };
}

export function requestRevision(state: DemoState, adminId: string, listingId: string, note: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  if (!note.trim()) return fail(state, "Nimani tuzatish kerakligini yozing");
  const l = state.listings.find((x) => x.id === listingId);
  if (!l || l.moderation !== "pending") return fail(state, "Faqat moderatsiyadagi e’lon uchun");
  const s = clone(state);
  const m = s.listings.find((x) => x.id === listingId)!;
  m.moderation = "revision";
  m.revisionNote = note.trim();
  m.history.push({ at: nowIso(s), text: `Tuzatish so‘raldi: ${note.trim()}` });
  addLog(s, admin.name, `Tuzatish so‘radi: ${m.title}`);
  return { state: s, ok: true, message: "Foydalanuvchidan tuzatish so‘raldi" };
}

// ---------------------------------------------------------------- admin: statuses

export function approveStatus(state: DemoState, adminId: string, statusId: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  const so = state.statusOrders.find((x) => x.id === statusId);
  if (!so) return fail(state, "Status topilmadi");
  if (so.state !== "pending_approval") return fail(state, "Faqat to‘langan va kutilayotgan status tasdiqlanadi");
  const l = state.listings.find((x) => x.id === so.listingId);
  if (!l || l.moderation !== "approved") return fail(state, "E’lon tasdiqlanmagan");
  const s = clone(state);
  const m = s.statusOrders.find((x) => x.id === statusId)!;
  const start = nowMs(s);
  m.state = "active";
  m.approvedAt = new Date(start).toISOString();
  m.startsAt = m.approvedAt;
  m.endsAt = new Date(start + m.days * DAY).toISOString();
  addLog(s, admin.name, `Status tasdiqlandi: ${STATUS_NAMES[m.type].uz} ${m.days} kun`);
  return { state: s, ok: true, message: `Status faollashdi: ${m.days} kun shu daqiqadan hisoblanadi` };
}

export function rejectStatus(state: DemoState, adminId: string, statusId: string, reason: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  if (!reason.trim()) return fail(state, "Sababini yozing");
  const so = state.statusOrders.find((x) => x.id === statusId);
  if (!so || so.state !== "pending_approval") return fail(state, "Faqat kutilayotgan status rad etiladi");
  const s = clone(state);
  const m = s.statusOrders.find((x) => x.id === statusId)!;
  m.state = "rejected";
  m.rejectReason = reason.trim();
  const refund = openRefund(s, m.orderId, `Status rad etildi: ${reason.trim()}`);
  addLog(s, admin.name, `Status rad etildi: ${reason.trim()}`);
  return { state: s, ok: true, message: `Status rad etildi.${refund ? " Qaytarish so‘rovi ochildi." : ""}` };
}

// ---------------------------------------------------------------- admin: refunds

export function decideRefund(state: DemoState, adminId: string, orderId: string, decision: "refunded" | "declined"): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.refundStatus !== "requested") return fail(state, "Qaytarish so‘rovi yo‘q");
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.refundStatus = decision;
  if (decision === "refunded") m.refundedAt = nowIso(s);
  addLog(s, admin.name, `${decision === "refunded" ? "Pul qaytarildi (DEMO)" : "Qaytarish rad etildi"}: ${m.title}`);
  return { state: s, ok: true, message: decision === "refunded" ? "Qaytarish bajarildi deb belgilandi (DEMO, haqiqiy pul o‘tkazilmadi)" : "Qaytarish rad etildi" };
}

// ---------------------------------------------------------------- admin: settings, promo, promotions

export function updateSettings(state: DemoState, adminId: string, patch: Partial<Pick<Settings, "monetizationEnabled" | "freeFirstEnabled">> & {
  planPrices?: Partial<Record<ListingPlanId, number>>;
  premiumBonusDays?: number;
  statusPrices?: Partial<Record<StatusType, Partial<Record<StatusDays, number>>>>;
}): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  const okMoney = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100_000_000;
  const s = clone(state);
  if (patch.monetizationEnabled !== undefined) s.settings.monetizationEnabled = Boolean(patch.monetizationEnabled);
  if (patch.freeFirstEnabled !== undefined) s.settings.freeFirstEnabled = Boolean(patch.freeFirstEnabled);
  for (const [k, v] of Object.entries(patch.planPrices ?? {})) {
    if (!okMoney(v)) return fail(state, "Narx 0 dan katta butun son bo‘lsin");
    s.settings.plans[k as ListingPlanId].price = Math.round(v as number);
  }
  if (patch.premiumBonusDays !== undefined) {
    if (!Number.isInteger(patch.premiumBonusDays) || patch.premiumBonusDays < 0 || patch.premiumBonusDays > 60) return fail(state, "Bonus kunlari 0–60");
    s.settings.plans.premium.bonusTopDays = patch.premiumBonusDays;
  }
  for (const [type, byDays] of Object.entries(patch.statusPrices ?? {})) {
    for (const [d, v] of Object.entries(byDays ?? {})) {
      if (!okMoney(v)) return fail(state, "Status narxi noto‘g‘ri");
      s.settings.statusPrices[type as StatusType][Number(d) as StatusDays] = Math.round(v as number);
    }
  }
  addLog(s, admin.name, "Sozlamalar o‘zgartirildi");
  return { state: s, ok: true, message: "Sozlamalar saqlandi — yangi narxlar foydalanuvchiga darhol ko‘rinadi" };
}

export function shiftClock(state: DemoState, adminId: string, days: number | "reset"): ActionResult {
  if (!requireAdmin(state, adminId)) return fail(state, "Faqat admin");
  const s = clone(state);
  s.settings.clockOffsetMs = days === "reset" ? 0 : s.settings.clockOffsetMs + days * DAY;
  return { state: s, ok: true, message: days === "reset" ? "Demo soati haqiqiy vaqtga qaytarildi" : `Demo soati ${days} kun oldinga surildi` };
}

export type PromoInput = Omit<PromoCode, "id" | "used">;

export function validatePromo(state: DemoState, input: PromoInput, ignoreId?: string): string | null {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return "Kod 3–20 ta lotin harf/raqam bo‘lsin";
  if (state.promoCodes.some((p) => p.code.toUpperCase() === code && p.id !== ignoreId)) return "Bunday kod bor";
  if (!Number.isFinite(input.value) || input.value <= 0) return "Qiymat 0 dan katta bo‘lsin";
  if (input.kind === "percent" && input.value > 100) return "Foiz 100 dan oshmasin";
  if (!(Date.parse(input.validFrom) < Date.parse(input.validTo))) return "Boshlanish sanasi tugashdan oldin bo‘lsin";
  if (!Number.isInteger(input.usageLimit) || input.usageLimit < 0) return "Limit 0 yoki musbat butun son (0 = cheksiz)";
  return null;
}

export function savePromo(state: DemoState, adminId: string, input: PromoInput, id?: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  const err = validatePromo(state, input, id);
  if (err) return fail(state, err);
  const s = clone(state);
  const clean = { ...input, code: input.code.trim().toUpperCase(), value: Math.round(input.value) };
  if (id) {
    const p = s.promoCodes.find((x) => x.id === id);
    if (!p) return fail(state, "Promokod topilmadi");
    Object.assign(p, clean);
  } else s.promoCodes.unshift({ ...clean, id: newId("p"), used: 0 });
  addLog(s, admin.name, `Promokod saqlandi: ${clean.code}`);
  return { state: s, ok: true, message: `Promokod saqlandi: ${clean.code}` };
}

export function togglePromo(state: DemoState, adminId: string, id: string): ActionResult {
  if (!requireAdmin(state, adminId)) return fail(state, "Faqat admin");
  const s = clone(state);
  const p = s.promoCodes.find((x) => x.id === id);
  if (!p) return fail(state, "Promokod topilmadi");
  p.active = !p.active;
  return { state: s, ok: true, message: `${p.code}: ${p.active ? "yoqildi" : "o‘chirildi"}` };
}

export type PromotionInput = Omit<Promotion, "id">;

export function savePromotion(state: DemoState, adminId: string, input: PromotionInput, id?: string): ActionResult {
  const admin = requireAdmin(state, adminId);
  if (!admin) return fail(state, "Faqat admin");
  if (input.name.trim().length < 2) return fail(state, "Aksiya nomini yozing");
  if (!Number.isFinite(input.percent) || input.percent <= 0 || input.percent > 90) return fail(state, "Chegirma 1–90%");
  if (!(Date.parse(input.startsAt) < Date.parse(input.endsAt))) return fail(state, "Boshlanish sanasi tugashdan oldin bo‘lsin");
  const s = clone(state);
  const clean = { ...input, name: input.name.trim(), description: input.description.trim(), percent: Math.round(input.percent) };
  if (id) {
    const p = s.promotions.find((x) => x.id === id);
    if (!p) return fail(state, "Aksiya topilmadi");
    Object.assign(p, clean);
  } else s.promotions.unshift({ ...clean, id: newId("a") });
  addLog(s, admin.name, `Aksiya saqlandi: ${clean.name}`);
  return { state: s, ok: true, message: `Aksiya saqlandi: ${clean.name}` };
}

export function togglePromotion(state: DemoState, adminId: string, id: string): ActionResult {
  if (!requireAdmin(state, adminId)) return fail(state, "Faqat admin");
  const s = clone(state);
  const p = s.promotions.find((x) => x.id === id);
  if (!p) return fail(state, "Aksiya topilmadi");
  p.active = !p.active;
  return { state: s, ok: true, message: `${p.name}: ${p.active ? "faollashtirildi" : "to‘xtatildi"}` };
}

export function promotionPhase(state: DemoState, p: Promotion): "running" | "scheduled" | "ended" | "off" {
  if (!p.active) return "off";
  const now = nowMs(state);
  if (now < Date.parse(p.startsAt)) return "scheduled";
  if (now > Date.parse(p.endsAt)) return "ended";
  return "running";
}

// ---------------------------------------------------------------- public view

export interface PublicListing {
  listing: Listing;
  statuses: StatusOrder[];
  isTop: boolean;
}

/** Approved listings only, with running statuses; TOP first, then newest. */
export function publicListings(state: DemoState): PublicListing[] {
  return state.listings
    .filter((l) => l.moderation === "approved")
    .map((listing) => {
      const statuses = activeStatusesFor(state, listing.id);
      return { listing, statuses, isTop: statuses.some((x) => x.type === "top") };
    })
    .sort((a, b) => Number(b.isTop) - Number(a.isTop) || Date.parse(b.listing.decidedAt || b.listing.createdAt) - Date.parse(a.listing.decidedAt || a.listing.createdAt));
}

export function stats(state: DemoState) {
  const paid = state.orders.filter((o) => o.paymentStatus === "paid");
  const refunded = state.orders.filter((o) => o.refundStatus === "refunded");
  return {
    pendingModeration: state.listings.filter((l) => l.moderation === "pending").length,
    pendingStatuses: state.statusOrders.filter((x) => x.state === "pending_approval").length,
    refundRequests: state.orders.filter((o) => o.refundStatus === "requested").length,
    approved: state.listings.filter((l) => l.moderation === "approved").length,
    revenue: paid.reduce((a, o) => a + o.amount, 0) - refunded.reduce((a, o) => a + o.amount, 0),
    paidCount: paid.length,
  };
}
