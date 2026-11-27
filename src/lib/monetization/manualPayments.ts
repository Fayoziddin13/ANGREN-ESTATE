import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { monRpc, unwrap } from "./db";
import { MonetizationError } from "./errors";
import { enforceRateLimit, type Customer } from "./customer";
import { processRefund } from "./orders";

/**
 * Manual card-to-card payment.
 *
 * The customer sees the card the admin set, transfers the amount in a bank app
 * and uploads the receipt. The file goes to a PRIVATE bucket (service role only);
 * the database records it (SHA-256 unique: one receipt can be used once, ever).
 * Only an admin, through the admin API, can mark the order paid — after checking
 * the bank. Nothing here talks to a payment provider.
 */

export const RECEIPT_BUCKET = "payment-receipts";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const PAYABLE = ["PENDING", "INFO_REQUESTED", "REJECTED"];

type ReceiptKind = { ext: "jpg" | "png" | "pdf"; mime: "image/jpeg" | "image/png" | "application/pdf" };

/** Real file type from the bytes (the browser's name and MIME type are not trusted). */
export function sniffReceipt(bytes: Uint8Array): ReceiptKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return { ext: "png", mime: "image/png" };
  }
  if (bytes.length >= 5 && [0x25, 0x50, 0x44, 0x46, 0x2d].every((b, i) => bytes[i] === b)) return { ext: "pdf", mime: "application/pdf" };
  return null;
}

/** Card numbers are shown in groups of four. */
export function formatCardNumber(digits: string): string {
  return digits.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}

export interface PaymentMethod {
  id: string;
  card_number: string;
  holder_name: string;
  bank_name: string | null;
  instructions: string | null;
  accepting: boolean;
  updated_at: string;
}

export async function getActivePaymentMethod(): Promise<PaymentMethod | null> {
  const row = unwrap(
    await supabaseAdmin
      .from("payment_methods")
      .select("id, card_number, holder_name, bank_name, instructions, accepting, updated_at")
      .eq("kind", "manual_card")
      .eq("is_active", true)
      .maybeSingle()
  ) as PaymentMethod | null;
  return row;
}

/** Admin: set the card (a new card keeps the old one in history). */
export async function setPaymentMethod(body: any, actorId: string) {
  const card = typeof body?.card_number === "string" ? body.card_number : "";
  const holder = typeof body?.holder_name === "string" ? body.holder_name.slice(0, 80) : "";
  const bank = typeof body?.bank_name === "string" ? body.bank_name.slice(0, 80) : null;
  const instructions = typeof body?.instructions === "string" ? body.instructions.slice(0, 600) : null;
  const accepting = body?.accepting === undefined ? true : Boolean(body.accepting);
  await monRpc<string>("mon_set_payment_method", {
    p_card_number: card,
    p_holder_name: holder,
    p_bank_name: bank,
    p_instructions: instructions,
    p_accepting: accepting,
    p_actor_id: actorId,
  });
  return getActivePaymentMethod();
}

async function loadOwnOrder(customer: Customer, orderId: string) {
  const order = unwrap(
    await supabaseAdmin
      .from("payment_orders")
      .select(
        "id, account_id, service, submission_id, boost_id, plan_snapshot, base_amount_uzs, discount_uzs, final_amount_uzs, discount_source, status, status_reason, expires_at, paid_at, reviewed_at, created_at"
      )
      .eq("id", orderId)
      .maybeSingle()
  ) as any;
  if (!order || order.account_id !== customer.accountId) throw new MonetizationError("not_found");
  return order;
}

