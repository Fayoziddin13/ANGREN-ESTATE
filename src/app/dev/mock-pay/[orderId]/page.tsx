import { notFound } from "next/navigation";
import { mockPaymentsAllowed } from "@/lib/env/safety";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyMockSignature } from "@/lib/monetization/payments";
import { MockPayClient } from "./MockPayClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test to‘lov | ANGREN ESTATE", robots: { index: false, follow: false } };

/**
 * Local stand-in for a payment provider's checkout page. Exists only on a
 * developer machine against the test database; the amount comes from the
 * server-signed link, never from the browser.
 */
export default async function MockPayPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { amount?: string; sig?: string };
}) {
  if (!mockPaymentsAllowed().allowed) notFound();
  const amount = Number(searchParams.amount);
  const signatureOk = verifyMockSignature(params.orderId, amount, searchParams.sig);
  const { data: order } = await supabaseAdmin
    .from("payment_orders")
    .select("id, service, status, base_amount_uzs, discount_uzs, final_amount_uzs, expires_at, plan_snapshot")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) notFound();

  return (
    <MockPayClient
      orderId={order.id}
      amount={amount}
      signature={searchParams.sig || ""}
      signatureOk={signatureOk}
      service={order.service}
      status={order.status}
      base={order.base_amount_uzs}
      discount={order.discount_uzs}
      finalAmount={order.final_amount_uzs}
      expiresAt={order.expires_at}
      plan={order.plan_snapshot}
    />
  );
}
