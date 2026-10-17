/**
 * PRODUCTION URL & SECURITY VALIDATION TEST SUITE
 *
 * Verifies that:
 * 1. Production property URL is reliably resolved to 'https://angrenestate.uz/properties/{id}'.
 * 2. Any 'localhost', '127.0.0.1', or 'http://' URL is strictly rejected and never sent to Telegram.
 * 3. Video review and contact buttons never leak localhost or private owner phone numbers.
 * 4. Pre-flight keyboard validation prevents invalid URLs from ever reaching Telegram Bot API.
 * 5. Idempotency (already_published) and error handling are fully preserved.
 *
 * STRICTLY MOCKED: Zero real calls to Telegram or live modifications to Supabase.
 */

import {
  PRODUCTION_SITE_URL,
  getTelegramPublicSiteUrl,
  buildPropertyPublicUrl,
  buildChannelPostMarkup,
  resolveAuthorizedContact,
  publishPropertyToTelegramChannel,
} from "../src/lib/telegramNotifications";
import { Property } from "../src/lib/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: any, testName: string, details?: any) {
  if (Boolean(condition)) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, details !== undefined ? details : "");
    failedCount++;
  }
}

const mockProperty: Property = {
  id: "prop-1791227561065",
  slug: "prop-1791227561065",
  title_uz: "Angren markazidagi 3 xonali xonadon",
  title_ru: "3-комнатная квартира в центре Ангрена",
  description_uz: "Qulay joylashuv, shinam xonalar.",
  description_ru: "Удобное расположение, уютные комнаты.",
  address_uz: "Mustaqillik ko‘chasi, 10-uy",
  address_ru: "ул. Мустакиллик, д. 10",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  transaction_type: "sale",
  property_type: "apartment",
  status: "published",
  price_uzs: 400000000,
  price_usd: 32000,
  currency: "USD",
  area_sqm: 72,
  rooms: 3,
  floor: 4,
  total_floors: 9,
  renovation: "euro",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  coordinates: { lat: 41.012, lng: 70.123 },
  utilities: { gas: true, electricity: true, cold_water: true, hot_water: true, heating: true, internet: true },
  amenities: {
    furniture: true,
    parking: true,
    elevator: true,
    ac: true,
    balcony: true,
    internet: true,
  },
  owner_phone: "+998 90 999 00 11",
  owner_phone_visible: false,
  realtor: {
    id: "realtor-55",
    name: "Alisher Rahimov",
    phone: "+998 90 123 45 67",
    telegram: "@alisher_realtor",
    experience_years: 4,
    specialization_uz: "Kvartira",
    specialization_ru: "Квартиры",
    districts: ["Markaz"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  contact_phone: "+998 90 123 45 67",
  contact_telegram: "@angrenestate_admin",
  created_at: new Date().toISOString(),
};

async function runUrlValidationTests() {
  console.log("\n=======================================================");
  console.log("PRODUCTION URL & TELEGRAM BUTTON VALIDATION TESTS");
  console.log("=======================================================\n");

  const savedEnvUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const savedSiteUrl = process.env.SITE_URL;

  // -------------------------------------------------------------------------
  // 1. DOMAIN RESOLVER (getTelegramPublicSiteUrl)
  // -------------------------------------------------------------------------
  console.log("--- 1. Base URL Resolution Tests ---");

  // 1.1: Default fallback
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  assert(
    getTelegramPublicSiteUrl() === "https://angrenestate.uz",
    "1.1: Defaults to https://angrenestate.uz when env variables are unset"
  );

  // 1.2: Rejection of localhost (CRITICAL BUG REPRODUCTION & FIX)
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  assert(
    getTelegramPublicSiteUrl() === "https://angrenestate.uz",
    "1.2: Strictly rejects 'http://localhost:3000' and falls back to production HTTPS domain"
  );

  // 1.3: Rejection of 127.0.0.1
  process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:8080";
  assert(
    getTelegramPublicSiteUrl() === "https://angrenestate.uz",
    "1.3: Strictly rejects 'http://127.0.0.1' and falls back to production HTTPS domain"
  );

  // 1.4: Rejection of insecure http:// domain
  process.env.NEXT_PUBLIC_SITE_URL = "http://angrenestate.uz";
  assert(
    getTelegramPublicSiteUrl() === "https://angrenestate.uz",
    "1.4: Strictly rejects insecure 'http://' and falls back to 'https://'"
  );

  // 1.5: Valid custom HTTPS production domain
  process.env.NEXT_PUBLIC_SITE_URL = "https://angrenestate.uz/";
  assert(
    getTelegramPublicSiteUrl() === "https://angrenestate.uz",
    "1.5: Valid HTTPS production domain accepted with trailing slash cleanly trimmed"
  );

  // -------------------------------------------------------------------------
  // 2. PROPERTY PUBLIC URL BUILDER (buildPropertyPublicUrl)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Property Public URL Builder Tests ---");

  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"; // simulate local dev environment
  const propUrl = buildPropertyPublicUrl("prop-1791227561065");
  assert(
    propUrl === "https://angrenestate.uz/properties/prop-1791227561065",
    "2.1: Property URL is 'https://angrenestate.uz/properties/prop-1791227561065'"
  );
  assert(
    !propUrl.includes("localhost"),
    "2.2: Property URL NEVER contains 'localhost' even if NEXT_PUBLIC_SITE_URL is localhost"
  );
  assert(
    propUrl.startsWith("https://"),
    "2.3: Property URL strictly starts with 'https://'"
  );

  const localizedPropUrl = buildPropertyPublicUrl("prop-1791227561065", "uz");
  assert(
    localizedPropUrl === "https://angrenestate.uz/properties/prop-1791227561065?lang=uz",
    "2.4: Localized property URL includes query parameter correctly"
  );

  // -------------------------------------------------------------------------
  // 3. INLINE KEYBOARD MARKUP BUILDER (buildChannelPostMarkup)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Channel Post Inline Keyboard Markup Tests ---");

  // Simulate local dev env in process.env
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  const propWithLocalVideo: Property = {
    ...mockProperty,
    video_url: "http://localhost:3000/video.mp4", // Malicious / local video URL
  };

  const markup = buildChannelPostMarkup(propWithLocalVideo, "uz");
  const allButtons = markup.inline_keyboard.flat();

  // Button A: View Object
  const viewButton = allButtons.find((b) => b.text.includes("Obyektni ko‘rish"));
  assert(viewButton !== undefined, "3.1: 'Obyektni ko‘rish' button exists");
  assert(
    viewButton?.url === "https://angrenestate.uz/properties/prop-1791227561065",
    "3.2: 'Obyektni ko‘rish' button URL is strictly 'https://angrenestate.uz/properties/prop-1791227561065'"
  );
  assert(
    !viewButton?.url.includes("localhost"),
    "3.3: 'Obyektni ko‘rish' button NEVER uses 'http://localhost:3000'"
  );

  // Button B: Video review with local URL
  const videoButtonLocal = allButtons.find((b) => b.text.includes("Video"));
  assert(
    videoButtonLocal === undefined,
    "3.4: Video button with localhost URL is STRICTLY OMITTED from inline keyboard"
  );

  // Button B: Valid HTTPS video review
  const propWithHttpsVideo: Property = {
    ...mockProperty,
    video_url: "https://youtube.com/watch?v=sample123",
  };
  const markupWithVideo = buildChannelPostMarkup(propWithHttpsVideo, "uz");
  const videoButtonValid = markupWithVideo.inline_keyboard.flat().find((b) => b.text.includes("Video"));
  assert(
    videoButtonValid?.url === "https://youtube.com/watch?v=sample123",
    "3.5: Valid public HTTPS video URL is preserved"
  );

  // Button B: Insecure http:// video review (must be omitted, not blindly converted)
  const propWithHttpVideo: Property = {
    ...mockProperty,
    video_url: "http://insecure-video-host.com/sample.mp4",
  };
  const markupWithHttpVideo = buildChannelPostMarkup(propWithHttpVideo, "uz");
  const videoButtonHttp = markupWithHttpVideo.inline_keyboard.flat().find((b) => b.text.includes("Video"));
  assert(
    videoButtonHttp === undefined,
    "3.6: Insecure http:// video URL is strictly omitted (not blindly converted to https)"
  );

  // Button C: Contact Privacy Check
  const contact = resolveAuthorizedContact(mockProperty);
  assert(
    contact?.phone === "+998 90 123 45 67",
    "3.7: Owner phone hidden: falls back to realtor phone (+998 90 123 45 67)"
  );
  const contactButton = allButtons.find((b) => b.text.includes("Bog‘lanish"));
  assert(
    contactButton?.url === "https://t.me/alisher_realtor",
    "3.8: Contact button links to verified Telegram handle 'https://t.me/alisher_realtor'"
  );
  assert(
    !contactButton?.url.includes("9990011"),
    "3.9: Owner phone (+998 90 999 00 11) is NEVER exposed in button URL"
  );

  // -------------------------------------------------------------------------
  // 4. PRE-FLIGHT VALIDATION IN publishPropertyToTelegramChannel
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Pre-flight URL Protection & Publishing Tests ---");

  const originalFetch = global.fetch;

  // 4.1: Normal publish with mock fetch
  {
    let interceptedUrl: string | undefined;
    let interceptedPayload: any;

    global.fetch = async (url: any, opts: any) => {
      interceptedUrl = String(url);
      interceptedPayload = JSON.parse(opts?.body || "{}");
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 100200 },
        }),
      } as any;
    };

    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async (_id, upd) => ({ ...mockProperty, ...upd }),
    });

    assert(res.success === true, "4.1: publishPropertyToTelegramChannel returns success=true");
    assert(res.status === "published", "4.1: Status is 'published'");
    assert(res.messageId === 100200, "4.1: messageId is 100200");
    assert(res.dbPersisted === true, "4.1: dbPersisted is true");

    // Inspect payload sent to Telegram Bot API
    const replyMarkupSent = interceptedPayload?.reply_markup;
    const buttonsSent = replyMarkupSent?.inline_keyboard?.flat() || [];
    const sentButtonUrl = buttonsSent[0]?.url;

    assert(
      sentButtonUrl === "https://angrenestate.uz/properties/prop-1791227561065",
      "4.2: Payload sent to Telegram API strictly has 'https://angrenestate.uz/properties/prop-1791227561065'"
    );
    assert(
      !sentButtonUrl?.includes("localhost"),
      "4.3: Payload sent to Telegram API has ZERO occurrences of 'localhost'"
    );
  }

  // 4.4: Deduplication check
  {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 999 } }) } as any;
    };

    const publishedProp: Property = {
      ...mockProperty,
      telegram_channel_status: "published",
      telegram_channel_post_id: 100200,
    };

    const dedupRes = await publishPropertyToTelegramChannel(publishedProp, {
      botToken: "dummy_mock_token",
      forceRepeat: false,
    });

    assert(dedupRes.success === true, "4.4: Deduplication prevents reposting already published property");
    assert(dedupRes.status === "already_published", "4.4: Returns status='already_published'");
    assert(fetchCalled === false, "4.4: Telegram Bot API was NOT called for already published property");
  }

  // Restore fetch and environment
  global.fetch = originalFetch;
  if (savedEnvUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = savedEnvUrl;
  else delete process.env.NEXT_PUBLIC_SITE_URL;
  if (savedSiteUrl !== undefined) process.env.SITE_URL = savedSiteUrl;
  else delete process.env.SITE_URL;

  console.log("\n=======================================================");
  console.log(`URL VALIDATION TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runUrlValidationTests().catch((err) => {
  console.error("FATAL URL VALIDATION TEST ERROR:", err);
  process.exit(1);
});
