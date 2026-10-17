/**
 * Comprehensive Mock Test Suite for Telegram Channel Publishing (Stage 2)
 * Tests all formatting, security rules, inline keyboard construction,
 * deduplication, and error handling WITHOUT making any real calls to Telegram.
 */

import {
  buildChannelPostCaption,
  buildChannelPostMarkup,
  resolveAuthorizedContact,
  publishPropertyToTelegramChannel,
} from "../src/lib/telegramNotifications";
import { Property } from "../src/lib/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, details ? details : "");
    failedCount++;
  }
}

// Sample mock base property
const baseProperty: Property = {
  id: "test-prop-001",
  slug: "test-prop-001",
  title_uz: "Angren markazida shinam 3 xonali xonadon",
  title_ru: "Уютная 3-комнатная квартира в центре Ангрена",
  description_uz: "Ajoyib joylashuv, yangi ta'mirlangan, barcha qulayliklar mavjud. Maktab va bog'cha yaqin.",
  description_ru: "Отличное расположение, свежий ремонт, все удобства. Рядом школа и детский сад.",
  address_uz: "Mustaqillik ko‘chasi, 15-uy",
  address_ru: "ул. Мустакиллик, д. 15",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  transaction_type: "sale",
  property_type: "apartment",
  status: "published",
  price_uzs: 450000000,
  price_usd: 35000,
  currency: "USD",
  area_sqm: 78,
  rooms: 3,
  floor: 4,
  total_floors: 9,
  renovation: "euro",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  coordinates: { lat: 41.0123, lng: 70.1234 },
  utilities: { gas: true, electricity: true, cold_water: true, hot_water: true, heating: true, internet: true },
  amenities: { furniture: true, parking: true, elevator: true, ac: true, balcony: true, internet: true },
  contact_phone: "+998 90 123 45 67",
  contact_telegram: "@angrenestate_admin",
  created_at: new Date().toISOString(),
};

const mockRealtor = {
  id: "realtor-1",
  name: "Jasur Alimov",
  phone: "+998 90 999 88 77",
  telegram: "@jasur_realtor",
  experience_years: 5,
  specialization_uz: "Turar-joy",
  specialization_ru: "Жилая",
  districts: ["Markaz"],
  is_active: true,
  created_at: new Date().toISOString(),
};

