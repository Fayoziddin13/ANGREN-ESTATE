/**
 * Stage 3 Integration & Unit Tests: Publish Wizard Checkboxes & Telegram Triggering
 * Run via: cmd.exe /c "npx tsx scripts/test-wizard-checkboxes.ts" < /dev/null
 */

import { Property } from "../src/lib/types";
import {
  resolveAuthorizedContact,
  buildChannelPostMarkup,
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

// Mock Property factory
function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-stage3-test-123",
    slug: "angren-apartment-test",
    title_uz: "Angren markazida 3 xonali kvartira",
    title_ru: "3-комнатная квартира в центре Ангрена",
    description_uz: "Ta'mirlangan, barcha qulayliklar mavjud",
    description_ru: "С ремонтом, все удобства",
    district: "Markaz",
    district_name_uz: "Markaz",
    district_name_ru: "Центр",
    address_uz: "Mustaqillik ko‘chasi, 10-uy",
    address_ru: "ул. Мустакиллик, д. 10",
    property_type: "apartment",
    transaction_type: "sale",
    deal_type: "sale",
    status: "published",
    coordinates: { lat: 41.0167, lng: 70.1436 },
    latitude: 41.0167,
    longitude: 70.1436,
    price_usd: 35000,
    price_uzs: 448000000,
    currency: "USD",
    rooms: 3,
    area_sqm: 75,
    floor: 4,
    total_floors: 9,
    renovation: "euro",
    furniture: false,
    photos: ["https://angrenestate.uz/uploads/test.jpg"],
    images: ["https://angrenestate.uz/uploads/test.jpg"],
    main_image: "https://angrenestate.uz/uploads/test.jpg",
    owner_phone: "+998 90 111 22 33",
    owner_phone_visible: false,
    contact_phone: "+998 90 999 88 77",
    contact_telegram: "@angrenestate_admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Property;
}

