/**
 * ANGREN ESTATE - Server-Side Content Translation Service
 * Supports bidirectional translation between Uzbek (Latin) and Russian.
 * Resilient against network issues, handles entity decoding, and protects structured data.
 * Strictly guarantees that Uzbek translations are in Latin script (never Cyrillic).
 */

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  sourceText: string;
  from: "uz" | "ru";
  to: "uz" | "ru";
  status: "completed" | "failed" | "same_language" | "skipped_non_translatable";
  error?: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

/**
 * Checks if a string is a non-translatable technical/structured value.
 * Values like phones, URLs, telegram handles, numbers, and coordinates must NEVER be translated.
 */
export function isNonTranslatableText(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Phone number (e.g. +998901234567, +998 90 123-45-67)
  if (/^\+?[0-9\s\-()]{7,}$/.test(trimmed)) return true;

  // URLs (http, https)
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return true;

  // Telegram handles (@username)
  if (/^@[a-zA-Z0-9_]{3,}$/.test(trimmed)) return true;

  // Coordinates (e.g. 41.0167, 70.1436 or [41.0167, 70.1436])
  if (/^\[?\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\]?$/.test(trimmed)) return true;

  // Pure digits, money or measurements (e.g. "35000", "$35,000", "450 000 000", "65 m2", "6 sotix")
  if (/^[$€£¥₽]?\s*[\d\s.,]+\s*([$€£¥₽]|m²|m2|sotix|so'm|sum|usd|uzs)?$/i.test(trimmed)) return true;

  // UUIDs / IDs
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;

  return false;
}

/**
 * Strictly converts any Uzbek Cyrillic characters into official Uzbek Latin script.
 * Guarantees zero Uzbek Cyrillic is ever saved or returned for "uz" locale.
 */
export function cyrillicToUzbekLatin(text: string): string {
  if (!text) return "";

  // If text has no Cyrillic characters, return as is
  if (!/[а-яёўқғҳА-ЯЁЎҚҒҲ]/i.test(text)) {
    return text;
  }

  let result = text;

  // 1. Initial / vowel-following 'Е'/'е' -> 'Ye'/'ye'
  result = result.replace(/(^|[\s\p{P}\p{S}\p{Z}]|[аеёиоуэюяўАЕЁИОУЭЮЯЎ])Е/gu, "$1Ye");
  result = result.replace(/(^|[\s\p{P}\p{S}\p{Z}]|[аеёиоуэюяўАЕЁИОУЭЮЯЎ])е/gu, "$1ye");

  // 2. Multi-letter capitals and standard combinations
  const multiMap: [RegExp, string][] = [
    [/Ё/g, "Yo"], [/ё/g, "yo"],
    [/Ю/g, "Yu"], [/ю/g, "yu"],
    [/Я/g, "Ya"], [/я/g, "ya"],
    [/Ч/g, "Ch"], [/ч/g, "ch"],
    [/Ш/g, "Sh"], [/ш/g, "sh"],
    [/Щ/g, "Sh"], [/щ/g, "sh"],
    [/Ў/g, "O‘"], [/ў/g, "o‘"],
    [/Ғ/g, "G‘"], [/ғ/g, "g‘"],
    [/Қ/g, "Q"], [/қ/g, "q"],
    [/Ҳ/g, "H"], [/ҳ/g, "h"],
    [/Ц/g, "Ts"], [/ц/g, "ts"],
  ];

  for (const [regex, replacement] of multiMap) {
    result = result.replace(regex, replacement);
  }

  // 3. Single character map
  const singleMap: Record<string, string> = {
    А: "A", а: "a",
    Б: "B", б: "b",
    В: "V", в: "v",
    Г: "G", г: "g",
    Д: "D", д: "d",
    Е: "E", е: "e",
    Ж: "J", ж: "j",
    З: "Z", з: "z",
    И: "I", и: "i",
    Й: "Y", й: "y",
    К: "K", к: "k",
    Л: "L", л: "l",
    М: "M", м: "m",
    Н: "N", н: "n",
    О: "O", о: "o",
    П: "P", п: "p",
    Р: "R", р: "r",
    С: "S", с: "s",
    Т: "T", т: "t",
    У: "U", у: "u",
    Ф: "F", ф: "f",
    Х: "X", х: "x",
    Ъ: "’", ъ: "’",
    Ь: "", ь: "",
    Э: "E", э: "e",
    Ы: "I", ы: "i",
  };

  result = result.replace(/[А-Яа-яЁёЎўҚқҒғҲҳ]/g, (char) => singleMap[char] ?? char);

  return result;
}

export async function translateContent(
  text: string,
  from: "uz" | "ru",
  to: "uz" | "ru"
): Promise<TranslationResult> {
  const trimmed = (text || "").trim();

  if (!trimmed) {
    return {
      success: true,
      translatedText: "",
      sourceText: "",
      from,
      to,
      status: "completed",
    };
  }

  if (from === to) {
    return {
      success: true,
      translatedText: to === "uz" ? cyrillicToUzbekLatin(trimmed) : trimmed,
      sourceText: trimmed,
      from,
      to,
      status: "same_language",
    };
  }

  // Protection: never send non-translatable structured values to translation
  if (isNonTranslatableText(trimmed)) {
    return {
      success: true,
      translatedText: trimmed,
      sourceText: trimmed,
      from,
      to,
      status: "skipped_non_translatable",
    };
  }

  try {
    const langpair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed
    )}&langpair=${langpair}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "AngrenEstatePlatform/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Translation HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const rawResult = data?.responseData?.translatedText;

    if (!rawResult || typeof rawResult !== "string") {
      throw new Error("Invalid translation response structure");
    }

    if (data.responseStatus !== 200 && data.responseStatus !== "200") {
      const errMsg = data.responseDetails || "Service limitation";
      return {
        success: false,
        translatedText: "",
        sourceText: trimmed,
        from,
        to,
        status: "failed",
        error: errMsg,
      };
    }

    let cleanedResult = decodeHtmlEntities(rawResult).trim();

    // STRICT: When target is Uzbek, guarantee it is 100% Latin
    if (to === "uz") {
      cleanedResult = cyrillicToUzbekLatin(cleanedResult);
    }

    return {
      success: true,
      translatedText: cleanedResult,
      sourceText: trimmed,
      from,
      to,
      status: "completed",
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Translation service unreachable";
    return {
      success: false,
      translatedText: "",
      sourceText: trimmed,
      from,
      to,
      status: "failed",
      error: errorMessage,
    };
  }
}
