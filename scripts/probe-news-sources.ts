/**
 * Probe script to discover and test RSS/Atom feeds from official Uzbekistan domains and media.
 */

interface ProbeResult {
  domain: string;
  testedUrl: string;
  status: number | "error";
  contentType?: string;
  isXml: boolean;
  itemCount: number;
  sampleTitle?: string;
  error?: string;
}

const candidates = [
  // Official Gov
  { domain: "lex.uz", urls: ["https://lex.uz/rss", "https://lex.uz/uz/rss", "https://lex.uz/ru/rss"] },
  { domain: "gov.uz", urls: ["https://gov.uz/rss", "https://gov.uz/uz/rss", "https://gov.uz/ru/rss", "https://gov.uz/uz/news/rss", "https://gov.uz/api/news"] },
  { domain: "stat.uz", urls: ["https://stat.uz/rss", "https://stat.uz/uz/rss", "https://stat.uz/ru/rss", "https://stat.uz/uz/yangiliklar?format=feed&type=rss"] },
  { domain: "cbu.uz", urls: ["https://cbu.uz/rss", "https://cbu.uz/uz/rss", "https://cbu.uz/ru/rss", "https://cbu.uz/uz/press_center/news/rss/", "https://cbu.uz/uz/arkhiv-kursov/xml/"] },
  { domain: "soliq.uz", urls: ["https://soliq.uz/rss", "https://soliq.uz/uz/rss", "https://soliq.uz/press-services/news/rss", "https://my.soliq.uz/rss"] },
  { domain: "kadastr.uz", urls: ["https://kadastr.uz/rss", "https://kadastr.uz/uz/rss", "https://kadastr.uz/ru/rss", "https://kadastr.uz/press-center/news/rss"] },
  { domain: "mc.uz", urls: ["https://mc.uz/rss", "https://mc.uz/uz/rss", "https://mc.uz/ru/rss", "https://qurilish.gov.uz/rss", "https://qurilish.uz/rss"] },
  { domain: "my.gov.uz", urls: ["https://my.gov.uz/rss", "https://my.gov.uz/uz/rss", "https://my.gov.uz/ru/rss", "https://my.gov.uz/uz/news/rss"] },

  // Reputable media
  { domain: "gazeta.uz", urls: ["https://www.gazeta.uz/uz/rss/", "https://www.gazeta.uz/ru/rss/"] },
  { domain: "spot.uz", urls: ["https://www.spot.uz/rss/", "https://www.spot.uz/ru/rss/"] },
  { domain: "kun.uz", urls: ["https://kun.uz/rss", "https://kun.uz/uz/rss", "https://kun.uz/ru/rss", "https://kun.uz/news/rss"] },
  { domain: "daryo.uz", urls: ["https://daryo.uz/rss", "https://daryo.uz/feed"] },
  { domain: "uza.uz", urls: ["https://uza.uz/rss", "https://uza.uz/uz/rss", "https://uza.uz/ru/rss", "https://uza.uz/uz/posts/rss"] },
];

async function probeUrl(url: string): Promise<ProbeResult> {
  const domain = new URL(url).hostname;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = resp.headers.get("content-type") || "";
    const text = await resp.text();

    const isXml =
      text.includes("<rss") ||
      text.includes("<feed") ||
      text.includes("<?xml") ||
      contentType.includes("xml") ||
      contentType.includes("rss");

    let itemCount = 0;
    let sampleTitle: string | undefined;

    if (isXml) {
      const items = text.match(/<item[\s\S]*?<\/item>/gi) || text.match(/<entry[\s\S]*?<\/entry>/gi) || [];
      itemCount = items.length;
      if (items.length > 0 && items[0]) {
        const titleMatch = items[0].match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
        if (titleMatch) {
          sampleTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").trim().slice(0, 60);
        }
      }
    }

    return {
      domain,
      testedUrl: url,
      status: resp.status,
      contentType,
      isXml,
      itemCount,
      sampleTitle,
    };
  } catch (err: any) {
    return {
      domain,
      testedUrl: url,
      status: "error",
      isXml: false,
      itemCount: 0,
      error: err?.message || String(err),
    };
  }
}

async function run() {
  console.log("PROBING CANDIDATE NEWS SOURCES FOR RSS/ATOM FEEDS...\n");
  const allUrls = candidates.flatMap((c) => c.urls);

  for (const url of allUrls) {
    const res = await probeUrl(url);
    if (res.status === 200 && res.isXml && res.itemCount > 0) {
      console.log(`[WORKING FEED] ${res.testedUrl}`);
      console.log(`   Items: ${res.itemCount} | Sample: "${res.sampleTitle}"`);
    } else {
      console.log(`[FAILED] ${res.testedUrl} -> status: ${res.status}, isXml: ${res.isXml}, items: ${res.itemCount}, err: ${res.error || "none"}`);
    }
  }
}

run();
