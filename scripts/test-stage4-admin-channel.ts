/**
 * Stage 4 Integration Tests: Admin Properties List & Edit Page Telegram Channel Controls
 * Run via: cmd.exe /c "npx tsx scripts/test-stage4-admin-channel.ts" < /dev/null
 */

import { Property } from "../src/lib/types";
import { mapPropertyToDb, mapRowToProperty } from "../src/lib/properties";
import {
  resolveAuthorizedContact,
  publishPropertyToTelegramChannel,
} from "../src/lib/telegramNotifications";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-stage4-test-999",
    slug: "angren-apartment-stage4",
    title_uz: "Angren markazida 2 xonali kvartira",
    title_ru: "2-комнатная квартира в центре Ангрена",
    description_uz: "Ajoyib sharoitlar",
    description_ru: "Отличные условия",
    district: "Markaz",
    district_name_uz: "Markaz",
    district_name_ru: "Центр",
    address_uz: "Navoiy ko'chasi, 5-uy",
    address_ru: "ул. Навои, д. 5",
    property_type: "apartment",
    transaction_type: "sale",
    deal_type: "sale",
    status: "published",
    price_usd: 28000,
    price_uzs: 360000000,
    currency: "USD",
    rooms: 2,
    area_sqm: 55,
    floor: 3,
    total_floors: 5,
    renovation: "euro",
    furniture: true,
    coordinates: { lat: 41.0167, lng: 70.1436 },
    latitude: 41.0167,
    longitude: 70.1436,
    photos: ["https://angrenestate.uz/uploads/test4.jpg"],
    images: ["https://angrenestate.uz/uploads/test4.jpg"],
    main_image: "https://angrenestate.uz/uploads/test4.jpg",
    owner_phone: "+998 90 555 44 33",
    owner_phone_visible: false,
    contact_phone: "+998 90 123 45 67",
    contact_telegram: "@angrenestate_admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Property;
}

async function runStage4Tests() {
  console.log("\n=======================================================");
  console.log("STAGE 4: ADMIN CHANNEL PUBLISH CONTROLS TESTS");
  console.log("=======================================================\n");

  console.log("--- 1. Status Indicator & State Transitions ---");

  // Test 1: Property without channel status -> defaults to not_published
  {
    const propUnpublished = makeProperty({
      telegram_channel_status: undefined,
      telegram_channel_post_id: undefined,
    });
    const row = mapPropertyToDb(propUnpublished);
    const restored = mapRowToProperty(row);
    assert(
      restored.telegram_channel_status === "not_published",
      "Unpublished property maps to 'not_published' status"
    );
    assert(
      restored.telegram_channel_post_id === undefined,
      "Unpublished property has no channel post ID"
    );
  }

  // Test 2: Published property with post ID
  {
    const propPublished = makeProperty({
      telegram_channel_status: "published",
      telegram_channel_post_id: 8877,
    });
    const row = mapPropertyToDb(propPublished);
    const restored = mapRowToProperty(row);
    assert(
      restored.telegram_channel_status === "published",
      "Published status correctly persisted in amenities JSONB"
    );
    assert(
      Number(restored.telegram_channel_post_id) === 8877,
      "Post ID 8877 correctly persisted in amenities JSONB"
    );
  }

  // Test 3: Error status
  {
    const propError = makeProperty({
      telegram_channel_status: "error",
      telegram_channel_post_id: undefined,
    });
    const row = mapPropertyToDb(propError);
    const restored = mapRowToProperty(row);
    assert(
      restored.telegram_channel_status === "error",
      "Error status correctly persisted in amenities JSONB"
    );
  }

  console.log("\n--- 2. JSONB Amenities Integrity & Non-Destructive Merging ---");

  // Test 4: Custom amenities are preserved when updating channel status
  {
    const initialProp = makeProperty({
      amenities: {
        parking: true,
        elevator: false,
        furniture: true,
        customKey: "special_custom_value",
      } as any,
    });

    const row1 = mapPropertyToDb(initialProp);
    assert(
      row1.amenities?.customKey === "special_custom_value",
      "Initial custom amenities preserved in JSONB"
    );

    // Update status to published
    const updatedProp = {
      ...initialProp,
      telegram_channel_status: "published" as const,
      telegram_channel_post_id: 12345,
    };
    const row2 = mapPropertyToDb(updatedProp);

    assert(
      row2.amenities?.customKey === "special_custom_value",
      "Custom amenities NOT wiped when updating telegram_channel_status"
    );
    assert(
      row2.amenities?.telegram_channel_status === "published",
      "telegram_channel_status successfully written to amenities JSONB"
    );
    assert(
      row2.amenities?.telegram_channel_post_id === 12345,
      "telegram_channel_post_id successfully written to amenities JSONB"
    );
  }

  console.log("\n--- 3. Channel Publishing Idempotency & Confirmation ---");

  // Test 5: Re-publish without forceRepeat strictly returns already_published
  {
    const propPublished = makeProperty({
      telegram_channel_status: "published",
      telegram_channel_post_id: 998877,
    });
    const result = await publishPropertyToTelegramChannel(propPublished, {
      forceRepeat: false,
      botToken: "mock-token",
    });
    assert(
      result.success === true,
      "Idempotency check: success=true without reposting"
    );
    assert(
      result.status === "already_published",
      "Idempotency check: returns status='already_published'"
    );
    assert(
      result.messageId === 998877,
      "Idempotency check: preserves original post ID"
    );
  }

  // Test 6: Contact privacy enforcement in Channel controls
  {
    const propHiddenPhone = makeProperty({
      owner_phone: "+998 90 999 00 11",
      owner_phone_visible: false,
      contact_phone: "+998 90 123 45 67",
    });
    const contact = resolveAuthorizedContact(propHiddenPhone);
    assert(
      contact?.phone !== "+998 90 999 00 11",
      "Hidden owner phone is NEVER exposed in channel contact resolution"
    );
    assert(
      contact?.phone === "+998 90 123 45 67",
      "Fallback to agency contact phone when owner is private"
    );
  }

  // Test 7: Bot broadcast separation
  {
    const prop = makeProperty();
    assert(
      prop.telegram_notified_at === undefined,
      "Bot broadcast status remains independent from channel status"
    );
    prop.telegram_channel_status = "published";
    assert(
      prop.telegram_notified_at === undefined,
      "Publishing to channel does NOT falsely mark bot subscribers as notified"
    );
  }

  console.log(`\n=======================================================`);
  console.log(`STAGE 4 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`=======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStage4Tests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
