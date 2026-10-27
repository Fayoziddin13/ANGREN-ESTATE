import assert from "assert";
import {
  getTelegramWelcomePayload,
  getTelegramRegistrationPromptPayload,
  getTelegramRegistrationSuccessPayload,
  getTelegramArizaPromptPayload,
  normalizePhoneNumber,
} from "../src/lib/telegramServer";
import {
  buildChannelPostCaption,
  buildChannelPostMarkup,
  buildPropertyNotificationMarkup,
  formatApplicationNotificationMessage,
} from "../src/lib/telegramNotifications";
import type { Property } from "../src/lib/types";

console.log("=== ANGREN ESTATE TELEGRAM BOT RESTORATION TESTS ===\n");

// 1. Test Phone Normalization
console.log("1. Testing Phone Normalization...");
assert.strictEqual(normalizePhoneNumber("901234567"), "+998901234567");
assert.strictEqual(normalizePhoneNumber("998901234567"), "+998901234567");
assert.strictEqual(normalizePhoneNumber("+998 90 123 45 67"), "+998901234567");
console.log("✅ Phone normalization passed.");

// 2. Test Registration Prompt (unregistered user first /start)
console.log("\n2. Testing Registration Prompt (unregistered user)...");
const regPromptUz = getTelegramRegistrationPromptPayload("uz");
const regPromptRu = getTelegramRegistrationPromptPayload("ru");

// Must have keyboard with request_contact
assert.ok(regPromptUz.reply_markup.keyboard);
assert.strictEqual(regPromptUz.reply_markup.keyboard[0][0].request_contact, true);
assert.ok(regPromptUz.reply_markup.keyboard[0][0].text.includes("Telefon"));
// Must NOT have inline web_app buttons
assert.strictEqual((regPromptUz.reply_markup as any).inline_keyboard, undefined);

assert.ok(Boolean(regPromptRu.reply_markup.keyboard[0][0].request_contact));
console.log("✅ Registration prompt keyboard and security verified.");

// 3. Test Welcome Payload (registered user subsequent /start)
console.log("\n3. Testing Welcome Payload (registered user /start)...");
const welcomeUz = getTelegramWelcomePayload("uz", "https://angrenestate.uz");
const welcomeRu = getTelegramWelcomePayload("ru", "https://angrenestate.uz");

// Must have 4 rows of buttons:
// 1. Mini App
// 2. Saytga o'tish
// 3. Ariza qoldirish
// 4. Lang switcher
assert.strictEqual(welcomeUz.reply_markup.inline_keyboard.length, 4);

// Row 1: Mini App
const row1Uz = welcomeUz.reply_markup.inline_keyboard[0][0] as any;
assert.ok(row1Uz.text.includes("Mini App"));
assert.strictEqual(row1Uz.web_app?.url, "https://angrenestate.uz?lang=uz");

// Row 2: Saytga o'tish
const row2Uz = welcomeUz.reply_markup.inline_keyboard[1][0] as any;
assert.ok(row2Uz.text.includes("Saytga o‘tish"));
assert.strictEqual(row2Uz.url, "https://angrenestate.uz/uz");

// Row 3: Ariza qoldirish
const row3Uz = welcomeUz.reply_markup.inline_keyboard[2][0] as any;
assert.ok(row3Uz.text.includes("Ariza qoldirish"));
assert.strictEqual(row3Uz.web_app?.url, "https://angrenestate.uz?action=ariza&lang=uz");

// Row 4: Language switch
const row4Uz = welcomeUz.reply_markup.inline_keyboard[3][0] as any;
assert.strictEqual(row4Uz.callback_data, "lang_ru");

// Check Russian variants
const row1Ru = welcomeRu.reply_markup.inline_keyboard[0][0] as any;
assert.ok(row1Ru.text.includes("Mini App"));
const row2Ru = welcomeRu.reply_markup.inline_keyboard[1][0] as any;
assert.ok(row2Ru.text.includes("Перейти на сайт"));
const row3Ru = welcomeRu.reply_markup.inline_keyboard[2][0] as any;
assert.ok(row3Ru.text.includes("Оставить заявку"));
assert.strictEqual(row3Ru.web_app?.url, "https://angrenestate.uz?action=ariza&lang=ru");

