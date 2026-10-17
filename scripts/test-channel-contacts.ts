/**
 * ANGREN ESTATE — TELEGRAM CHANNEL CONTACTS INTEGRATION TEST SUITE
 * Tests:
 * 1. Both owner & realtor present with owner_phone_visible = true (dual contacts in caption & keyboard)
 * 2. Both owner & realtor present with owner_phone_visible = false (strictly realtor only, ZERO owner leakage)
 * 3. Only owner present with owner_phone_visible = true (single owner contact in caption & keyboard)
 * 4. Only owner present with owner_phone_visible = false (zero owner leakage, agency fallback if available)
 * 5. Only realtor present (single realtor contact in caption & keyboard)
 * 6. Neither owner nor realtor present (no contact lines or buttons)
 * 7. Missing/invalid phone & Telegram handles (graceful handling, zero invalid buttons)
 * 8. Backward compatibility of resolveAuthorizedContact()
 * 9. End-to-end publish simulation with dual contacts
 */

import {
  resolveAllAuthorizedContacts,
  resolveAuthorizedContact,
  buildChannelPostCaption,
  buildChannelPostMarkup,
  publishPropertyToTelegramChannel,
} from "../src/lib/telegramNotifications";
import type { Property, Realtor } from "../src/lib/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

const mockRealtor: Realtor = {
  id: "realtor-101",
  name: "Jasur Alimov",
  phone: "+998 90 999 88 77",
  telegram: "jasur_realtor",
  experience_years: 5,
  specialization_uz: "Turar joy",
  specialization_ru: "Жилая недвижимость",
  districts: ["Angren markazi"],
  is_active: true,
  created_at: new Date().toISOString(),
};

const baseProperty: Property = {
  id: "prop-contact-test-001",
  slug: "prop-contact-test-001",
  title_uz: "Angren markazida 3 xonali uy",
  title_ru: "3-комнатная квартира в центре Ангрена",
  description_uz: "Shinam va keng uy, markaziy hududda joylashgan.",
  description_ru: "Уютная и просторная квартира в центре.",
  address_uz: "Mustaqillik ko‘chasi, 15",
  address_ru: "ул. Мустакиллик, 15",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  transaction_type: "sale",
  property_type: "apartment",
  status: "published",
  price_uzs: 500000000,
  price_usd: 40000,
  area_sqm: 80,
  rooms: 3,
  floor: 4,
  total_floors: 9,
  renovation: "euro",
  images: ["https://angrenestate.uz/uploads/test.jpg"],
  coordinates: { lat: 41.0123, lng: 70.1456 },
  utilities: {} as any,
  amenities: {} as any,
  contact_phone: "+998 90 123 45 67",
  contact_telegram: "angren_admin",
  created_at: new Date().toISOString(),
};

