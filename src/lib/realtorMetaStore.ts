import fs from "fs";
import path from "path";

const META_FILE = path.join(process.cwd(), "data", "realtors_meta.json");

export interface RealtorExtraMeta {
  instagram_url?: string | null;
  photo_url?: string | null;
}

export function getRealtorsMeta(): Record<string, RealtorExtraMeta> {
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

export function saveRealtorMeta(id: string, meta: Partial<RealtorExtraMeta>): void {
  try {
    const all = getRealtorsMeta();
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
    const dir = path.dirname(META_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(META_FILE, JSON.stringify(all, null, 2), "utf8");
  } catch (err) {
    console.error("[realtorMetaStore] Write error:", err);
  }
}