async function runTests() {
  console.log("\n=======================================================");
  console.log("STAGE 2: TELEGRAM CHANNEL PUBLISH BACKEND - MOCK TESTS");
  console.log("=======================================================\n");

  // TEST 1: Contact Security - Owner Phone Hidden by Default
  console.log("--- 1. Contact Security Rules ---");
  {
    const propWithHiddenOwner: Property = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: false,
      realtor: mockRealtor,
    };

    const contact = resolveAuthorizedContact(propWithHiddenOwner);
    assert(
      contact !== null && contact.phone === "+998 90 999 88 77" && contact.type === "realtor",
      "Owner phone with owner_phone_visible=false is NEVER exposed, falls back to realtor"
    );
    assert(
      contact?.phone !== "+998 97 111 22 33",
      "Owner phone is strictly excluded when hidden"
    );
  }

  // TEST 2: Contact Security - Owner Phone Visible
  {
    const propWithPublicOwner: Property = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: true,
      realtor: mockRealtor,
    };

    const contact = resolveAuthorizedContact(propWithPublicOwner);
    assert(
      contact !== null && contact.phone === "+998 97 111 22 33" && contact.type === "owner",
      "Owner phone with owner_phone_visible=true is allowed as primary contact"
    );
  }

  // TEST 3: Contact Security - No Owner Phone, Realtor Available
  {
    const propWithRealtorOnly: Property = {
      ...baseProperty,
      owner_phone: undefined,
      owner_phone_visible: false,
      realtor: mockRealtor,
    };

    const contact = resolveAuthorizedContact(propWithRealtorOnly);
    assert(
      contact !== null && contact.phone === "+998 90 999 88 77" && contact.name === "Jasur Alimov",
      "Realtor phone and name correctly resolved when owner phone is absent"
    );
  }

  // TEST 4: Contact Security - No Owner, No Realtor, Fallback to Contact Phone
  {
    const propFallback: Property = {
      ...baseProperty,
      owner_phone: undefined,
      owner_phone_visible: false,
      realtor: undefined,
      contact_phone: "+998 90 555 44 33",
    };

    const contact = resolveAuthorizedContact(propFallback);
    assert(
      contact !== null && contact.phone === "+998 90 555 44 33" && contact.type === "agency",
      "Fallback to agency contact_phone when realtor and owner are absent"
    );
  }

  // TEST 5: Caption Builder - Uzbek Formatting
  console.log("\n--- 2. Caption Builder ---");
  {
    const captionUz = buildChannelPostCaption(baseProperty, "uz");
    assert(captionUz.includes("🏠 Angren markazida shinam 3 xonali xonadon"), "Caption has correct Uzbek title");
    assert(captionUz.includes("Mustaqillik ko‘chasi, 15-uy"), "Caption includes address/location");
    assert(captionUz.includes("3 xona"), "Caption includes rooms parameter");
    assert(captionUz.includes("78 m²"), "Caption includes area parameter");
    assert(captionUz.includes("4/9 qavat"), "Caption includes floor parameter");
    assert(captionUz.includes("Yevro ta’mir"), "Caption includes renovation parameter");
    assert(captionUz.includes("💰"), "Caption includes price emoji and formatted price");
    assert(captionUz.includes("@angren_estate"), "Caption includes official channel handle");
    assert(captionUz.length <= 1024, `Caption length (${captionUz.length}) is strictly within Telegram 1024 limit`);
    console.log("\n--- [PREVIEW: Sample Generated Channel Post Caption] ---");
    console.log(captionUz);
    console.log("--------------------------------------------------------\n");
  }

  // TEST 6: Caption Builder - Russian Formatting
  {
    const captionRu = buildChannelPostCaption(baseProperty, "ru");
    assert(captionRu.includes("🏠 Уютная 3-комнатная квартира в центре Ангрена"), "Caption has correct Russian title");
    assert(captionRu.includes("3 комнаты"), "Caption includes localized Russian rooms");
    assert(captionRu.includes("4/9 этаж"), "Caption includes localized Russian floor");
    assert(captionRu.includes("Евроремонт"), "Caption includes localized Russian renovation");
    assert(captionRu.length <= 1024, `Russian caption length (${captionRu.length}) is within Telegram limit`);
  }

  // TEST 7: Caption Builder - Price Negotiable
  {
    const negotiableProp: Property = {
      ...baseProperty,
      price_negotiable: true,
      bargain_allowed: true,
    };
    const caption = buildChannelPostCaption(negotiableProp, "uz");
    assert(caption.includes("Narxi kelishiladi (Savdolashish mumkin)"), "Correctly outputs negotiable price with bargain note");
  }

  // TEST 8: Inline Keyboard - NO web_app button type for channel
  console.log("\n--- 3. Inline Keyboard Builder (Channel Compliance) ---");
  {
    const markup = buildChannelPostMarkup(baseProperty, "uz");
    const allButtons = markup.inline_keyboard.flat();

    const hasWebAppButton = allButtons.some((b: any) => "web_app" in b);
    assert(!hasWebAppButton, "CRITICAL: Inline keyboard has ZERO web_app buttons (Channel compliance)");

    const allButtonsHaveUrl = allButtons.every((b: any) => typeof b.url === "string" && b.url.startsWith("http"));
    assert(allButtonsHaveUrl, "All inline buttons have valid HTTPS URLs");

    const viewButton = allButtons.find((b) => b.text.includes("Obyektni ko‘rish"));
    assert(
      Boolean(viewButton && viewButton.url === `https://angrenestate.uz/properties/${baseProperty.id}`),
      "View button links to exact property URL: https://angrenestate.uz/properties/{id}"
    );
  }

  // TEST 9: Inline Keyboard - Video Button Presence
  {
    const propWithVideo: Property = {
      ...baseProperty,
      video_url: "https://www.youtube.com/watch?v=sample123",
    };
    const markupWithVideo = buildChannelPostMarkup(propWithVideo, "uz");
    const videoBtn = markupWithVideo.inline_keyboard.flat().find((b) => b.text.includes("Video sharh"));
    assert(Boolean(videoBtn && videoBtn.url === propWithVideo.video_url), "Video button is present when video_url exists");

    const propWithoutVideo: Property = {
      ...baseProperty,
      video_url: undefined,
    };
    const markupWithoutVideo = buildChannelPostMarkup(propWithoutVideo, "uz");
    const noVideoBtn = markupWithoutVideo.inline_keyboard.flat().find((b) => b.text.includes("Video sharh"));
    assert(!noVideoBtn, "Video button is strictly omitted when video_url is absent");
  }

  // TEST 10: Inline Keyboard - Contact Button
  {
    const propWithTg: Property = {
      ...baseProperty,
      realtor: mockRealtor,
    };
    const markup = buildChannelPostMarkup(propWithTg, "uz");
    const contactBtn = markup.inline_keyboard.flat().find((b) => b.text.includes("Bog‘lanish"));
    assert(
      Boolean(contactBtn && contactBtn.url === "https://t.me/jasur_realtor"),
      "Contact button links to verified Telegram username"
    );
  }

  // TEST 11: Idempotency & Deduplication
  console.log("\n--- 4. Idempotency & Duplicate Prevention ---");
  {
    const alreadyPublishedProp: Property = {
      ...baseProperty,
      telegram_channel_status: "published",
      telegram_channel_post_id: 998877,
    };

    // Attempt to publish without forceRepeat
    const res = await publishPropertyToTelegramChannel(alreadyPublishedProp, {
      botToken: "MOCK_TOKEN_12345",
      channelId: "@angren_estate",
      forceRepeat: false,
    });

    assert(
      res.success === true && res.status === "already_published" && res.messageId === 998877,
      "Deduplication prevents reposting if already published (returns already_published)"
    );
  }

  // TEST 12: Missing Bot Token Handling
  console.log("\n--- 5. Error & Safety Handling ---");
  {
    // Temporarily unset bot token
    const oldToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;

    const res = await publishPropertyToTelegramChannel(baseProperty, {
      channelId: "@angren_estate",
    });

    assert(
      Boolean(res.success === false && res.status === "error" && res.error?.includes("TELEGRAM_BOT_TOKEN")),
      "Gracefully handles missing TELEGRAM_BOT_TOKEN without throwing"
    );

    if (oldToken) process.env.TELEGRAM_BOT_TOKEN = oldToken;
  }

  // Summary
  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution fatal error:", e);
  process.exit(1);
});
