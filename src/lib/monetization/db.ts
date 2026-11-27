import { supabaseAdmin } from "@/lib/supabaseServer";
import { fromDbError } from "./errors";

/** Call a monetization SQL function with the service role; MON:* errors become MonetizationError. */
export async function monRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw fromDbError(error);
  return data as T;
}

/** Write one audit entry for actions done outside the SQL functions (settings, promo codes...). */
export async function audit(entry: {
  actorType: "customer" | "admin" | "system" | "provider";
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipHash?: string | null;
}): Promise<void> {
  await monRpc("mon_audit", {
    p_actor_type: entry.actorType,
    p_actor_id: entry.actorId ?? null,
    p_action: entry.action,
    p_entity: entry.entity,
    p_entity_id: entry.entityId ?? null,
    p_before: entry.before ?? null,
    p_after: entry.after ?? null,
    p_reason: entry.reason ?? null,
    p_ip_hash: entry.ipHash ?? null,
  });
}

/** Throw on a Supabase query error, otherwise return the data. */
export function unwrap<T>(result: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (result.error) throw fromDbError(result.error);
  return result.data as T;
}
