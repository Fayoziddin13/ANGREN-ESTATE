/**
 * POST-PUSH HOTFIX VALIDATION TEST SUITE
 *
 * Specifically verifies:
 * 1. Scenario: Telegram API returns `ok: true`, but `result.message_id` is missing/invalid.
 * 2. Scenario: Telegram post succeeds, but DB status persistence fails (MUST NOT be hidden as success).
 * 3. Scenario: Normal successful channel publication with DB persistence.
 * 4. Scenario: Deduplication prevents reposting already published property.
 *
 * STRICTLY MOCKED: Zero real calls to Telegram or live modifications to Supabase.
 */

import { publishPropertyToTelegramChannel } from "../src/lib/telegramNotifications";
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
  id: "hotfix-prop-101",
  slug: "hotfix-prop-101",
  title_uz: "Angren markazida 2 xonali kvartira",
  title_ru: "2-комнатная квартира в центре Ангрена",
  description_uz: "Yangi ta'mirlangan, qulay joylashuv.",
  description_ru: "Свежий ремонт, удобное расположение.",
  address_uz: "Navoiy ko‘chasi, 12-uy",
  address_ru: "ул. Навои, д. 12",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  transaction_type: "sale",
  property_type: "apartment",
  status: "published",
  price_uzs: 350000000,
  price_usd: 28000,
  currency: "USD",
  area_sqm: 56,
  rooms: 2,
  floor: 3,
  total_floors: 5,
  renovation: "euro",
  images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"],
  coordinates: { lat: 41.01, lng: 70.12 },
  utilities: { gas: true, electricity: true, cold_water: true, hot_water: true, heating: true, internet: true },
  amenities: {
    furniture: true,
    parking: true,
    elevator: false,
    ac: true,
    balcony: true,
    internet: true,
  },
  contact_phone: "+998 90 123 45 67",
  contact_telegram: "@angrenestate_admin",
  created_at: new Date().toISOString(),
};

async function runHotfixTests() {
  console.log("\n=======================================================");
  console.log("POST-PUSH HOTFIX: TELEGRAM PUBLISH RESULT VALIDATION");
  console.log("=======================================================\n");

  const originalFetch = global.fetch;

  // -------------------------------------------------------------------------
  // 1. SCENARIO: ok: true, LEKIN message_id YO'Q YOKI YAROQSIZ
  // -------------------------------------------------------------------------
  console.log("--- 1. Telegram ok: true, but missing or invalid message_id ---");

  // 1a: Missing result.message_id
  {
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          result: {}, // Missing message_id!
        }),
      } as any);

    let updatedErrorStatus = false;
    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async (_id, upd) => {
        if (upd.telegram_channel_status === "error") updatedErrorStatus = true;
        return { ...mockProperty, ...upd };
      },
    });

    assert(res.success === false, "1a: Returns success=false when message_id is missing");
    assert(res.status === "error", "1a: Status is 'error'");
    assert(res.messageId === undefined, "1a: messageId is undefined");
    assert(res.dbPersisted === false, "1a: dbPersisted is false");
    assert(
      res.error?.includes("result.message_id mavjud emas") || res.error?.includes("message_id"),
      "1a: Clear error description about missing message_id"
    );
    assert(Boolean(updatedErrorStatus), "1a: Database status updated to 'error'");
  }

  // 1b: message_id is non-number string or <= 0
  {
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 0 }, // Invalid ID (0)
        }),
      } as any);

    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async (_id, upd) => ({ ...mockProperty, ...upd }),
    });

    assert(res.success === false, "1b: Returns success=false when message_id is 0");
    assert(res.status === "error", "1b: Status is 'error'");
  }

  // -------------------------------------------------------------------------
  // 2. SCENARIO: TELEGRAM POST SUCCESS, BUT DB STATUS PERSISTENCE FAILS
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Telegram post succeeded, but DB persistence failed ---");

  // 2a: DB update throws exception
  {
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 77881 },
        }),
      } as any);

    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async () => {
        throw new Error("Supabase connection timeout: write failed");
      },
    });

    assert(res.success === false, "2a: CRITICAL: DB persistence failure is NOT hidden as success (returns success=false)");
    assert(res.status === "error", "2a: Status is 'error'");
    assert(res.messageId === 77881, "2a: Returned messageId preserves Telegram post ID (77881)");
    assert(res.dbPersisted === false, "2a: dbPersisted explicitly marked as false");
    assert(
      res.error?.includes("77881") && res.error?.includes("Supabase connection timeout"),
      "2a: Error message clearly mentions post was sent to Telegram (ID: 77881), but DB save failed"
    );
  }

  // 2b: DB update returns null (record not found or unwritten)
  {
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 77882 },
        }),
      } as any);

    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async () => null, // Returns null
    });

    assert(res.success === false, "2b: Returns success=false when DB returns null");
    assert(res.status === "error", "2b: Status is 'error'");
    assert(res.messageId === 77882, "2b: Telegram post ID preserved");
    assert(res.dbPersisted === false, "2b: dbPersisted is false");
  }

  // -------------------------------------------------------------------------
  // 3. SCENARIO: ODATIY MUVAFFAQIYATLI POST (HAPPY PATH)
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Normal successful channel publish ---");
  {
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 88992 },
        }),
      } as any);

    let savedStatus: string | undefined;
    let savedPostId: number | undefined;

    const res = await publishPropertyToTelegramChannel(mockProperty, {
      botToken: "dummy_mock_token",
      updatePropertyFn: async (_id, upd) => {
        savedStatus = upd.telegram_channel_status;
        savedPostId = upd.telegram_channel_post_id;
        return { ...mockProperty, ...upd };
      },
    });

    assert(res.success === true, "3: Returns success=true on normal publish");
    assert(res.status === "published", "3: Status is 'published'");
    assert(res.messageId === 88992, "3: messageId is 88992");
    assert(res.dbPersisted === true, "3: dbPersisted is true");
    assert(res.error === undefined, "3: No error present");
    assert(savedStatus === "published", "3: DB received status='published'");
    assert(savedPostId === 88992, "3: DB received post_id=88992");
  }

  // -------------------------------------------------------------------------
  // 4. SCENARIO: ALLAQACHON YUBORILGAN POSTNI TAKROR YUBORMASLIK (DEDUP)
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Deduplication: Do not resend already published post ---");
  {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 99999 } }) } as any;
    };

    const alreadyPublishedProp: Property = {
      ...mockProperty,
      telegram_channel_status: "published",
      telegram_channel_post_id: 55443,
    };

    const res = await publishPropertyToTelegramChannel(alreadyPublishedProp, {
      botToken: "dummy_mock_token",
      forceRepeat: false,
    });

    assert(res.success === true, "4: Returns success=true without reposting");
    assert(res.status === "already_published", "4: Status is 'already_published'");
    assert(res.messageId === 55443, "4: Retains original post ID 55443");
    assert(res.dbPersisted === true, "4: dbPersisted is true");
    assert(fetchCalled === false, "4: CRITICAL: Telegram API was NEVER called (0 duplicate posts)");
  }

  // Restore fetch
  global.fetch = originalFetch;

  console.log("\n=======================================================");
  console.log(`HOTFIX TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runHotfixTests().catch((err) => {
  console.error("FATAL HOTFIX TEST ERROR:", err);
  process.exit(1);
});
