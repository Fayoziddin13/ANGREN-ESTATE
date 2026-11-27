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
 *  - Payment is a MANUAL CARD TRANSFER: the user sees the card the admin set,
 *    transfers the amount in a bank app and uploads the receipt; only the
 *    admin can mark the order paid after checking the bank. The user can never
 *    change the payment status beyond "receipt sent" or "cancel my order".
 *    In this demo the card is fake and no money moves.
 */

export const DEMO_STATE_VERSION = 3;
export const DEMO_STORAGE_KEY = "angren_demo_v1";

export type Locale = "uz" | "ru";
export type Role = "user" | "admin";
export type ListingPlanId = "standard" | "premium";
export type StatusType = "top" | "tez_sotiladi" | "yaxshi_taklif";
export type StatusDays = 3 | 7 | 30;
export const STATUS_TYPES: StatusType[] = ["top", "tez_sotiladi", "yaxshi_taklif"];
export const STATUS_DAYS: StatusDays[] = [3, 7, 30];

export type Moderation = "not_submitted" | "pending" | "approved" | "rejected" | "revision";
/**
 * Payment status describes ONLY the payment. A refund never changes it: once an
 * order is `paid` it stays `paid`, and the refund lives in `order.refund`.
 */
export type PaymentStatus =
  | "awaiting_payment"
  | "receipt_submitted"
  | "under_review"
  | "info_requested"
  | "paid"
  | "rejected"
  | "cancelled";
export const isPaidLike = (s: PaymentStatus) => s === "paid";
/** The user may (re)send a receipt or cancel only in these states. */
export const USER_PAYABLE: PaymentStatus[] = ["awaiting_payment", "info_requested", "rejected"];
/** Orders in these states hold (reserve) their promo code use. */
export const PROMO_HOLDING: PaymentStatus[] = ["awaiting_payment", "receipt_submitted", "under_review", "info_requested", "rejected"];
export type RefundStatus = "requested" | "refunded" | "declined";
export interface Refund {
  status: RefundStatus;
  amount: number;
  reason: string;
  requestedAt: string;
  requestedBy: string;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
}
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
  /**
   * What the plan gives, set by the admin (shown to the user when choosing).
   * Premium never includes TOP: TOP is always bought separately.
   */
  features: string[];
}

export interface Settings {
  monetizationEnabled: boolean;
  freeFirstEnabled: boolean;
  plans: Record<ListingPlanId, ListingPlan>;
  statusPrices: Record<StatusType, Record<StatusDays, number>>;
  /** Demo-only clock shift so expiry can be tested without waiting days. */
  clockOffsetMs: number;
  paymentCard: PaymentCard;
}

export interface PaymentCard {
  enabled: boolean;
  cardNumber: string; // 16 digits, stored without spaces
  holder: string;
  bank: string;
  instructions: string;
}

export interface Receipt {
  id: string;
  /** SHA-256 of the original file bytes: the same receipt cannot be used twice. */
  hash: string;
  fileName: string;
  /** Type of the ORIGINAL file (detected from its bytes). */
  mime: "image/jpeg" | "image/png" | "application/pdf";
  size: number;
  /** File content (images are shrunk). Shown only in the admin panel. */
  dataUrl: string;
  /** Type of what is stored in dataUrl (images are re-encoded as JPEG). */
  storedMime: "image/jpeg" | "application/pdf";
  note: string;
  submittedAt: string;
  /** The card the user was shown when sending this receipt. */
  card: { last4: string; holder: string; bank: string } | null;
}

