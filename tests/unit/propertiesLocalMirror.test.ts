import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import fs from "fs";

/**
 * With Supabase configured, property writes must go to the database only:
 * - a failed insert throws, a failed update returns null (no fake success);
 * - data/properties.json (git-tracked) is never written.
 */

type Result = { data: unknown; error: { message: string } | null };

const db = vi.hoisted(() => ({
  select: (): Result => ({ data: null, error: { message: "not found" } }),
  insert: (): Result => ({ data: null, error: { message: "insert failed" } }),
  update: (): Result => ({ data: null, error: { message: "update failed" } }),
}));

vi.mock("../../src/lib/supabase", () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock("../../src/lib/supabaseServer", () => {
  const query = () => {
    let op: "select" | "insert" | "update" = "select";
    const q: Record<string, unknown> = {};
    q.insert = () => ((op = "insert"), q);
    q.update = () => ((op = "update"), q);
    q.select = () => q;
    q.eq = () => q;
    q.single = async () => db[op]();
    return q;
  };
  return { isSupabaseConfigured: true, supabaseAdmin: { from: () => query() } };
});

import { createProperty, updateProperty } from "../../src/lib/properties";

const row = {
  id: "prop-test-1",
  slug: "test-obyekt-1",
  status: "draft",
  title_uz: "Test obyekt",
  title_ru: "Тест объект",
  property_type: "apartment",
  deal_type: "sale",
  price: 100,
  price_uzs: 100,
  latitude: 41.0,
  longitude: 70.1,
  amenities: {},
  created_at: "2026-11-26T00:00:00.000Z",
};

describe("properties: no local JSON writes when Supabase is configured", () => {
  let writeFile: MockInstance<typeof fs.promises.writeFile>;
  let rename: MockInstance<typeof fs.promises.rename>;

  beforeEach(() => {
    writeFile = vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
    rename = vi.spyOn(fs.promises, "rename").mockResolvedValue(undefined);
    db.select = () => ({ data: row, error: null });
    db.insert = () => ({ data: null, error: { message: "insert failed" } });
    db.update = () => ({ data: null, error: { message: "update failed" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createProperty throws when the insert fails", async () => {
    await expect(createProperty({ ...row, status: "draft" } as never)).rejects.toThrow(/createProperty failed/);
    expect(writeFile).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it("createProperty returns the database row and does not mirror it", async () => {
    db.insert = () => ({ data: row, error: null });
    const created = await createProperty({ ...row, status: "draft" } as never);
    expect(created.id).toBe(row.id);
    expect(created.status).toBe("draft");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("updateProperty returns null when the update fails", async () => {
    expect(await updateProperty(row.id, { title_uz: "Yangi" })).toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it("updateProperty returns the database row and does not mirror it", async () => {
    db.update = () => ({ data: { ...row, title_uz: "Yangi" }, error: null });
    const updated = await updateProperty(row.id, { title_uz: "Yangi" });
    expect(updated?.title_uz).toBe("Yangi");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