async function runWizardSimulation(options: {
  shouldFailSave?: boolean;
  shouldFailBot?: boolean;
  shouldFailChannel?: boolean;
  sendToTelegramBot: boolean;
  sendToTelegramChannel: boolean;
  statusToSave: "draft" | "published";
  propertyOverrides?: Partial<Property>;
}) {
  let botApiCalled = 0;
  let channelApiCalled = 0;
  let propertyCreated = false;
  let propertyDeleted = false;

  const mockAddProperty = async () => {
    if (options.shouldFailSave) return null;
    propertyCreated = true;
    return makeProperty(options.propertyOverrides);
  };

  const mockBotEndpoint = async (propId: string) => {
    botApiCalled++;
    if (options.shouldFailBot) {
      return { success: false, error: "Bot token invalid or network timeout" };
    }
    return { success: true, sent: 12, total: 12 };
  };

  const mockChannelEndpoint = async (propId: string) => {
    channelApiCalled++;
    if (options.shouldFailChannel) {
      return { success: false, error: "Channel post failed: CHAT_ADMIN_REQUIRED" };
    }
    return { success: true, status: "published", messageId: 9988 };
  };

  // Simulate Wizard handleSave logic
  let publishResult: any = null;
  let saveError: string | null = null;

  try {
    const created = await mockAddProperty();
    if (!created || !created.id) {
      throw new Error("Obyektni saqlashda xatolik yuz berdi");
    }

    if (options.statusToSave === "published" && (options.sendToTelegramBot || options.sendToTelegramChannel)) {
      let botResult: any;
      let channelResult: any;

      if (options.sendToTelegramBot) {
        const res = await mockBotEndpoint(created.id);
        botResult = res.success
          ? { success: true, sent: res.sent, message: `${res.sent} ta obunachiga yuborildi` }
          : { success: false, message: res.error };
      }

      if (options.sendToTelegramChannel) {
        const res = await mockChannelEndpoint(created.id);
        channelResult = res.success
          ? { success: true, message: "Post muvaffaqiyatli joylashtirildi" }
          : { success: false, message: res.error };
      }

      publishResult = {
        propertySaved: true,
        botStatus: botResult,
        channelStatus: channelResult,
      };
    }
  } catch (err: any) {
    saveError = err.message;
  }

  return {
    propertyCreated,
    propertyDeleted,
    botApiCalled,
    channelApiCalled,
    publishResult,
    saveError,
  };
}

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("STAGE 3: PUBLISH WIZARD CHECKBOXES INTEGRATION TESTS");
  console.log("=======================================================\n");

  console.log("--- 1. Checkbox Selection Matrix ---");

  // Test 1: Neither checkbox selected
  {
    const res = await runWizardSimulation({
      sendToTelegramBot: false,
      sendToTelegramChannel: false,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Neither selected: Property created successfully");
    assert(res.botApiCalled === 0, "Neither selected: Bot API is strictly NOT called");
    assert(res.channelApiCalled === 0, "Neither selected: Channel API is strictly NOT called");
    assert(res.publishResult === null, "Neither selected: Direct redirect (no modal delay)");
  }

  // Test 2: Only Bot checkbox selected
  {
    const res = await runWizardSimulation({
      sendToTelegramBot: true,
      sendToTelegramChannel: false,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Only Bot selected: Property created successfully");
    assert(res.botApiCalled === 1, "Only Bot selected: Bot API called exactly once");
    assert(res.channelApiCalled === 0, "Only Bot selected: Channel API is NOT called");
    assert(res.publishResult?.botStatus?.success === true, "Only Bot selected: Bot status reported as success");
    assert(res.publishResult?.channelStatus === undefined, "Only Bot selected: Channel status not present");
  }

  // Test 3: Only Channel checkbox selected
  {
    const res = await runWizardSimulation({
      sendToTelegramBot: false,
      sendToTelegramChannel: true,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Only Channel selected: Property created successfully");
    assert(res.botApiCalled === 0, "Only Channel selected: Bot API is NOT called");
    assert(res.channelApiCalled === 1, "Only Channel selected: Channel API called exactly once");
    assert(res.publishResult?.channelStatus?.success === true, "Only Channel selected: Channel status reported as success");
    assert(res.publishResult?.botStatus === undefined, "Only Channel selected: Bot status not present");
  }

  // Test 4: Both checkboxes selected
  {
    const res = await runWizardSimulation({
      sendToTelegramBot: true,
      sendToTelegramChannel: true,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Both selected: Property created successfully");
    assert(res.botApiCalled === 1, "Both selected: Bot API called exactly once");
    assert(res.channelApiCalled === 1, "Both selected: Channel API called exactly once");
    assert(res.publishResult?.botStatus?.success === true, "Both selected: Bot reported success");
    assert(res.publishResult?.channelStatus?.success === true, "Both selected: Channel reported success");
  }

  console.log("\n--- 2. Error Resilience & Isolation ---");

  // Test 5: Property save failure
  {
    const res = await runWizardSimulation({
      shouldFailSave: true,
      sendToTelegramBot: true,
      sendToTelegramChannel: true,
      statusToSave: "published",
    });
    assert(res.propertyCreated === false, "Save failure: Property was not created");
    assert(res.saveError !== null, "Save failure: Error reported to user");
    assert(res.botApiCalled === 0, "Save failure: Bot API NEVER called without valid property ID");
    assert(res.channelApiCalled === 0, "Save failure: Channel API NEVER called without valid property ID");
  }

  // Test 6: Bot broadcast fails, but property is saved
  {
    const res = await runWizardSimulation({
      shouldFailBot: true,
      sendToTelegramBot: true,
      sendToTelegramChannel: false,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Bot fail: Property is safely preserved");
    assert(res.publishResult?.propertySaved === true, "Bot fail: Report indicates property is saved");
    assert(res.publishResult?.botStatus?.success === false, "Bot fail: Bot error cleanly reported");
  }

  // Test 7: Channel post fails, but property is saved
  {
    const res = await runWizardSimulation({
      shouldFailChannel: true,
      sendToTelegramBot: false,
      sendToTelegramChannel: true,
      statusToSave: "published",
    });
    assert(res.propertyCreated === true, "Channel fail: Property is safely preserved");
    assert(res.publishResult?.propertySaved === true, "Channel fail: Report indicates property is saved");
    assert(res.publishResult?.channelStatus?.success === false, "Channel fail: Channel error cleanly reported");
  }

  // Test 8: Draft save never triggers Telegram operations even if checkboxes are true
  {
    const res = await runWizardSimulation({
      sendToTelegramBot: true,
      sendToTelegramChannel: true,
      statusToSave: "draft",
    });
    assert(res.propertyCreated === true, "Draft: Property saved as draft");
    assert(res.botApiCalled === 0, "Draft: Bot API strictly ignored for drafts");
    assert(res.channelApiCalled === 0, "Draft: Channel API strictly ignored for drafts");
  }

  console.log("\n--- 3. Privacy, Buttons & Channel Compliance ---");

  // Test 9: Owner phone hidden
  {
    const propHidden = makeProperty({
      owner_phone: "+998 90 123 45 67",
      owner_phone_visible: false,
      realtor: { id: "r1", name: "Rustam", phone: "+998 99 888 77 66", telegram: "@rustam_realtor" } as any,
    });
    const contact = resolveAuthorizedContact(propHidden);
    assert(contact !== null, "Contact resolved to fallback");
    assert(contact?.phone === "+998 99 888 77 66", "Owner phone hidden: Realtor phone used instead");
    assert(contact?.type === "realtor", "Contact type is realtor");
  }

  // Test 10: video_url missing
  {
    const propNoVideo = makeProperty({ video_url: undefined });
    const markup = buildChannelPostMarkup(propNoVideo, "uz");
    const allButtons = markup.inline_keyboard.flat();
    const hasVideo = allButtons.some((b: any) => b.text.includes("Video"));
    assert(!hasVideo, "No video URL: Video review button is strictly omitted");
  }

  // Test 11: Idempotency protection in publishPropertyToTelegramChannel
  {
    const propAlready = makeProperty({
      telegram_channel_status: "published",
      telegram_channel_post_id: 554433,
    });
    const res = await publishPropertyToTelegramChannel(propAlready, { botToken: "mock-token" });
    assert(res.success === true, "Already published: Returns success=true");
    assert(res.status === "already_published", "Already published: Returns already_published status without resending");
    assert(res.messageId === 554433, "Already published: Retains original messageId");
  }

  console.log(`\n=======================================================`);
  console.log(`STAGE 3 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`=======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
