import fs from "fs";
import path from "path";
import { supabaseAdmin } from "./supabaseServer";

const META_FILE = path.join(process.cwd(), "data", "realtors_meta.json");

export interface RealtorExtraMeta {
  instagram_url?: string | null;
  photo_url?: string | null;
}

export function getLocalRealtorsMeta(): Record<string, RealtorExtraMeta> {
  try {
    if (fs.existsSync(META_FILE)) {
      const raw = fs.readFileSync(META_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[realtorMetaStore] Read error:", err);
  }
  return {};
}

export async function getRealtorsMeta(): Promise<Record<string, RealtorExtraMeta>> {
  const local = getLocalRealtorsMeta();
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "realtors_meta")
      .maybeSingle();

    if (!error && data?.value && typeof data.value === "object") {
      return { ...local, ...data.value };
    }
  } catch (err) {
    console.warn("[realtorMetaStore] Remote read error, using local fallback:", err);
  }
  return local;
}

export function getRealtorsMetaSync(): Record<string, RealtorExtraMeta> {
  return getLocalRealtorsMeta();
}

export async function saveRealtorMeta(id: string, meta: Partial<RealtorExtraMeta>): Promise<void> {
  try {
    const all = await getRealtorsMeta();
    const current = all[id] || {};

    if (meta.instagram_url !== undefined) {
      if (meta.instagram_url) {
        current.instagram_url = meta.instagram_url;
      } else {
        delete current.instagram_url;
      }
    }

    if (meta.photo_url !== undefined) {
      if (meta.photo_url) {
        current.photo_url = meta.photo_url;
      } else {
        delete current.photo_url;
      }
    }

    all[id] = current;

    // 1. Save locally if filesystem allows
    try {
      const dir = path.dirname(META_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(META_FILE, JSON.stringify(all, null, 2), "utf8");
    } catch (fsErr) {
      console.warn("[realtorMetaStore] Local write ignored in serverless:", fsErr);
    }

    // 2. Persist in Supabase app_settings (key: realtors_meta)
    await supabaseAdmin.from("app_settings").upsert({
      key: "realtors_meta",
      value: all,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[realtorMetaStore] Write error:", err);
  }
}
