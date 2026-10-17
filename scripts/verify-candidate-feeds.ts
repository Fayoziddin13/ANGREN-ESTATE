/**
 * Live Feed Verification for all 11 Trusted Sources
 * Run: npx tsx scripts/verify-candidate-feeds.ts
 */

import { safeFetchFeed } from "../src/lib/sourceSecurity";
import { parseRssXml } from "../src/lib/newsHarvester";

const all11Feeds = [
  { id: 1, name: "Lex.uz — Qonunchilik maʼlumotlari milliy bazasi", url: "https://lex.uz/rss", trust: "official_gov" },
  { id: 2, name: "Lex.uz — Законодательство Узбекистана (RU)", url: "https://lex.uz/ru/rss", trust: "official_gov" },
  { id: 3, name: "O‘zbekiston Markaziy Banki — Ipoteka va moliya", url: "https://cbu.uz/uz/press_center/news/rss/", trust: "official_gov" },
  { id: 4, name: "O‘zA — Milliy axborot agentligi (Rasmiy xabarlar)", url: "https://uza.uz/uz/rss", trust: "official_gov" },
  { id: 5, name: "УзА — Официальные новости Узбекистана (RU)", url: "https://uza.uz/ru/rss", trust: "official_gov" },
  { id: 6, name: "Gazeta.uz — Iqtisodiyot va Ko‘chmas mulk", url: "https://www.gazeta.uz/uz/rss/", trust: "reputable_media" },
  { id: 7, name: "Gazeta.uz — Недвижимость и экономика (RU)", url: "https://www.gazeta.uz/ru/rss/", trust: "reputable_media" },
  { id: 8, name: "Spot.uz — Biznes va Ko‘chmas mulk", url: "https://www.spot.uz/rss/", trust: "reputable_media" },
  { id: 9, name: "Kun.uz — Iqtisodiyot, qurilish va jamiyat", url: "https://kun.uz/news/rss", trust: "reputable_media" },
  { id: 10, name: "Daryo.uz — Qurilish va Infratuzilma", url: "https://daryo.uz/rss", trust: "reputable_media" },
  { id: 11, name: "Podrobno.uz — Урбанистика и недвижимость", url: "https://podrobno.uz/rss", trust: "reputable_media" },
];

async function verifyAll11() {
  console.log("================================================================================");
  console.log("LIVE VERIFICATION OF ALL 11 TRUSTED RSS SOURCES");
  console.log("================================================================================\n");

  let workingCount = 0;
  let failedCount = 0;

  for (const feed of all11Feeds) {
    const t0 = Date.now();
    try {
      const resp = await safeFetchFeed(feed.url, { timeoutMs: 12000 });
      const elapsed = Date.now() - t0;
      if (!resp.ok) {
        console.log(`❌ [${feed.id}/11] ${feed.name}: HTTP ${resp.status} (${elapsed}ms)`);
        failedCount++;
        continue;
      }
      const text = await resp.text();
      const items = parseRssXml(text);
      if (items.length === 0) {
        console.log(`⚠️ [${feed.id}/11] ${feed.name}: HTTP ${resp.status} (${elapsed}ms) - 0 items found`);
      } else {
        console.log(`✅ [${feed.id}/11] ${feed.name}: HTTP ${resp.status} (${elapsed}ms) - ${items.length} items parsed`);
        console.log(`      Sample: "${items[0].title.slice(0, 60)}" -> ${items[0].link}`);
        workingCount++;
      }
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      console.log(`❌ [${feed.id}/11] ${feed.name}: FAILED (${elapsed}ms) -> ${err.message}`);
      failedCount++;
    }
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY: Working: ${workingCount}/11 | Failed: ${failedCount}/11`);
  console.log("================================================================================");
}

verifyAll11();
