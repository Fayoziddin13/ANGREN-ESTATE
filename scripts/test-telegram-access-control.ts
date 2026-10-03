import fs from "fs";
import crypto from "crypto";

// Load .env.local
if (fs.existsSync(".env.local")) {
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx > 0) {
          const key = t.substring(0, idx).trim();
          const val = t.substring(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
}

import {
  normalizePhoneNumber,
  getTelegramWelcomePayload,
  getTelegramRegistrationPromptPayload,
  getTelegramRegistrationSuccessPayload,
  upsertTelegramUser,
  getTelegramUser,
  isTelegramUserRegistered,
  validateTelegramInitData,
} from "../src/lib/telegramServer";
import { getPublishedProperties } from "../src/lib/properties";
import { supabaseAdmin } from "../src/lib/supabaseServer";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING TELEGRAM BOT & MINI APP ACCESS CONTROL TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? " - " + detail : ""}`);
    }
  }

  // --- Test 1: Phone Normalization ---
  const raw1 = "+998 90 123 45 67";
  const raw2 = "998901234567";
  const raw3 = "901234567";
  const raw4 = "+998-90-123-45-67";
  const raw5 = "+7 999 123 45 67";

  assert(normalizePhoneNumber(raw1) === "+998901234567", "Phone normalization: spaced Uzbekistan number");
  assert(normalizePhoneNumber(raw2) === "+998901234567", "Phone normalization: no-plus 12-digit number");
  assert(normalizePhoneNumber(raw3) === "+998901234567", "Phone normalization: 9-digit local number");
  assert(normalizePhoneNumber(raw4) === "+998901234567", "Phone normalization: dashed number");
  assert(normalizePhoneNumber(raw5) === "+79991234567", "Phone normalization: international Russian number");

  // --- Test 2: Unregistered user /start payload (NO Mini App button!) ---
  const promptUz = getTelegramRegistrationPromptPayload("uz");
  const promptRu = getTelegramRegistrationPromptPayload("ru");

  const uzHasNoMiniApp = !JSON.stringify(promptUz).includes("Mini App'ni ochish") && !JSON.stringify(promptUz).includes("web_app");
  const uzHasContactButton = promptUz.reply_markup.keyboard[0][0].text === "📱 Telefon raqamimni yuborish" && promptUz.reply_markup.keyboard[0][0].request_contact === true;
  assert(uzHasNoMiniApp, "Unregistered /start prompt: Strictly NO Mini App button in markup");
  assert(uzHasContactButton, "Unregistered /start prompt: Contact request button present with request_contact=true");
  assert(promptUz.text.includes("ro‘yxatdan o‘ting"), "Unregistered /start prompt: Explains registration is required");
  assert(promptRu.reply_markup.keyboard[0][0].text === "📱 Отправить номер телефона", "Unregistered /start prompt RU: Russian button text matches spec");

  // --- Test 3: Registered user /start welcome payload ---
  const welcomeUz = getTelegramWelcomePayload("uz");
  const welcomeRu = getTelegramWelcomePayload("ru");

  const firstBtn = welcomeUz.reply_markup.inline_keyboard[0][0] as any;
  const uzWelcomeHasMiniApp = firstBtn.text === "🏠 Mini App'ni ochish" && Boolean(firstBtn.web_app);
  const uzWelcomeHasLang = welcomeUz.reply_markup.inline_keyboard[1][0].text.includes("Русский");
  assert(uzWelcomeHasMiniApp, "Registered /start welcome: Mini App inline button present with web_app URL");
  assert(uzWelcomeHasLang, "Registered /start welcome: Language switcher button present");
  assert(welcomeUz.text.includes("Angrendagi ko‘chmas mulklarni"), "Registered /start welcome: Exact description text matches spec");

  // --- Test 4: Registration Success payload ---
  const successUz = getTelegramRegistrationSuccessPayload("uz");
  const successRu = getTelegramRegistrationSuccessPayload("ru");

  assert(successUz.text.includes("Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi."), "Registration success: Header matches spec");
  assert(successUz.text.includes("• Kvartiralar"), "Registration success: Category list present");
  assert(successUz.reply_markup.inline_keyboard[0][0].text === "🏠 ANGREN ESTATE Mini App'ni ochish", "Registration success: Opens Mini App inline button");

  // --- Test 5: Idempotent user registration & state checking ---
  const testUserId = Math.floor(100000000 + Math.random() * 900000000);
  const initialUser = await upsertTelegramUser({
    id: testUserId,
    username: "testuser_unreg",
    first_name: "Test",
    last_name: "Unregistered",
    phone: null,
  });

  const check1 = await isTelegramUserRegistered(testUserId);
  assert(!check1.is_registered, "DB check before sharing contact: user is NOT registered");

  // Now user shares contact
  const registeredUser = await upsertTelegramUser({
    id: testUserId,
    username: "testuser_unreg",
    first_name: "Test",
    last_name: "Unregistered",
    phone: "+998 90 999 88 77",
  });

  const check2 = await isTelegramUserRegistered(testUserId);
  assert(check2.is_registered, "DB check after sharing contact: user IS registered");
  assert(check2.user?.phone === "+998909998877", "DB check: user phone is normalized in storage");

  // Test idempotent upsert - duplicate registration attempt
  const updatedUser = await upsertTelegramUser({
    id: testUserId,
    username: "testuser_updated",
    phone: "998909998877",
  });
  const check3 = await isTelegramUserRegistered(testUserId);
  assert(check3.is_registered && check3.user?.username === "testuser_updated", "Idempotent registration: updates metadata without duplicates");

  // --- Test 6: Cryptographic HMAC initData validation ---
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "test_token_123456:ABC-DEF";
  const userPayload = JSON.stringify({ id: testUserId, first_name: "Test", username: "testuser_updated" });
  const authDate = Math.floor(Date.now() / 1000).toString();

  // Create valid hash
  const dataCheckArr = [`auth_date=${authDate}`, `user=${userPayload}`].sort();
  const dataCheckString = dataCheckArr.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const validHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const validInitData = `user=${encodeURIComponent(userPayload)}&auth_date=${authDate}&hash=${validHash}`;

  const validResult = validateTelegramInitData(validInitData, botToken);
  assert(validResult.valid && validResult.user?.id === testUserId, "HMAC-SHA256 InitData: Valid signature accepted");

  // Tampered hash
  const tamperedInitData = `user=${encodeURIComponent(userPayload)}&auth_date=${authDate}&hash=deadbeef00112233445566778899aabbccddeeff`;
  const tamperedResult = validateTelegramInitData(tamperedInitData, botToken);
  assert(!tamperedResult.valid, "HMAC-SHA256 InitData: Tampered signature rejected");

  // --- Test 7: Real property and realtor data integrity ---
  const properties = await getPublishedProperties();
  const realtorsMeta = fs.existsSync("data/realtors_meta.json")
    ? JSON.parse(fs.readFileSync("data/realtors_meta.json", "utf8"))
    : {};
  const realtorCount = Object.keys(realtorsMeta).length;
  assert(properties.length >= 9, `Data integrity: Real properties intact (${properties.length} >= 9)`);
  assert(realtorCount >= 2, `Data integrity: Real realtors intact (${realtorCount} >= 2)`);

  console.log(`\n--------------------------------------------------`);
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed/total)*100)}%)`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