export interface Review {
  at: string;
  adminId: string;
  decision: "started" | "approved" | "rejected" | "info_requested";
  note: string | null;
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
  receipts: Receipt[];
  reviews: Review[];
  /** Last admin rejection reason or info request, shown to the user. */
  adminNote: string | null;
  submittedAt: string | null;
  /** Refund is stored apart from the payment (null = no refund). */
  refund: Refund | null;
  events: { at: string; actor: string; text: string }[];
  createdAt: string;
  paidAt: string | null;
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
  source: "purchase";
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

export const LOG_LIMIT = 2000;

function addLog(s: DemoState, actor: string, text: string) {
  s.log.unshift({ at: nowIso(s), actor, text });
  if (s.log.length > LOG_LIMIT) s.log.length = LOG_LIMIT;
}

export function formatSum(value: number, locale: Locale = "uz"): string {
  const n = Math.round(Number(value) || 0);
  return `${n.toLocaleString("ru-RU").replace(/[ ,]/g, " ")} ${locale === "uz" ? "so‘m" : "сум"}`;
}

// ---------------------------------------------------------------- seed

/** A deliberately fake card: the demo never shows a real card number. */
export const DEMO_CARD: PaymentCard = {
  enabled: true,
  cardNumber: "0000111122223333",
  holder: "DEMO KARTA EGASI",
  bank: "Demo bank",
  instructions: "Bank ilovasida summani aniq o‘tkazing, izohga buyurtma ID ni yozing, so‘ng chekni shu sahifaga yuklang.",
};

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
        standard: { id: "standard", nameUz: "Standart", nameRu: "Стандарт", price: 50000, features: ["Oddiy e’lon", "Moderatsiyadan keyin saytda chiqadi"] },
        premium: {
          id: "premium",
          nameUz: "Premium",
          nameRu: "Премиум",
          price: 120000,
          features: ["Premium belgisi e’lon kartasida", "Moderatsiyadan keyin saytda chiqadi"],
        },
      },
      statusPrices: {
        top: { 3: 15000, 7: 30000, 30: 90000 },
        tez_sotiladi: { 3: 10000, 7: 20000, 30: 60000 },
        yaxshi_taklif: { 3: 8000, 7: 16000, 30: 45000 },
      },
      clockOffsetMs: 0,
      paymentCard: { ...DEMO_CARD },
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
    settings: { ...seed.settings, ...s.settings, paymentCard: { ...seed.settings.paymentCard, ...(s.settings?.paymentCard ?? {}) } },
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
  // Uses already paid + uses held by unpaid orders (reserved when the order is created).
  if (promo.usageLimit > 0 && promo.used + promoHeld(state, promo.code) >= promo.usageLimit) {
    return { ok: false, reason: "Promokoddan foydalanish limiti tugagan" };
  }
  if (promo.target !== "all" && promo.target !== target) {
    return { ok: false, reason: promo.target === "listing" ? "Bu promokod faqat e’lon uchun" : "Bu promokod faqat status uchun" };
  }
  return { ok: true, promo };
}

/** How many unpaid orders currently hold this promo code. */
export function promoHeld(state: DemoState, code: string, exceptOrderId?: string): number {
  return state.orders.filter((o) => o.promoCode === code && o.id !== exceptOrderId && PROMO_HOLDING.includes(o.paymentStatus)).length;
}

export interface Quote {
  base: number;
  promotion: Promotion | null;
  promotionDiscount: number;
  promo: PromoCode | null;
  promoDiscount: number;
  promoError: string | null;
  /** A valid promo code that was not used because the running promotion gives more. */
  promoNotApplied: boolean;
  total: number;
  free: boolean;
}

/**
 * Price with the best single discount (same rule as the server, mon_quote):
 * a promotion and a promo code are never combined — the bigger one wins —
 * and at least 1 so‘m always stays payable.
 */
export function quote(state: DemoState, base: number, target: "listing" | "status", promoCode?: string, free = false): Quote {
  if (free) {
    return { base: 0, promotion: null, promotionDiscount: 0, promo: null, promoDiscount: 0, promoError: null, promoNotApplied: false, total: 0, free: true };
  }
  const cap = Math.max(0, base - 1);
  const running = activePromotion(state, target);
  const byPromotion = running ? Math.min(cap, Math.round((base * running.percent) / 100)) : 0;
  let code: PromoCode | null = null;
  let byCode = 0;
  let promoError: string | null = null;
  if (promoCode && promoCode.trim()) {
    const chk = checkPromo(state, promoCode, target);
    if (chk.ok) {
      code = chk.promo;
      byCode = Math.min(cap, code.kind === "percent" ? Math.round((base * code.value) / 100) : code.value);
    } else promoError = chk.reason;
  }
  const useCode = code !== null && byCode >= byPromotion && byCode > 0;
  const promotion = !useCode && byPromotion > 0 ? running : null;
  const promotionDiscount = promotion ? byPromotion : 0;
  const promoDiscount = useCode ? byCode : 0;
  return {
    base,
    promotion,
    promotionDiscount,
    promo: useCode ? code : null,
    promoDiscount,
    promoError,
    promoNotApplied: code !== null && !useCode,
    total: base - promotionDiscount - promoDiscount,
    free: false,
  };
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
    paymentStatus: "awaiting_payment",
    receipts: [],
    reviews: [],
    adminNote: null,
    submittedAt: null,
    refund: null,
    events: [{ at: nowIso(s), actor: "Tizim", text: `Buyurtma yaratildi: ${formatSum(q.total)}` }],
    createdAt: nowIso(s),
    paidAt: null,
  };
}