console.log("✅ Welcome payload 3 buttons (Mini App, Saytga o'tish, Ariza qoldirish) verified.");

// 4. Test Registration Success Payload
console.log("\n4. Testing Registration Success Payload...");
const regSuccessUz = getTelegramRegistrationSuccessPayload("uz", "https://angrenestate.uz");
assert.strictEqual(regSuccessUz.reply_markup.inline_keyboard.length, 4);
assert.ok(regSuccessUz.reply_markup.inline_keyboard[0][0].text.includes("Mini App"));
assert.ok(regSuccessUz.reply_markup.inline_keyboard[1][0].text.includes("Saytga o‘tish"));
assert.ok(regSuccessUz.reply_markup.inline_keyboard[2][0].text.includes("Ariza qoldirish"));
assert.strictEqual(
  (regSuccessUz.reply_markup.inline_keyboard[2][0] as any).web_app?.url,
  "https://angrenestate.uz?action=ariza&lang=uz"
);
console.log("✅ Registration success payload parity with welcome payload verified.");

// 5. Test Ariza Prompt Payload
console.log("\n5. Testing Ariza Prompt Payload...");
const arizaPromptUz = getTelegramArizaPromptPayload("uz", "https://angrenestate.uz");
assert.strictEqual(
  (arizaPromptUz.reply_markup.inline_keyboard[0][0] as any).web_app?.url,
  "https://angrenestate.uz?action=ariza&lang=uz"
);
console.log("✅ Ariza prompt payload verified.");

// 6. Test Channel & Bot Announcement Format Parity
console.log("\n6. Testing Channel & Bot Announcement Format Parity...");
const mockProperty = {
  id: "prop-test-777",
  slug: "prop-test-777",
  title_uz: "Angren markazida 3 xonali shinam kvartira",
  title_ru: "Уютная 3-комнатная квартира в центре Ангрена",
  address_uz: "Mustaqillik ko‘chasi, 12-uy",
  address_ru: "ул. Мустакиллик, д. 12",
  district: "Markaz",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  property_type: "apartment",
  transaction_type: "sale",
  rooms: 3,
  area_sqm: 78,
  floor: 3,
  total_floors: 5,
  renovation: "euro",
  price: 35000,
  price_uzs: 448000000,
  currency: "USD",
  price_usd: 35000,
  bargain_allowed: true,
  description_uz: "Barcha qulayliklarga ega, gaz va suv uzluksiz, mebellari bilan birga sotiladi.",
  description_ru: "Со всеми удобствами, газ и вода постоянно, продается с мебелью.",
  main_image: "https://angrenestate.uz/uploads/prop-777.jpg",
  owner_phone: "+998901234567",
  owner_phone_visible: true,
  status: "published",
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  views_count: 0,
  favorites_count: 0,
  contacts_count: 0,
  images: ["https://angrenestate.uz/uploads/prop-777.jpg"],
  coordinates: { lat: 41.0167, lng: 70.1436 },
  utilities: {},
  amenities: {},
  contact_phone: "+998901234567",
} as unknown as Property;

// Caption check
const captionUz = buildChannelPostCaption(mockProperty, "uz");
assert.ok(captionUz.includes("Angren markazida 3 xonali"));
assert.ok(captionUz.includes("Mustaqillik ko‘chasi"));
assert.ok(captionUz.includes("3 xona"));
assert.ok(captionUz.includes("78 m²"));
assert.ok(captionUz.includes("3/5 qavat"));
assert.ok(captionUz.includes("Yevro ta’mir"));
assert.ok(captionUz.includes("35 000 $") || captionUz.includes("35,000 $") || captionUz.includes("35"));
assert.ok(captionUz.includes("Savdolashish mumkin"));
assert.ok(captionUz.includes("+998901234567"));
assert.ok(captionUz.includes("@angren_estate"));
assert.ok(captionUz.length <= 1024, "Caption exceeds Telegram 1024 char limit!");

