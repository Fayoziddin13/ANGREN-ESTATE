"use client";

/**
 * Browser-only persistence for the monetization DEMO. One localStorage key
 * holds the whole demo state; nothing is sent anywhere. Reset removes only
 * this key (the real site data, cookies and other storage are untouched).
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  DEMO_STORAGE_KEY, createSeedState, normalizeState, validateReceiptFile, type ActionResult, type DemoState, type ReceiptInput,
} from "./engine";

let cache: DemoState | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readFromStorage(): DemoState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    raw = null;
  }
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const state = normalizeState(parsed);
  if (!raw) {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage blocked: the demo still works for this tab */
    }
  }
  return state;
}

export function getDemoState(): DemoState {
  if (!cache) cache = readFromStorage();
  return cache;
}

/** Saves a new state. Returns false when the browser refuses (quota, privacy mode). */
export function saveDemoState(next: DemoState): boolean {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  emit();
  return true;
}

/** Clears ONLY the demo key and starts again from the seed (the admin stays signed in). */
export function resetDemoState(keepAdminId?: string | null): DemoState {
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const fresh = createSeedState();
  if (keepAdminId && fresh.users.some((u) => u.id === keepAdminId && u.role === "admin")) {
    fresh.sessions.admin = keepAdminId;
    fresh.log.unshift({ at: new Date().toISOString(), actor: "Demo Admin", text: "Reset Demo: demo ma’lumotlari tozalandi (faqat shu brauzerdagi demo kaliti)" });
  }
  saveDemoState(fresh);
  return fresh;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DEMO_STORAGE_KEY) {
      cache = null; // another tab changed the demo: re-read
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface UiResult {
  ok: boolean;
  message: string;
  at: number;
}

/**
 * React access to the demo state. `state` is null during the server render and
 * the first client render (localStorage is browser-only).
 */
export function useDemo() {
  const state = useSyncExternalStore(subscribe, getDemoState, () => null);
  const [result, setResult] = useState<UiResult | null>(null);

  const run = useCallback((fn: (s: DemoState) => ActionResult): ActionResult => {
    // Re-read storage first: another tab may have changed the demo a moment ago (avoids overwriting it).
    cache = null;
    const current = getDemoState();
    const r = fn(current);
    if (r.ok && r.state !== current) {
      if (!saveDemoState(r.state)) {
        const failed = { ...r, ok: false, state: current, message: "Brauzer xotirasi to‘ldi: rasmlar sonini kamaytiring yoki Reset Demo qiling" };
        setResult({ ok: false, message: failed.message, at: Date.now() });
        return failed;
      }
    }
    setResult({ ok: r.ok, message: r.message, at: Date.now() });
    return r;
  }, []);

  const show = useCallback((ok: boolean, message: string) => setResult({ ok, message, at: Date.now() }), []);
  const clearResult = useCallback(() => setResult(null), []);

  return { state, run, result, show, clearResult };
}

/** Re-renders every `ms` so time-based phases (expired statuses) stay current. */
export function useTicker(ms = 15000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [ms]);
}

/**
 * Reads a payment receipt: checks the real file type and size, hashes the
 * original bytes (so the same receipt cannot be reused) and stores images
 * shrunk / PDFs as they are.
 */
export async function readReceiptFile(file: File, note: string): Promise<{ ok: true; input: ReceiptInput } | { ok: false; reason: string }> {
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: "Faylni o‘qib bo‘lmadi" };
  }
  const bytes = new Uint8Array(buf);
  const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size }, bytes.slice(0, 16));
  if (!check.ok) return check;
  let hash: string;
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return { ok: false, reason: "Chekni tekshirib bo‘lmadi (brauzer xavfsiz rejimda emas)" };
  }
  const typed = new File([buf], file.name, { type: check.mime });
  let dataUrl: string;
  try {
    dataUrl =
      check.mime === "application/pdf"
        ? await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("read"));
            r.readAsDataURL(typed);
          })
        : await fileToSmallDataUrl(typed, 1400, 0.8);
  } catch {
    return { ok: false, reason: "Chek faylini o‘qib bo‘lmadi" };
  }
  const storedMime = check.mime === "application/pdf" ? "application/pdf" : "image/jpeg";
  return { ok: true, input: { hash, fileName: file.name || "chek", mime: check.mime, storedMime, size: file.size, dataUrl, note } };
}

/** Turns a stored data URL into a blob: URL (Chrome will not show PDFs from data: URLs in a frame). */
export function dataUrlToObjectUrl(dataUrl: string): string | null {
  try {
    const [head, body] = dataUrl.split(",", 2);
    const mime = /^data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
  } catch {
    return null;
  }
}

/** Reads an image file and shrinks it to a small JPEG data URL so it fits localStorage. */
export function fileToSmallDataUrl(file: File, maxSide = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error("Faqat JPG, PNG yoki WEBP rasm"));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("Rasm 12 MB dan katta"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Rasmni o‘qib bo‘lmadi"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o‘qib bo‘lmadi"));
    };
    img.src = url;
  });
}