/**
 * Marks an order paid and pushes its target forward (listing -> moderation,
 * status -> admin approval). Returns false when the target can no longer be
 * served (e.g. the listing was rejected while the receipt was being checked);
 * the caller then opens a refund, because the money was received.
 */
function settlePaid(s: DemoState, order: Order, how: string): boolean {
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
      return true;
    }
    return false;
  }
  const so = s.statusOrders.find((x) => x.id === order.targetId);
  const listing = so ? s.listings.find((x) => x.id === so.listingId) : null;
  if (so && so.state === "awaiting_payment" && listing?.moderation === "approved") {
    so.state = "pending_approval";
    return true;
  }
  if (so && so.state === "awaiting_payment") so.state = "cancelled";
  return false;
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
  return { state: s, ok: true, message: `Buyurtma yaratildi: ${formatSum(order.amount)}. Kartaga o‘tkazing va chekni yuklang`, listingId: listing.id, orderId: order.id };
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

/// ---------------------------------------------------------------- manual card payment

export const RECEIPT_LIMITS = {
  /** Original image size accepted before it is shrunk in the browser. */
  maxImageBytes: 10 * 1024 * 1024,
  /** PDFs are stored as they are, so they must stay small (localStorage). */
  maxPdfBytes: 1.5 * 1024 * 1024,
  /** What the demo stores after shrinking (base64 text of the file). */
  maxStoredChars: 2.2 * 1024 * 1024,
};

/** Detects the real file type from its first bytes (never from the name). */
export function sniffReceipt(bytes: Uint8Array): Receipt["mime"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 5 && [0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => bytes[i] === b)) return "application/pdf";
  return null;
}

/** Checks a file before it is stored: the real type must be JPG/PNG/PDF, match the declared type and fit the size limit. */
export function validateReceiptFile(
  file: { name: string; type: string; size: number },
  head: Uint8Array
): { ok: true; mime: Receipt["mime"] } | { ok: false; reason: string } {
  const mime = sniffReceipt(head);
  if (!mime) return { ok: false, reason: "Faqat JPG, PNG yoki PDF chek qabul qilinadi (fayl ichi tekshirildi)" };
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (declared && declared !== mime) return { ok: false, reason: "Fayl turi uning ichidagi ma’lumotga mos emas" };
  if (file.size <= 0) return { ok: false, reason: "Fayl bo‘sh" };
  const limit = mime === "application/pdf" ? RECEIPT_LIMITS.maxPdfBytes : RECEIPT_LIMITS.maxImageBytes;
  if (file.size > limit) return { ok: false, reason: mime === "application/pdf" ? "PDF chek 1.5 MB dan oshmasin" : "Rasm 10 MB dan oshmasin" };
  return { ok: true, mime };
}

function orderEvent(o: Order, s: DemoState, actor: string, text: string) {
  o.events.push({ at: nowIso(s), actor, text });
}

export type ReceiptInput = Omit<Receipt, "id" | "submittedAt" | "card">;

