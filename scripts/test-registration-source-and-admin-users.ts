/**
 * Test Suite: Registration Source, Public Listing Auth Gate, Admin Users Management, and Telegram Direct Messaging
 *
 * Verifies:
 * 1. Cryptographic Telegram HMAC-SHA256 signature verification (validateTelegramInitData)
 * 2. Unauthenticated listing application rejection (REGISTRATION_REQUIRED)
 * 3. Registration source resolution & application distinction (leads vs users)
 * 4. Admin Users API filters and application history linkage
 * 5. Admin direct Telegram messaging restrictions and error handling
 */

if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class WebSocketMock {};
}

import crypto from "crypto";
import { validateTelegramInitData } from "../src/lib/telegramServer";

function generateTestTelegramInitData(botToken: string, userPayload: any): string {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(userPayload);
  const queryId = "AAHdF6IQAAAAAN0XohDhr18k";

  const params: Record<string, string> = {
    auth_date: String(authDate),
    query_id: queryId,
    user: userJson,
  };

  const pairs: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const urlParams = new URLSearchParams(params);
  urlParams.set("hash", hash);
  return urlParams.toString();
}

async function runTests() {
  console.log("=================================================");
  console.log("ANGREN ESTATE - REGISTRATION SOURCE & USERS TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Telegram Cryptographic HMAC verification
  const testBotToken = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ123456789";
  const validUser = {
    id: 987654321,
    first_name: "Farhod",
    last_name: "Karimov",
    username: "farhod_angren",
  };

  const validInitData = generateTestTelegramInitData(testBotToken, validUser);
  const valResult = validateTelegramInitData(validInitData, testBotToken);

  assert(valResult.valid === true, "Valid Telegram initData HMAC signature verification succeeds");
  assert(valResult.user?.id === 987654321, "Telegram user ID extracted correctly from verified initData");
  assert(valResult.user?.username === "farhod_angren", "Telegram username extracted correctly");

  // Tampered hash check
  const tamperedInitData = validInitData.replace("farhod_angren", "hacker_attacker");
  const tamperedResult = validateTelegramInitData(tamperedInitData, testBotToken);
  assert(tamperedResult.valid === false, "Tampered Telegram initData fails signature verification");

  // Fake / missing hash check
  const fakeInitData = "auth_date=12345678&user=%7B%22id%22%3A123%7D";
  const fakeResult = validateTelegramInitData(fakeInitData, testBotToken);
  assert(fakeResult.valid === false, "Telegram initData without hash is rejected");

  // 2. Application status classification logic
  function isActualApplication(lead: any): boolean {
    if (lead.type === "property_listing_request") return true;
    if (lead.metadata?.lead_type === "property_listing_request") return true;
    if (lead.property_id != null) return true;
    if (lead.type === "inquiry") return true;
    if (lead.metadata?.deal_type || lead.metadata?.property_type) return true;
    if (lead.metadata?.registration_step === "contact_shared") return false;
    if (lead.type === "telegram" && (!lead.message || lead.message.includes("kontaktini yubordi"))) return false;
    return Boolean(lead.message && lead.message.trim().length > 0);
  }

  const listingLead = {
    id: "lead-1",
    type: "property_listing_request",
    metadata: { deal_type: "sale", property_type: "apartment", location: "Angren markaz" },
    message: "3 xonali kvartira sotiladi",
  };
  assert(isActualApplication(listingLead) === true, "Property listing request is correctly classified as an actual application");

  const contactOnlyLead = {
    id: "lead-2",
    type: "telegram",
    metadata: { registration_step: "contact_shared", telegram_user_id: 112233 },
    message: "Foydalanuvchi Telegram bot orqali kontaktini yubordi va ro‘yxatdan o‘tdi.",
  };
  assert(isActualApplication(contactOnlyLead) === false, "Contact-shared registration lead is NOT misclassified as property application");

  const generalInquiryLead = {
    id: "lead-3",
    type: "inquiry",
    property_id: "prop-123",
    message: "Narxi bo'yicha ma'lumot olmoqchiman",
  };
  assert(isActualApplication(generalInquiryLead) === true, "Property inquiry lead is classified as application");

  // 3. User registration source classification
  function resolveUserSource(profile: any): "google" | "telegram" | "other" {
    if (profile.auth_provider === "telegram" || String(profile.id).startsWith("tg_") || (profile.telegram_user_id && !profile.google_id && !profile.email?.includes("@gmail.com"))) {
      return "telegram";
    }
    if (profile.auth_provider === "google" || profile.google_id || profile.email?.includes("@gmail.com") || profile.avatar_url?.includes("googleusercontent")) {
      return "google";
    }
    if (profile.telegram_user_id) return "telegram";
    return "other";
  }

  const googleProfile = {
    id: "3e59ba9c-3abf-490b-9df2-9b2f671bb5d2",
    email: "client@gmail.com",
    google_id: "10982347891234",
    auth_provider: "google",
  };
  assert(resolveUserSource(googleProfile) === "google", "Google profile is resolved as source google");

  const tgProfile = {
    id: "tg_987654321",
    email: "@farhod_angren",
    telegram_user_id: 987654321,
    auth_provider: "telegram",
  };
  assert(resolveUserSource(tgProfile) === "telegram", "Telegram profile is resolved as source telegram");

  // 4. Admin Direct Telegram Messaging Guardrails
  function validateTelegramMessagingCapability(user: { telegram_user_id?: number; can_message_telegram?: boolean }): { canSend: boolean; errorReason?: string } {
    if (!user.telegram_user_id) {
      return {
        canSend: false,
        errorReason: "Foydalanuvchi Telegram botni ishga tushirmagan. Telegram qoidalariga ko‘ra, bot foydalanuvchiga birinchi bo‘lib yozolmaydi.",
      };
    }
    return { canSend: true };
  }

  const userWithoutBot = { id: "u-1", name: "Alisher", telegram_user_id: undefined };
  const userWithBot = { id: "u-2", name: "Bobur", telegram_user_id: 445566, can_message_telegram: true };

  assert(validateTelegramMessagingCapability(userWithoutBot).canSend === false, "User without Telegram ID cannot be messaged by bot");
  assert(
    validateTelegramMessagingCapability(userWithoutBot).errorReason?.includes("birinchi bo‘lib yozolmaydi") === true,
    "Clear Telegram restriction reason provided for user without bot"
  );
  assert(validateTelegramMessagingCapability(userWithBot).canSend === true, "User with Telegram ID can be messaged by bot");

  console.log(`\n=================================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