async function runContactTests() {
  console.log("\n=======================================================");
  console.log("TELEGRAM CHANNEL POST CONTACTS INTEGRATION TESTS");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // SCENARIO 1: Both Owner & Realtor Present, owner_phone_visible = true
  // -------------------------------------------------------------
  console.log("--- 1. Both Owner & Realtor Present (owner_phone_visible = true) ---");
  {
    const propDual: Property = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: true,
      owner_telegram: "owner_shoh",
      realtor: mockRealtor,
    };

    const contacts = resolveAllAuthorizedContacts(propDual);
    assert(Boolean(contacts.owner), "1.1: Owner contact is resolved");
    assert(contacts.owner?.phone === "+998 97 111 22 33", "1.1: Owner phone matches");
    assert(contacts.owner?.telegram === "owner_shoh", "1.1: Owner telegram matches");
    assert(Boolean(contacts.realtor), "1.1: Realtor contact is resolved");
    assert(contacts.realtor?.phone === "+998 90 999 88 77", "1.1: Realtor phone matches");
    assert(contacts.realtor?.name === "Jasur Alimov", "1.1: Realtor name matches");

    // Caption check - Uzbek
    const captionUz = buildChannelPostCaption(propDual, "uz");
    assert(captionUz.includes("📞 Obyekt egasi: +998 97 111 22 33"), "1.2: Uzbek caption shows owner label and phone");
    assert(captionUz.includes("📞 Rieltor: +998 90 999 88 77 (Jasur Alimov)"), "1.2: Uzbek caption shows realtor label, phone and name");
    assert(captionUz.indexOf("Obyekt egasi:") < captionUz.indexOf("Rieltor:"), "1.2: Owner is listed before realtor");

    // Caption check - Russian
    const captionRu = buildChannelPostCaption(propDual, "ru");
    assert(captionRu.includes("📞 Владелец: +998 97 111 22 33"), "1.3: Russian caption shows owner label and phone");
    assert(captionRu.includes("📞 Риелтор: +998 90 999 88 77 (Jasur Alimov)"), "1.3: Russian caption shows realtor label, phone and name");

    // Keyboard check - Uzbek
    const markupUz = buildChannelPostMarkup(propDual, "uz");
    const allButtonsUz = markupUz.inline_keyboard.flat();
    const ownerBtnUz = allButtonsUz.find((b) => b.text.includes("Egasi bilan bog‘lanish"));
    const realtorBtnUz = allButtonsUz.find((b) => b.text.includes("Rieltor bilan bog‘lanish"));

    assert(Boolean(ownerBtnUz), "1.4: Separate button for owner present in Uzbek markup");
    assert(ownerBtnUz?.url === "https://t.me/owner_shoh", "1.4: Owner button links to owner telegram handle");
    assert(Boolean(realtorBtnUz), "1.4: Separate button for realtor present in Uzbek markup");
    assert(realtorBtnUz?.url === "https://t.me/jasur_realtor", "1.4: Realtor button links to realtor telegram handle");

    // Keyboard check - Russian
    const markupRu = buildChannelPostMarkup(propDual, "ru");
    const allButtonsRu = markupRu.inline_keyboard.flat();
    const ownerBtnRu = allButtonsRu.find((b) => b.text.includes("Связаться с владельцем"));
    const realtorBtnRu = allButtonsRu.find((b) => b.text.includes("Связаться с риелтором"));

    assert(Boolean(ownerBtnRu), "1.5: Separate button for owner present in Russian markup");
    assert(Boolean(realtorBtnRu), "1.5: Separate button for realtor present in Russian markup");
  }

  // -------------------------------------------------------------
  // SCENARIO 2: Both Owner & Realtor Present, owner_phone_visible = false (STRICT PRIVACY)
  // -------------------------------------------------------------
  console.log("\n--- 2. Both Present but owner_phone_visible = false (Privacy Protection) ---");
  {
    const propHiddenOwner: Property = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: false,
      owner_telegram: "hidden_owner",
      realtor: mockRealtor,
    };

    const contacts = resolveAllAuthorizedContacts(propHiddenOwner);
    assert(contacts.owner === undefined, "2.1: Owner contact is STRICTLY undefined when visible=false");
    assert(Boolean(contacts.realtor), "2.1: Realtor contact is resolved");

    // Caption check - Uzbek & Russian
    const captionUz = buildChannelPostCaption(propHiddenOwner, "uz");
    assert(!captionUz.includes("+998 97 111 22 33"), "2.2: Hidden owner phone is NEVER in Uzbek caption");
    assert(!captionUz.includes("Obyekt egasi:"), "2.2: Owner label is NOT in Uzbek caption");
    assert(captionUz.includes("📞 Rieltor: +998 90 999 88 77"), "2.2: Realtor phone is included in Uzbek caption");

    const captionRu = buildChannelPostCaption(propHiddenOwner, "ru");
    assert(!captionRu.includes("+998 97 111 22 33"), "2.3: Hidden owner phone is NEVER in Russian caption");
    assert(!captionRu.includes("Владелец:"), "2.3: Owner label is NOT in Russian caption");
    assert(captionRu.includes("📞 Риелтор: +998 90 999 88 77"), "2.3: Realtor phone is included in Russian caption");

    // Keyboard check
    const markupUz = buildChannelPostMarkup(propHiddenOwner, "uz");
    const allButtonsUz = markupUz.inline_keyboard.flat();
    assert(!allButtonsUz.some((b) => b.text.includes("Egasi")), "2.4: Zero owner buttons in keyboard");
    assert(!allButtonsUz.some((b) => b.url.includes("hidden_owner")), "2.4: Zero owner URLs in keyboard");
    assert(!allButtonsUz.some((b) => b.url.includes("971112233")), "2.4: Zero owner phone digits in keyboard URLs");

    const realtorBtn = allButtonsUz.find((b) => b.text.includes("Bog‘lanish"));
    assert(Boolean(realtorBtn), "2.5: Realtor contact button is provided");
    assert(realtorBtn?.url === "https://t.me/jasur_realtor", "2.5: Realtor contact URL is valid");
  }

  // -------------------------------------------------------------
  // SCENARIO 3: Only Owner Present, owner_phone_visible = true (No Realtor)
  // -------------------------------------------------------------
  console.log("\n--- 3. Only Owner Present & Visible (No Realtor) ---");
  {
    const propOwnerOnly: Property = {
      ...baseProperty,
      owner_phone: "+998 93 444 55 66",
      owner_phone_visible: true,
      realtor: undefined,
    };

    const contacts = resolveAllAuthorizedContacts(propOwnerOnly);
    assert(contacts.owner?.phone === "+998 93 444 55 66", "3.1: Owner contact resolved");
    assert(contacts.realtor === undefined, "3.1: Realtor contact is undefined");

    const captionUz = buildChannelPostCaption(propOwnerOnly, "uz");
    assert(captionUz.includes("📞 Obyekt egasi: +998 93 444 55 66"), "3.2: Uzbek caption has owner phone");
    assert(!captionUz.includes("Rieltor:"), "3.2: No realtor label in caption");

    const markupUz = buildChannelPostMarkup(propOwnerOnly, "uz");
    const allButtons = markupUz.inline_keyboard.flat();
    const contactBtn = allButtons.find((b) => b.text.includes("Bog‘lanish"));
    assert(Boolean(contactBtn), "3.3: Single contact button exists");
    assert(contactBtn?.url === "https://t.me/+998934445566", "3.3: Contact button links to owner phone on Telegram");
    assert(!allButtons.some((b) => b.text.includes("Rieltor")), "3.3: No realtor button exists");
  }

  // -------------------------------------------------------------
  // SCENARIO 4: Only Owner Present & Hidden (No Realtor)
  // -------------------------------------------------------------
  console.log("\n--- 4. Only Owner Present & Hidden (No Realtor) ---");
  {
    const propHiddenOnly: Property = {
      ...baseProperty,
      owner_phone: "+998 93 444 55 66",
      owner_phone_visible: false,
      realtor: undefined,
      contact_phone: "+998 90 123 45 67",
      contact_telegram: "angren_agency",
    };

    const contacts = resolveAllAuthorizedContacts(propHiddenOnly);
    assert(contacts.owner === undefined, "4.1: Hidden owner is strictly undefined");
    assert(contacts.realtor === undefined, "4.1: Realtor is undefined");
    assert(contacts.agency?.phone === "+998 90 123 45 67", "4.1: Agency fallback is resolved");

    const captionUz = buildChannelPostCaption(propHiddenOnly, "uz");
    assert(!captionUz.includes("+998 93 444 55 66"), "4.2: Owner phone is NOT in caption");
    assert(captionUz.includes("📞 Aloqa: +998 90 123 45 67"), "4.2: Agency contact fallback is shown");

    const markupUz = buildChannelPostMarkup(propHiddenOnly, "uz");
    const allButtons = markupUz.inline_keyboard.flat();
    const contactBtn = allButtons.find((b) => b.text.includes("Bog‘lanish"));
    assert(Boolean(contactBtn), "4.3: Agency fallback button exists");
    assert(contactBtn?.url === "https://t.me/angren_agency", "4.3: Button links to agency telegram");
    assert(!allButtons.some((b) => b.url.includes("934445566")), "4.3: Zero owner phone leakage");
  }

  // -------------------------------------------------------------
  // SCENARIO 5: Only Realtor Present (No Owner Phone)
  // -------------------------------------------------------------
  console.log("\n--- 5. Only Realtor Present (No Owner Phone) ---");
  {
    const propRealtorOnly: Property = {
      ...baseProperty,
      owner_phone: undefined,
      owner_phone_visible: false,
      realtor: mockRealtor,
    };

    const contacts = resolveAllAuthorizedContacts(propRealtorOnly);
    assert(contacts.owner === undefined, "5.1: Owner is undefined");
    assert(contacts.realtor?.phone === "+998 90 999 88 77", "5.1: Realtor is resolved");

    const captionUz = buildChannelPostCaption(propRealtorOnly, "uz");
    assert(captionUz.includes("📞 Rieltor: +998 90 999 88 77"), "5.2: Uzbek caption has realtor phone");
    assert(!captionUz.includes("Obyekt egasi:"), "5.2: No owner label in caption");

    const markupUz = buildChannelPostMarkup(propRealtorOnly, "uz");
    const allButtons = markupUz.inline_keyboard.flat();
    const realtorBtn = allButtons.find((b) => b.text.includes("Bog‘lanish"));
    assert(Boolean(realtorBtn), "5.3: Single contact button for realtor exists");
    assert(realtorBtn?.url === "https://t.me/jasur_realtor", "5.3: Contact button links to realtor telegram");
  }

  // -------------------------------------------------------------
  // SCENARIO 6: Neither Contact Present
  // -------------------------------------------------------------
  console.log("\n--- 6. Neither Contact Present ---");
  {
    const propNoContacts: Property = {
      ...baseProperty,
      owner_phone: undefined,
      owner_phone_visible: false,
      realtor: undefined,
      contact_phone: "",
      contact_telegram: undefined,
      telegram: undefined,
    };

    const contacts = resolveAllAuthorizedContacts(propNoContacts);
    assert(contacts.owner === undefined, "6.1: Owner undefined");
    assert(contacts.realtor === undefined, "6.1: Realtor undefined");
    assert(contacts.agency === undefined, "6.1: Agency undefined");

    const captionUz = buildChannelPostCaption(propNoContacts, "uz");
    assert(!captionUz.includes("📞"), "6.2: Caption has zero phone/contact lines");

    const markupUz = buildChannelPostMarkup(propNoContacts, "uz");
    const allButtons = markupUz.inline_keyboard.flat();
    assert(!allButtons.some((b) => b.text.includes("Bog‘lanish")), "6.3: Zero contact buttons created");
    assert(allButtons.length === 1, "6.3: Only 'Obyektni ko‘rish' button exists");
  }

  // -------------------------------------------------------------
  // SCENARIO 7: Missing/Invalid Contact URLs Handling
  // -------------------------------------------------------------
  console.log("\n--- 7. Missing / Invalid Contact Information Handling ---");
  {
    // Realtor with empty phone and empty telegram
    const propEmptyRealtor: Property = {
      ...baseProperty,
      owner_phone: undefined,
      owner_phone_visible: false,
      realtor: {
        ...mockRealtor,
        phone: "",
        telegram: "",
      },
      contact_phone: "",
      contact_telegram: undefined,
    };

    const markupUz = buildChannelPostMarkup(propEmptyRealtor, "uz");
    const allButtons = markupUz.inline_keyboard.flat();
    assert(!allButtons.some((b) => b.text.includes("Bog‘lanish")), "7.1: No button created for realtor with empty contacts");

    // Owner with full t.me URL format
    const propFullUrlOwner: Property = {
      ...baseProperty,
      owner_phone: "+998 90 111 22 33",
      owner_phone_visible: true,
      owner_telegram: "https://t.me/full_link_user",
      realtor: undefined,
    };
    const markupFullUrl = buildChannelPostMarkup(propFullUrlOwner, "uz");
    const btn = markupFullUrl.inline_keyboard.flat().find((b) => b.text.includes("Bog‘lanish"));
    assert(btn?.url === "https://t.me/full_link_user", "7.2: Handles full https://t.me/ format without duplicating prefix");
  }

  // -------------------------------------------------------------
  // SCENARIO 8: Backward Compatibility of resolveAuthorizedContact()
  // -------------------------------------------------------------
  console.log("\n--- 8. Backward Compatibility of resolveAuthorizedContact() ---");
  {
    // When owner is public
    const propOwner = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: true,
      realtor: mockRealtor,
    };
    const authOwner = resolveAuthorizedContact(propOwner);
    assert(authOwner !== null && authOwner.type === "owner", "8.1: Returns type=owner when owner visible");
    assert(authOwner?.phone === "+998 97 111 22 33", "8.1: Primary phone is owner phone");
    assert(authOwner?.realtor?.phone === "+998 90 999 88 77", "8.1: Realtor info is also attached");

    // When owner is hidden
    const propHidden = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: false,
      realtor: mockRealtor,
    };
    const authRealtor = resolveAuthorizedContact(propHidden);
    assert(authRealtor !== null && authRealtor.type === "realtor", "8.2: Returns type=realtor when owner hidden");
    assert(authRealtor?.phone === "+998 90 999 88 77", "8.2: Primary phone is realtor phone");
    assert(authRealtor?.owner === undefined, "8.2: Owner is undefined in authorized contact");
  }

  // -------------------------------------------------------------
  // SCENARIO 9: Mocked End-to-End Channel Publish with Dual Contacts
  // -------------------------------------------------------------
  console.log("\n--- 9. Mocked End-to-End Channel Publish with Dual Contacts ---");
  {
    let sentPayload: any = null;
    const originalFetch = global.fetch;

    global.fetch = async (url: any, init?: any): Promise<Response> => {
      const urlStr = String(url);
      if (urlStr.includes("api.telegram.org")) {
        sentPayload = JSON.parse(init?.body || "{}");
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              message_id: 888,
              chat: { id: -1001234567, title: "ANGREN ESTATE" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    let persistedUpdates: any = null;
    const mockUpdateFn = async (id: string, updates: Partial<Property>) => {
      persistedUpdates = updates;
      return { ...baseProperty, ...updates };
    };

    const propDualPublish: Property = {
      ...baseProperty,
      owner_phone: "+998 97 111 22 33",
      owner_phone_visible: true,
      owner_telegram: "owner_tg",
      realtor: mockRealtor,
    };

    const res = await publishPropertyToTelegramChannel(propDualPublish, {
      botToken: "MOCK_TOKEN_123456",
      channelId: "@angren_estate",
      updatePropertyFn: mockUpdateFn,
      validateImageBeforeSend: false,
    });

    global.fetch = originalFetch;

    assert(res.success === true, "9.1: Publish returns success=true");
    assert(res.messageId === 888, "9.1: Returns correct messageId 888");
    assert(persistedUpdates?.telegram_channel_status === "published", "9.1: Status persisted as published");
    assert(persistedUpdates?.telegram_channel_post_id === 888, "9.1: Post ID 888 persisted");

    // Inspect sent Telegram payload
    assert(Boolean(sentPayload), "9.2: Telegram API payload was captured");
    assert(sentPayload.caption.includes("📞 Obyekt egasi: +998 97 111 22 33"), "9.2: Sent payload caption has owner phone");
    assert(sentPayload.caption.includes("📞 Rieltor: +998 90 999 88 77"), "9.2: Sent payload caption has realtor phone");

    const sentMarkup = sentPayload.reply_markup;
    const flatBtns = sentMarkup.inline_keyboard.flat();
    assert(flatBtns.some((b: any) => b.text === "👤 Egasi bilan bog‘lanish"), "9.3: Sent payload has owner button");
    assert(flatBtns.some((b: any) => b.text === "👨‍💼 Rieltor bilan bog‘lanish"), "9.3: Sent payload has realtor button");
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runContactTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