/** The user sends a transfer receipt. This is the only payment step the user can take. */
export function submitReceipt(state: DemoState, userId: string, orderId: string, input: ReceiptInput): ActionResult {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o) return fail(state, "Buyurtma topilmadi");
  if (o.userId !== userId) return fail(state, "Bu buyurtma boshqa foydalanuvchiga tegishli");
  if (!state.settings.paymentCard.enabled) return fail(state, "Kartaga to‘lov qabul qilish vaqtincha o‘chirilgan");
  if (o.amount <= 0) return fail(state, "Bu buyurtma uchun to‘lov talab qilinmaydi");
  if (isPaidLike(o.paymentStatus)) return fail(state, "Bu buyurtma allaqachon to‘langan");
  if (!USER_PAYABLE.includes(o.paymentStatus)) {
    return fail(state, o.paymentStatus === "cancelled" ? "Buyurtma bekor qilingan" : "Chek allaqachon yuborilgan, admin tekshirmoqda");
  }
  if (!["image/jpeg", "image/png", "application/pdf"].includes(input.mime)) return fail(state, "Faqat JPG, PNG yoki PDF");
  if (!/^[a-f0-9]{64}$/.test(input.hash)) return fail(state, "Chekni o‘qib bo‘lmadi");
  const expectedStored = input.mime === "application/pdf" ? "application/pdf" : "image/jpeg";
  if (input.storedMime !== expectedStored || !input.dataUrl.startsWith(`data:${expectedStored}`)) return fail(state, "Chek fayli buzilgan");
  const limit = input.mime === "application/pdf" ? RECEIPT_LIMITS.maxPdfBytes : RECEIPT_LIMITS.maxImageBytes;
  if (!(input.size > 0) || input.size > limit || input.dataUrl.length > RECEIPT_LIMITS.maxStoredChars) return fail(state, "Chek fayli juda katta");
  const used = state.orders.find((x) => x.receipts.some((r) => r.hash === input.hash));
  if (used) {
    return fail(state, used.id === orderId ? "Bu chek shu buyurtmaga allaqachon yuborilgan" : "Bu chek boshqa buyurtmada ishlatilgan — qayta ishlatib bo‘lmaydi");
  }
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.receipts.push({
    ...input,
    note: input.note.trim().slice(0, 500),
    fileName: input.fileName.slice(0, 120),
    id: newId("r"),
    submittedAt: nowIso(s),
    card: { last4: s.settings.paymentCard.cardNumber.slice(-4), holder: s.settings.paymentCard.holder, bank: s.settings.paymentCard.bank },
  });
  m.paymentStatus = "receipt_submitted";
  m.submittedAt = nowIso(s);
  m.adminNote = null;
  orderEvent(m, s, "Foydalanuvchi", `Chek yuborildi: ${input.fileName}`);
  addLog(s, "Foydalanuvchi", `Chek yuborildi: ${m.title}`);
  return { state: s, ok: true, message: "Chek yuborildi. Admin bank tushumini tekshirgach, to‘lov tasdiqlanadi", orderId };
}

/** The user cancels an unpaid order (before paying or after a rejected receipt). */
export function cancelOrder(state: DemoState, userId: string, orderId: string): ActionResult {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.userId !== userId) return fail(state, "Buyurtma topilmadi");
  if (!USER_PAYABLE.includes(o.paymentStatus)) return fail(state, "Bu holatda buyurtmani bekor qilib bo‘lmaydi");
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.paymentStatus = "cancelled";
  orderEvent(m, s, "Foydalanuvchi", "Buyurtma bekor qilindi");
  if (m.kind === "status") {
    const so = s.statusOrders.find((x) => x.id === m.targetId);
    if (so && so.state === "awaiting_payment") so.state = "cancelled";
  } else {
    const l = s.listings.find((x) => x.id === m.targetId);
    l?.history.push({ at: nowIso(s), text: "To‘lov buyurtmasi bekor qilindi" });
  }
  addLog(s, "Foydalanuvchi", `Buyurtma bekor qilindi: ${m.title}`);
  return { state: s, ok: true, message: "Buyurtma bekor qilindi. E’lon moderatsiyaga yuborilmadi", orderId };
}

/** A paid listing whose order was cancelled gets a fresh order at today's price. */
export function renewListingOrder(state: DemoState, userId: string, listingId: string): ActionResult {
  const l = state.listings.find((x) => x.id === listingId && x.userId === userId);
  if (!l || l.billing !== "paid" || l.moderation !== "not_submitted") return fail(state, "Bu e’lon uchun yangi buyurtma kerak emas");
  const old = state.orders.find((x) => x.id === l.orderId);
  if (old && old.paymentStatus !== "cancelled") return fail(state, "Avvalgi buyurtma hali faol");
  const s = clone(state);
  const m = s.listings.find((x) => x.id === listingId)!;
  const q = quote(s, s.settings.plans[m.plan].price, "listing");
  const order = makeOrder(s, userId, "listing", m.id, `E’lon: ${m.title} (${s.settings.plans[m.plan].nameUz})`, q);
  m.orderId = order.id;
  s.orders.unshift(order);
  if (order.amount === 0) settlePaid(s, order, "Chegirma 100%");
  return { state: s, ok: true, message: `Yangi buyurtma yaratildi: ${formatSum(order.amount)}`, orderId: order.id };
}

