/**
 * Probe script for additional Uzbekistan sources:
 * - cbu.uz Russian
 * - stat.uz
 * - kadastr.uz
 * - soliq.uz
 * - mc.uz / qurilish
 * - norma.uz
 * - podrobno.uz
 * - banker.uz
 */

const testUrls = [
  "https://cbu.uz/ru/press_center/news/rss/",
  "https://cbu.uz/en/press_center/news/rss/",
  
  // norma.uz (leading legal, tax and property portal in Uzbekistan)
  "https://www.norma.uz/rss",
  "https://www.norma.uz/uz/rss",
  "https://norma.uz/rss",
  "https://nrm.uz/rss",

  // podrobno.uz
  "https://podrobno.uz/rss",
  "https://podrobno.uz/feed",
  "https://podrobno.uz/rss.php",

  // banker.uz (mortgage & banking news)
  "https://banker.uz/rss",
  "https://banker.uz/feed",

  // kadastr.uz & ygk.uz (Davlat kadastrlari palatasi)
  "https://kadastr.uz/feed",
  "https://kadastr.uz/news/feed",
  "https://kadastr.uz/uz/feed",
  "https://kadastr.uz/api/news",
  "https://ygk.uz/rss",

  // stat.uz
  "https://stat.uz/api/v1/news",
  "https://stat.uz/open-data",

  // soliq.uz
  "https://soliq.uz/feed",
  "https://soliq.uz/api/news",

  // Ministry of Construction (Qurilish va uy-joy kommunal xo'jaligi vazirligi)
  "https://mc.uz/feed",
  "https://mc.uz/uz/feed",
  "https://mc.uz/news",
];

async function check() {
  for (const url of testUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, application/json, */*",
        },
      });
      clearTimeout(timeout);
      const cType = res.headers.get("content-type") || "";
      const text = await res.text();
      const isXml = text.includes("<rss") || text.includes("<feed") || text.includes("<?xml") || cType.includes("xml");
      const isJson = cType.includes("json") || (text.startsWith("{") && text.endsWith("}"));
      const items = text.match(/<item[\s\S]*?<\/item>/gi) || text.match(/<entry[\s\S]*?<\/entry>/gi) || [];

      if (res.status === 200 && (isXml || isJson)) {
        console.log(`[CANDIDATE 200] ${url} | XML: ${isXml} (items: ${items.length}) | JSON: ${isJson} | len: ${text.length}`);
      } else {
        console.log(`[STATUS ${res.status}] ${url} | isXml: ${isXml}`);
      }
    } catch (e: any) {
      console.log(`[ERR] ${url}: ${e.message}`);
    }
  }
}

check();
