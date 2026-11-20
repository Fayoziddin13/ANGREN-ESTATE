export interface SharedJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
}

const inflight = new Map<string, Promise<SharedJsonResult>>();

/**
 * Fetch JSON once per URL while a request is in flight.
 *
 * Several components mount at the same time and each requested the same endpoint
 * (/api/properties ×2, /api/hududs ×3, /api/content ×3 per page load). Concurrent
 * callers now share one network request and one parsed body. Nothing is cached
 * after the request settles, so later refetches (e.g. after an admin edit) always
 * hit the network and never see stale data.
 */
export function fetchJsonShared<T = any>(url: string, init?: RequestInit): Promise<SharedJsonResult<T>> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<SharedJsonResult<T>>;

  const request: Promise<SharedJsonResult> = fetch(url, init)
    .then(async (res) => {
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { ok: res.ok, status: res.status, data };
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request as Promise<SharedJsonResult<T>>;
}