function requireReviewable(state: DemoState, adminId: string, orderId: string): { admin: DemoUser; order: Order } | string {
  const admin = state.users.find((u) => u.id === adminId && u.role === "admin");
  if (!admin) return "Faqat admin to‘lovni tekshira oladi";
  const order = state.orders.find((x) => x.id === orderId);
  if (!order) return "Buyurtma topilmadi";
  if (isPaidLike(order.paymentStatus)) return "Bu buyurtma allaqachon tasdiqlangan — ikkinchi marta tasdiqlab bo‘lmaydi";
  if (order.paymentStatus !== "receipt_submitted" && order.paymentStatus !== "under_review") return "Tekshirish uchun yuborilgan chek yo‘q";
  return { admin, order };
}

/** Admin takes a receipt for checking. */
export function startPaymentReview(state: DemoState, adminId: string, orderId: string): ActionResult {
  const r = requireReviewable(state, adminId, orderId);
  if (typeof r === "string") return fail(state, r);
  if (r.order.paymentStatus === "under_review") return { state, ok: true, message: "Chek tekshirilmoqda" };
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.paymentStatus = "under_review";
  m.reviews.push({ at: nowIso(s), adminId, decision: "started", note: null });
  orderEvent(m, s, r.admin.name, "Tekshiruvga olindi");
  addLog(s, r.admin.name, `Chekni tekshirishni boshladi: ${m.title}`);
  return { state: s, ok: true, message: "Chek tekshiruvga olindi. Bank tushumini alohida tekshiring" };
}

/** Admin confirms the money arrived. A listing then goes to MODERATION, not straight to the site. */
export function approvePayment(state: DemoState, adminId: string, orderId: string): ActionResult {
  const r = requireReviewable(state, adminId, orderId);
  if (typeof r === "string") return fail(state, r);
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.reviews.push({ at: nowIso(s), adminId, decision: "approved", note: null });
  m.adminNote = null;
  const served = settlePaid(s, m, "To‘lov admin tomonidan tasdiqlandi");
  orderEvent(m, s, r.admin.name, "To‘lov tasdiqlandi");
  addLog(s, r.admin.name, `To‘lovni tasdiqladi: ${m.title} — ${formatSum(m.amount)}`);
  if (!served) {
    openRefund(s, m.id, "Tasdiqlash paytida xizmat bekor qilingan edi (e’lon rad etilgan yoki status bekor qilingan)");
    addLog(s, r.admin.name, `Avtomatik qaytarish so‘rovi: ${m.title}`);
    return { state: s, ok: true, message: "To‘lov tasdiqlandi, lekin xizmat bekor qilingan edi — pul qaytarish so‘rovi avtomatik ochildi" };
  }
  return {
    state: s,
    ok: true,
    message: m.kind === "listing" ? "To‘lov tasdiqlandi. E’lon moderatsiyaga o‘tdi (hali saytda emas)" : "To‘lov tasdiqlandi. Status admin tasdig‘ini kutmoqda",
  };
}

export function rejectPayment(state: DemoState, adminId: string, orderId: string, reason: string): ActionResult {
  if (!reason.trim()) return fail(state, "Rad etish sababini yozing");
  const r = requireReviewable(state, adminId, orderId);
  if (typeof r === "string") return fail(state, r);
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.paymentStatus = "rejected";
  m.adminNote = reason.trim();
  m.reviews.push({ at: nowIso(s), adminId, decision: "rejected", note: reason.trim() });
  orderEvent(m, s, r.admin.name, `To‘lov rad etildi: ${reason.trim()}`);
  addLog(s, r.admin.name, `To‘lovni rad etdi: ${m.title} (${reason.trim()})`);
  return { state: s, ok: true, message: "To‘lov rad etildi. Foydalanuvchi sababni ko‘radi va yangi chek yuborishi mumkin" };
}

