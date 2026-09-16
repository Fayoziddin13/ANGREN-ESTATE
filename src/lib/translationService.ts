/**
 * ANGREN ESTATE - Server-Side Content Translation Service
 * Supports bidirectional translation between Uzbek (Latin) and Russian.
 * Resilient against network issues, handles entity decoding, and protects structured data.
 */

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  sourceText: string;
  from: "uz" | "ru";
  to: "uz" | "ru";
  status: "completed" | "failed" | "same_language";
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
      translatedText: trimmed,
      sourceText: trimmed,
      from,
      to,
      status: "same_language",
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
        translatedText: trimmed,
        sourceText: trimmed,
        from,
        to,
        status: "failed",
        error: errMsg,
      };
    }

    const cleanedResult = decodeHtmlEntities(rawResult).trim();

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
      translatedText: trimmed,
      sourceText: trimmed,
      from,
      to,
      status: "failed",
      error: errorMessage,
    };
  }
}
