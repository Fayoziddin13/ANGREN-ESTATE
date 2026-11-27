import crypto from "crypto";
import { mockPaymentsAllowed } from "@/lib/env/safety";

/**
 * Payment providers.
 *
 * Only the Mock provider exists today: real providers (Payme, Click, Uzum) are
 * added later behind the same interface, once the legal entity and contracts are
 * ready. The Mock provider works ONLY on a developer machine against the
 * allow-listed test database (see mockPaymentsAllowed) — never on Vercel.
 */

export interface OrderForPayment {
  id: string;
  final_amount_uzs: number;
  service: "listing" | "sticker";
}

export interface RefundOutcome {
  status: "SUCCEEDED" | "FAILED" | "MANUAL_REQUIRED";
  providerRef?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** URL the customer is sent to in order to pay this order. */
  createCheckout(order: OrderForPayment): Promise<{ redirectUrl: string }>;
  /** Return money for a paid order. */
  refund(order: OrderForPayment, amountUzs: number): Promise<RefundOutcome>;
}

// ------------------------------------------------------------------ Mock ---

function mockSecret(): string {
  // Stable for one environment, never shipped to the browser.
  const base = process.env.MOCK_PAYMENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base) return mockFallbackSecret;
  return crypto.createHash("sha256").update(`angren-estate:mock-payments:${base}`).digest("hex");
}
const mockFallbackSecret = crypto.randomBytes(32).toString("hex");

export function signMockCheckout(orderId: string, amountUzs: number): string {
  return crypto.createHmac("sha256", mockSecret()).update(`${orderId}:${amountUzs}`).digest("hex");
}

export function verifyMockSignature(orderId: string, amountUzs: number, signature: unknown): boolean {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signMockCheckout(orderId, amountUzs), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(order) {
    const sig = signMockCheckout(order.id, order.final_amount_uzs);
    const params = new URLSearchParams({ amount: String(order.final_amount_uzs), sig });
    return { redirectUrl: `/dev/mock-pay/${order.id}?${params.toString()}` };
  },
  async refund(order) {
    // MOCK_REFUND_MODE lets a developer rehearse failed and manual refunds.
    const mode = (process.env.MOCK_REFUND_MODE || "success").toLowerCase();
    if (mode === "fail") return { status: "FAILED", message: "Mock refund failed (MOCK_REFUND_MODE=fail)" };
    if (mode === "manual") return { status: "MANUAL_REQUIRED", message: "Mock: refund must be made by hand" };
    return { status: "SUCCEEDED", providerRef: `mock-refund-${order.id.slice(0, 8)}-${Date.now()}` };
  },
};

/** Provider used for new payments in this environment, or null when payments are unavailable. */
export function getPaymentProvider(): PaymentProvider | null {
  if (mockPaymentsAllowed().allowed) return mockProvider;
  return null;
}

/** Provider that took an existing payment (for refunds). */
export function getProviderByName(name: string | null | undefined): PaymentProvider | null {
  if (name === "mock") return mockPaymentsAllowed().allowed ? mockProvider : null;
  return null;
}
