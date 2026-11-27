import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { MonetizationError } from "./errors";

/**
 * Photos of applications live in a PRIVATE bucket until an admin approves the
 * application; only then are they copied to the public property bucket. Browsers
 * never get a permanent URL to an unmoderated photo.
 */
export const SUBMISSION_BUCKET = "listing-submissions";
const PUBLIC_BUCKET = "property-images";
const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 10;

type ImageKind = { ext: "jpg" | "png" | "webp"; mime: string };

/** Detect the real image type from the file bytes (the browser's MIME type is not trusted). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** A path inside the private bucket that belongs to this account. */
export function isOwnPhotoPath(accountId: string, path: unknown): path is string {
  return (
    typeof path === "string" &&
    new RegExp(`^${accountId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)
  );
}

export async function uploadSubmissionPhoto(accountId: string, file: File): Promise<string> {
  if (!file || typeof file.arrayBuffer !== "function") throw new MonetizationError("upload_failed", "no file");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new MonetizationError("upload_failed", "size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new MonetizationError("upload_failed", "type");

  const path = `${accountId}/${crypto.randomUUID()}.${kind.ext}`;
  const { error } = await supabaseAdmin.storage
    .from(SUBMISSION_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: kind.mime, upsert: false });
  if (error) {
    console.error("[monetization] photo upload failed:", error.message);
    throw new MonetizationError("upload_failed");
  }
  return path;
}

/** Short-lived URLs for viewing private photos (owner or admin). */
export async function signedPhotoUrls(paths: string[], seconds = 600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabaseAdmin.storage.from(SUBMISSION_BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

/** Copy approved photos to the public bucket and return their public URLs. */
export async function publishSubmissionPhotos(paths: string[], propertyId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const path of paths) {
    const { data: blob, error: downloadError } = await supabaseAdmin.storage.from(SUBMISSION_BUCKET).download(path);
    if (downloadError || !blob) throw new MonetizationError("upload_failed", `download ${path}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) throw new MonetizationError("upload_failed", `type ${path}`);
    const target = `properties/submissions/${propertyId}/${crypto.randomUUID()}.${kind.ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PUBLIC_BUCKET)
      .upload(target, Buffer.from(bytes), { contentType: kind.mime, upsert: false });
    if (uploadError) throw new MonetizationError("upload_failed", `publish ${path}`);
    urls.push(supabaseAdmin.storage.from(PUBLIC_BUCKET).getPublicUrl(target).data.publicUrl);
  }
  return urls;
}
