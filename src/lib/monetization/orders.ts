import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { mockPaymentsAllowed } from "@/lib/env/safety";
import { monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";
import { getProviderByName, mockProvider, verifyMockSignature } from "./payments";
import type { Customer } from "./customer";

export type CheckoutTarget = { type: "submission" | "boost"; id: string };

interface EnsuredOrder {
  order_id: string;
  amount: number;
  base: number;
  discount: number;
  expires_at: string;
  promo_error: string | null;
}

/**
 * Open (or reuse) the order of an item awaiting payment and return the payment
 * page URL. Payment is a manual card transfer checked by an admin, so the page is
 * our own: /kabinet/tolov/<order>. No payment provider is involved.
 */
export async function startCheckout(customer: Customer, target: CheckoutTarget, promoCode?: string | null) {

  const ensured = await monRpc<EnsuredOrder>(
    target.type === "submission" ? "mon_ensure_listing_order" : "mon_ensure_boost_order",
    target.type === "submission"
      ? { p_submission_id: target.id, p_account_id: customer.accountId, p_promo_code: promoCode ?? null }
      : { p_boost_id: target.id, p_account_id: customer.accountId, p_promo_code: promoCode ?? null }
  );

  const order = unwrap(
    await supabaseAdmin
      .from("payment_orders")
      .select("id, final_amount_uzs, service, status, account_id")
      .eq("id", ensured.order_id)
      .single()
  ) as { id: string; final_amount_uzs: number; service: "listing" | "sticker"; status: string; account_id: string };
  if (order.account_id !== customer.accountId) throw new MonetizationError("not_found");

  return { ...ensured, provider: "manual_card", redirect_url: `/kabinet/tolov/${order.id}` };
}

/** Cancel an unpaid order of this customer (frees a reserved promo code). */
export async function cancelOrder(customer: Customer, orderId: string) {
  return monRpc<string>("mon_close_order", {
    p_order_id: orderId,
    p_status: "CANCELLED",
    p_reason: "cancelled_by_customer",
    p_actor_type: "customer",
    p_actor_id: customer.accountId,
    p_account_id: customer.accountId,
  });
}

/**
 * Result of the local Mock payment page. Treated like a provider webhook: the
 * signature is verified, the raw call is logged, and the payment is applied
 * idempotently by the database. Refused entirely outside local development.
 */
export async function completeMockPayment(input: {
  orderId: unknown;
  amount: unknown;
  signature: unknown;
  outcome: unknown;
  attemptId: unknown;
}) {
  if (!mockPaymentsAllowed().allowed) throw new MonetizationError("payment_unavailable");

  const orderId = typeof input.orderId === "string" ? input.orderId : "";
  const amount = Number(input.amount);
  const outcome = input.outcome === "success" || input.outcome === "fail" || input.outcome === "cancel" ? input.outcome : null;
  const attemptId =
    typeof input.attemptId === "string" && /^[0-9a-f-]{36}$/.test(input.attemptId) ? input.attemptId : crypto.randomUUID();
  const signatureOk = Boolean(orderId) && Number.isFinite(amount) && verifyMockSignature(orderId, amount, input.signature);

  let result = "rejected";
  let error: string | null = null;
  try {
    if (!signatureOk) {
      error = "invalid signature";
    } else if (!outcome) {
      error = "invalid outcome";
    } else if (outcome === "success") {
      result = await monRpc<string>("mon_apply_payment", {
        p_order_id: orderId,
        p_provider: "mock",
        p_provider_txn_id: `mock-${attemptId}`,
        p_amount_uzs: amount,
        p_raw: { outcome, attempt_id: attemptId },
      });
    } else {
      result = await monRpc<string>("mon_close_order", {
        p_order_id: orderId,
        p_status: outcome === "fail" ? "FAILED" : "CANCELLED",
        p_reason: outcome === "fail" ? "mock_payment_failed" : "mock_payment_cancelled",
        p_actor_type: "provider",
        p_actor_id: "mock",
      });
    }
  } finally {
    await supabaseAdmin.from("payment_webhook_logs").insert({
      provider: "mock",
      signature_ok: signatureOk,
      payload: { order_id: orderId, amount, outcome, attempt_id: attemptId },
      result,
      error,
    });
  }

  if (!signatureOk) throw new MonetizationError("validation", "signature");
  if (!outcome) throw new MonetizationError("validation", "outcome");
  return { result };
}

interface RefundRow {
  id: string;
  status: string;
  amount_uzs: number;
  order_id: string;
}

/**
 * Carry out a refund through the provider that took the payment. The refund is
 * done only when the provider confirms; if the provider cannot do it (manual card
 * payments), the refund waits for an admin (MANUAL_REQUIRED), who transfers the
 * money back and confirms with the bank reference. The payment itself stays PAID.
 */
export async function processRefund(refundId: string, actor: { type: "system" | "admin"; id: string | null }) {
  const refund = unwrap(
    await supabaseAdmin.from("refunds").select("id, status, amount_uzs, order_id").eq("id", refundId).single()
  ) as RefundRow;
  if (refund.status !== "REQUESTED") return refund.status;

  const order = unwrap(
    await supabaseAdmin.from("payment_orders").select("id, final_amount_uzs, service, provider").eq("id", refund.order_id).single()
  ) as { id: string; final_amount_uzs: number; service: "listing" | "sticker"; provider: string | null };

  const provider = getProviderByName(order.provider);
  if (!provider) {
    return monRpc<string>("mon_settle_refund", {
      p_refund_id: refundId,
      p_status: "MANUAL_REQUIRED",
      p_provider_ref: null,
      p_note: "Provider refund is not available here; refund in the provider cabinet and confirm.",
      p_actor_type: actor.type,
      p_actor_id: actor.id,
    });
  }

  await monRpc("mon_settle_refund", {
    p_refund_id: refundId,
    p_status: "PROCESSING",
    p_provider_ref: null,
    p_note: null,
    p_actor_type: actor.type,
    p_actor_id: actor.id,
  });
  let outcome;
  try {
    outcome = await provider.refund(order, refund.amount_uzs);
  } catch (err: any) {
    outcome = { status: "FAILED" as const, message: err?.message || "provider error" };
  }
  return monRpc<string>("mon_settle_refund", {
    p_refund_id: refundId,
    p_status: outcome.status,
    p_provider_ref: outcome.providerRef ?? null,
    p_note: outcome.message ?? null,
    p_actor_type: provider === mockProvider ? "provider" : actor.type,
    p_actor_id: provider.name,
  });
}