/** Customer: everything the payment page shows. The card is shown only while the order can be paid. */
export async function getOrderPaymentPage(customer: Customer, orderId: string) {
  const order = await loadOwnOrder(customer, orderId);
  const method = await getActivePaymentMethod();
  const receipts = unwrap(
    await supabaseAdmin
      .from("payment_receipts")
      .select("id, mime, size_bytes, state, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
  ) as any[];
  const refund = unwrap(
    await supabaseAdmin
      .from("refunds")
      .select("id, status, amount_uzs, created_at, completed_at")
      .eq("order_id", order.id)
      .neq("status", "FAILED")
      .maybeSingle()
  ) as any;
  const payable = PAYABLE.includes(order.status) && !(order.status === "PENDING" && Date.parse(order.expires_at) <= Date.now());
  const { account_id: _omit, ...publicOrder } = order;
  return {
    order: publicOrder,
    payable,
    expired: order.status === "PENDING" && Date.parse(order.expires_at) <= Date.now(),
    card:
      payable && method?.accepting
        ? {
            card_number: formatCardNumber(method.card_number),
            holder_name: method.holder_name,
            bank_name: method.bank_name,
            instructions: method.instructions,
          }
        : null,
    accepting: Boolean(method?.accepting),
    receipts,
    refund: refund || null,
  };
}

/** Customer: upload a receipt. The database re-checks ownership, state, card and reuse. */
export async function submitReceipt(customer: Customer, orderId: string, file: File, note: string | null) {
  await enforceRateLimit(`receipt:${customer.accountId}`, 10, 3600);
  if (!file || typeof file.arrayBuffer !== "function") throw new MonetizationError("invalid_receipt", "no file");
  if (file.size <= 0 || file.size > RECEIPT_MAX_BYTES) throw new MonetizationError("invalid_receipt", "size");
  const order = await loadOwnOrder(customer, orderId);
  if (!PAYABLE.includes(order.status)) {
    throw new MonetizationError(order.status === "PAID" ? "already_paid" : order.status === "CANCELLED" || order.status === "FAILED" ? "order_closed" : "receipt_under_review");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffReceipt(bytes);
  if (!kind) throw new MonetizationError("invalid_receipt", "type");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const path = `${customer.accountId}/${order.id}/${crypto.randomUUID()}.${kind.ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: kind.mime, upsert: false });
  if (uploadError) {
    console.error("[payments] receipt upload failed:", uploadError.message);
    throw new MonetizationError("upload_failed");
  }
  try {
    return await monRpc<{ order_id: string; receipt_id: string; status: string }>("mon_submit_receipt", {
      p_order_id: order.id,
      p_account_id: customer.accountId,
      p_storage_path: path,
      p_sha256: sha256,
      p_mime: kind.mime,
      p_size_bytes: bytes.length,
      p_note: note ? note.slice(0, 500) : null,
    });
  } catch (err) {
    // The database refused it: remove the file we just stored, nothing else references it.
    await supabaseAdmin.storage.from(RECEIPT_BUCKET).remove([path]).catch(() => undefined);
    throw err;
  }
}

// ------------------------------------------------------------------ admin

const REVIEW_STATUSES = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"];

/** Admin: payment orders, by default the ones waiting for a decision. */
export async function listPaymentOrders(filter: string | null) {
  let query = supabaseAdmin
    .from("payment_orders")
    .select(
      "id, account_id, service, submission_id, boost_id, plan_snapshot, final_amount_uzs, status, status_reason, provider, created_at, updated_at, paid_at, reviewed_at, reviewed_by"
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!filter || filter === "review") query = query.in("status", REVIEW_STATUSES);
  else if (filter === "waiting") query = query.in("status", ["PENDING", "INFO_REQUESTED", "REJECTED"]);
  else if (filter === "paid") query = query.eq("status", "PAID");
  else if (filter === "closed") query = query.in("status", ["CANCELLED", "FAILED"]);
  const orders = unwrap(await query) as any[];
  if (!orders.length) return [];

  const ids = orders.map((o) => o.id);
  const receipts = unwrap(
    await supabaseAdmin.from("payment_receipts").select("order_id, created_at, state").in("order_id", ids)
  ) as any[];
  const refunds = unwrap(await supabaseAdmin.from("refunds").select("order_id, status").in("order_id", ids)) as any[];
  const accountIds = Array.from(new Set(orders.map((o) => o.account_id)));
  const accounts = unwrap(
    await supabaseAdmin.from("customer_accounts").select("id, display_name, customer_identities(provider, phone_e164, email, telegram_username)").in("id", accountIds)
  ) as any[];
  return orders.map((o) => {
    const own = receipts.filter((r) => r.order_id === o.id).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const acc = accounts.find((a) => a.id === o.account_id);
    return {
      ...o,
      customer: acc
        ? {
            name: acc.display_name,
            phone: acc.customer_identities?.find((i: any) => i.phone_e164)?.phone_e164 ?? null,
            email: acc.customer_identities?.find((i: any) => i.email)?.email ?? null,
          }
        : null,
      receipt_count: own.length,
      last_receipt_at: own[0]?.created_at ?? null,
      refund_status: refunds.find((r) => r.order_id === o.id && r.status !== "FAILED")?.status ?? null,
    };
  });
}

/** Admin: one order with its receipts (short signed URLs) and the decision history. */
export async function getPaymentOrderDetail(orderId: string) {
  const order = unwrap(await supabaseAdmin.from("payment_orders").select("*").eq("id", orderId).maybeSingle()) as any;
  if (!order) throw new MonetizationError("not_found");
  const receipts = unwrap(
    await supabaseAdmin
      .from("payment_receipts")
      .select("id, storage_path, sha256, mime, size_bytes, note, state, card_snapshot, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
  ) as any[];
  const reviews = unwrap(
    await supabaseAdmin.from("payment_reviews").select("id, receipt_id, actor_id, decision, note, created_at").eq("order_id", orderId).order("created_at")
  ) as any[];
  const refunds = unwrap(await supabaseAdmin.from("refunds").select("*").eq("order_id", orderId).order("created_at")) as any[];
  const account = unwrap(
    await supabaseAdmin
      .from("customer_accounts")
      .select("id, display_name, status, customer_identities(provider, phone_e164, email, telegram_username)")
      .eq("id", order.account_id)
      .maybeSingle()
  ) as any;

  const signed: Record<string, string> = {};
  if (receipts.length) {
    const { data } = await supabaseAdmin.storage.from(RECEIPT_BUCKET).createSignedUrls(receipts.map((r) => r.storage_path), 300);
    for (const item of data || []) if (item.path && item.signedUrl) signed[item.path] = item.signedUrl;
  }
  return {
    order,
    customer: account,
    receipts: receipts.map(({ storage_path, ...r }) => ({ ...r, url: signed[storage_path] || null })),
    reviews,
    refunds,
  };
}

/** Admin: start / approve / reject / request_info. Approval of a closed service opens a refund. */
export async function reviewPayment(orderId: string, action: string, note: string | null, actorId: string) {
  if (!["start", "approve", "reject", "request_info"].includes(action)) throw new MonetizationError("invalid_action");
  if ((action === "reject" || action === "request_info") && !note) throw new MonetizationError("reason_required");
  const result = await monRpc<{ status: string; target: string; refund_id: string | null }>("mon_review_payment", {
    p_order_id: orderId,
    p_action: action,
    p_note: note,
    p_actor_id: actorId,
  });
  if (result.refund_id) await processRefund(result.refund_id, { type: "admin", id: actorId });
  return result;
}