// Markup check
const markupUz = buildChannelPostMarkup(mockProperty, "uz");
const notifMarkupUz = buildPropertyNotificationMarkup(mockProperty.id, "uz");

// Main button text must be "Obyektni ochish →"
assert.strictEqual(markupUz.inline_keyboard[0][0].text, "Obyektni ochish →");
assert.strictEqual(markupUz.inline_keyboard[0][0].url, "https://angrenestate.uz/properties/prop-test-777");

assert.strictEqual(notifMarkupUz.inline_keyboard[0][0].text, "Obyektni ochish →");
assert.strictEqual((notifMarkupUz.inline_keyboard[0][0] as any).url, "https://angrenestate.uz/properties/prop-test-777?lang=uz");

console.log("✅ Channel & Bot caption and 'Obyektni ochish →' buttons verified.");

// 7. Test Admin Lead Notification & Zero-Hallucination
console.log("\n7. Testing Admin Lead Notification & Zero-Hallucination...");
// Case A: Missing Telegram username and user ID -> NEVER invented
const leadWithoutTelegram = formatApplicationNotificationMessage({
  client_name: "Aziz Karimov",
  client_phone: "+998909876543",
  source: "Sayt (E'lon berish)",
  property_title: "E’lon berish arizasi: Sotuv — Kvartira (Angren, 5/2)",
  location: "Angren shahar, 5/2 dahasi",
  deal_type: "sale",
  property_type: "apartment",
  rooms: "3",
  area: 72,
  price: 28000,
  currency: "USD",
  description: "Ta'mirlangan, oshxona mebeli qoladi.",
  telegram_username: null,
  telegram_user_id: null,
  created_at: new Date().toISOString(),
});

assert.ok(leadWithoutTelegram.messageText.includes("Aziz Karimov"));
assert.ok(leadWithoutTelegram.messageText.includes("+998909876543"));
assert.ok(leadWithoutTelegram.messageText.includes("Sayt (E'lon berish)"));
assert.ok(leadWithoutTelegram.messageText.includes("Angren shahar, 5/2 dahasi"));
assert.ok(leadWithoutTelegram.messageText.includes("3"));
assert.ok(leadWithoutTelegram.messageText.includes("72 m²"));
assert.ok(leadWithoutTelegram.messageText.includes("28000 USD"));
// Zero-hallucination assertion: NO Telegram username or user ID line when null/empty
assert.ok(!leadWithoutTelegram.messageText.includes("💬 Telegram:"));
assert.ok(!leadWithoutTelegram.messageText.includes("🆔 Telegram user ID:"));
// Quick action button should only have Call button, NOT Telegram button
assert.strictEqual(leadWithoutTelegram.buttons.length, 1);
assert.ok(leadWithoutTelegram.buttons[0].text.includes("Qo‘ng‘iroq"));

// Case B: Genuine Telegram user present
const leadWithTelegram = formatApplicationNotificationMessage({
  client_name: "Sardor Aliyev",
  client_phone: "+998931112233",
  source: "Telegram Mini App - E'lon qoldirish",
  location: "Angren, Shaharchada",
  deal_type: "rent",
  property_type: "house",
  rooms: "4",
  area: 120,
  price: 300,
  currency: "USD",
  description: "Uzoq muddatga oilaga ijaraga beriladi.",
  telegram_username: "sardor_aliyev",
  telegram_user_id: 123456789,
  created_at: new Date().toISOString(),
});

assert.ok(leadWithTelegram.messageText.includes("Sardor Aliyev"));
assert.ok(leadWithTelegram.messageText.includes("Telegram Mini App - E'lon qoldirish"));
assert.ok(leadWithTelegram.messageText.includes("💬 Telegram: @sardor_aliyev"));
assert.ok(leadWithTelegram.messageText.includes("🆔 Telegram user ID: 123456789"));
// Has both Call and Telegram quick action buttons
assert.strictEqual(leadWithTelegram.buttons.length, 2);
assert.strictEqual(leadWithTelegram.buttons[1].url, "https://t.me/sardor_aliyev");

console.log("✅ Admin lead notification and Zero-Hallucination logic verified.");

console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