export function requestPaymentInfo(state: DemoState, adminId: string, orderId: string, note: string): ActionResult {
  if (!note.trim()) return fail(state, "Qanday ma’lumot kerakligini yozing");
  const r = requireReviewable(state, adminId, orderId);
  if (typeof r === "string") return fail(state, r);
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  m.paymentStatus = "info_requested";
  m.adminNote = note.trim();
  m.reviews.push({ at: nowIso(s), adminId, decision: "info_requested", note: note.trim() });
  orderEvent(m, s, r.admin.name, `Qo‘shimcha ma’lumot so‘raldi: ${note.trim()}`);
  addLog(s, r.admin.name, `Qo‘shimcha chek/ma’lumot so‘radi: ${m.title}`);
  return { state: s, ok: true, message: "Foydalanuvchidan qo‘shimcha chek yoki ma’lumot so‘raldi" };
}

export function updatePaymentCard(state: DemoState, adminId: string, card: PaymentCard): ActionResult {
  const admin = state.users.find((u) => u.id === adminId && u.role === "admin");
  if (!admin) return fail(state, "Kartani faqat admin o‘zgartira oladi");
  const digits = card.cardNumber.replace(/\D/g, "");
  if (digits.length !== 16) return fail(state, "Karta raqami 16 ta raqam bo‘lsin");
  if (card.holder.trim().length < 3) return fail(state, "Karta egasining ismini yozing");
  const s = clone(state);
  s.settings.paymentCard = {
    enabled: Boolean(card.enabled),
    cardNumber: digits,
    holder: card.holder.trim().slice(0, 80),
    bank: card.bank.trim().slice(0, 80),
    instructions: card.instructions.trim().slice(0, 600),
  };
  addLog(s, admin.name, `To‘lov kartasi o‘zgartirildi (•••• ${digits.slice(-4)}, qabul: ${card.enabled ? "yoqilgan" : "o‘chirilgan"})`);
  return { state: s, ok: true, message: "To‘lov kartasi saqlandi" };
}

