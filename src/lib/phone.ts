/**
 * Phone helpers for display and `tel:` links.
 * Stored numbers come in many shapes (e.g. "947558383", "+998 90 123-45-67",
 * "998901234567"); Uzbek numbers are normalised to +998 XX XXX XX XX so they read
 * consistently and dial correctly from any phone.
 */

function uzDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return digits;
  return null;
}

export function formatPhoneDisplay(raw?: string | null): string {
  if (!raw) return "";
  const d = uzDigits(raw);
  if (!d) return raw.trim();
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

export function phoneHref(raw?: string | null): string {
  if (!raw) return "";
  const d = uzDigits(raw);
  if (d) return `tel:+${d}`;
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}