export function formatCard(digits: string): string {
  return digits.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
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

export type StatusPhase = StatusOrderState | "expired" | "scheduled";

/** The real phase of a status at "now" (an active status whose end passed is expired). */
export function statusPhase(state: DemoState, so: StatusOrder): StatusPhase {
  if (so.state === "active" && so.endsAt && Date.parse(so.endsAt) <= nowMs(state)) return "expired";
  if (so.state === "active" && so.startsAt && Date.parse(so.startsAt) > nowMs(state)) return "scheduled";
  return so.state;
}

export function activeStatusesFor(state: DemoState, listingId: string): StatusOrder[] {
  return state.statusOrders.filter((x) => x.listingId === listingId && statusPhase(state, x) === "active");
}

// ---------------------------------------------------------------- admin: moderation

function requireAdmin(state: DemoState, adminId: string): DemoUser | null {
  return state.users.find((u) => u.id === adminId && u.role === "admin") ?? null;
}

function openRefund(s: DemoState, orderId: string | null, why: string, by = "Tizim") {
  if (!orderId) return false;
  const o = s.orders.find((x) => x.id === orderId);
  if (!o || o.paymentStatus !== "paid" || o.amount <= 0 || o.refund) return false;
  o.refund = { status: "requested", amount: o.amount, reason: why, requestedAt: nowIso(s), requestedBy: by, decidedAt: null, decidedBy: null, note: null };
  o.events.push({ at: nowIso(s), actor: by, text: `Pul qaytarish so‘rovi: ${why}` });
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
  addLog(s, admin.name, `Tasdiqladi: ${m.title}`);
  return { state: s, ok: true, message: `E’lon tasdiqlandi va saytda ko‘rinadi.${m.plan === "premium" ? " Premium belgisi bilan (TOP alohida sotib olinadi)." : ""}` };
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
  // Stop its statuses. Paid ones get a refund request (the admin decides, also for an active one);
  // unpaid ones are cancelled, and an order whose receipt is still being checked gets a refund on approval.
  s.statusOrders.forEach((x) => {
    if (x.listingId !== m.id) return;
    if (x.state === "active" || x.state === "pending_approval") {
      openRefund(s, x.orderId, x.state === "active" ? "E’lon rad etildi, faol status to‘xtatildi" : "E’lon rad etildi, status bekor qilindi");
      x.state = "cancelled";
    } else if (x.state === "awaiting_payment") {
      x.state = "cancelled";
      const o = s.orders.find((q) => q.id === x.orderId);
      if (o && USER_PAYABLE.includes(o.paymentStatus)) {
        o.paymentStatus = "cancelled";
        o.events.push({ at: nowIso(s), actor: "Tizim", text: "E’lon rad etildi — buyurtma bekor qilindi" });
      }
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
  if (!o || o.refund?.status !== "requested") return fail(state, "Qaytarish so‘rovi yo‘q");
  const s = clone(state);
  const m = s.orders.find((x) => x.id === orderId)!;
  // The payment stays "paid"; only the refund record gets the result.
  m.refund = { ...m.refund!, status: decision, decidedAt: nowIso(s), decidedBy: admin.name };
  m.events.push({ at: nowIso(s), actor: admin.name, text: decision === "refunded" ? "Pul qaytarilgani qayd etildi" : "Qaytarish rad etildi" });
  addLog(s, admin.name, `${decision === "refunded" ? "Pul qaytarildi (DEMO)" : "Qaytarish rad etildi"}: ${m.title}`);
  return { state: s, ok: true, message: decision === "refunded" ? "Qaytarish bajarildi deb belgilandi (DEMO, haqiqiy pul o‘tkazilmadi)" : "Qaytarish rad etildi" };
}

// ---------------------------------------------------------------- admin: settings, promo, promotions

export function updateSettings(state: DemoState, adminId: string, patch: Partial<Pick<Settings, "monetizationEnabled" | "freeFirstEnabled">> & {
  planPrices?: Partial<Record<ListingPlanId, number>>;
  premiumFeatures?: string[];
  standardFeatures?: string[];
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
  for (const [plan, list] of [["premium", patch.premiumFeatures], ["standard", patch.standardFeatures]] as const) {
    if (list === undefined) continue;
    const clean = list.map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
    if (clean.some((x) => x.length > 120)) return fail(state, "Imkoniyat matni 120 belgidan oshmasin");
    if (clean.some((x) => /\btop\b/i.test(x))) return fail(state, "TOP tarifga kirmaydi — u alohida sotib olinadi");
    s.settings.plans[plan].features = clean;
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
  addLog(s, requireAdmin(state, adminId)!.name, days === "reset" ? "Demo soati haqiqiy vaqtga qaytarildi" : `Demo soati ${days} kun surildi`);
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
  addLog(s, requireAdmin(state, adminId)!.name, `Promokod ${p.code}: ${p.active ? "yoqildi" : "o‘chirildi"}`);
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
  addLog(s, requireAdmin(state, adminId)!.name, `Aksiya ${p.name}: ${p.active ? "faollashtirildi" : "to‘xtatildi"}`);
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
  isPremium: boolean;
}

/** Approved listings only, with running statuses; TOP first, then newest. */
export function publicListings(state: DemoState): PublicListing[] {
  return state.listings
    .filter((l) => l.moderation === "approved")
    .map((listing) => {
      const statuses = activeStatusesFor(state, listing.id);
      return { listing, statuses, isTop: statuses.some((x) => x.type === "top"), isPremium: listing.plan === "premium" };
    })
    .sort((a, b) => Number(b.isTop) - Number(a.isTop) || Date.parse(b.listing.decidedAt || b.listing.createdAt) - Date.parse(a.listing.decidedAt || a.listing.createdAt));
}

export function stats(state: DemoState) {
  const paid = state.orders.filter((o) => isPaidLike(o.paymentStatus));
  const refunded = state.orders.filter((o) => o.refund?.status === "refunded");
  return {
    paymentReviews: state.orders.filter((o) => o.paymentStatus === "receipt_submitted" || o.paymentStatus === "under_review").length,
    premiumListings: state.listings.filter((l) => l.plan === "premium" && l.moderation === "approved").length,
    pendingModeration: state.listings.filter((l) => l.moderation === "pending").length,
    pendingStatuses: state.statusOrders.filter((x) => x.state === "pending_approval").length,
    refundRequests: state.orders.filter((o) => o.refund?.status === "requested").length,
    approved: state.listings.filter((l) => l.moderation === "approved").length,
    revenue: paid.reduce((a, o) => a + o.amount, 0) - refunded.reduce((a, o) => a + o.amount, 0),
    paidCount: paid.length,
  };
}
