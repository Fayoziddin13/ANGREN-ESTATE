/**
 * TELEGRAM CHANNEL PHOTO DELIVERY & DIAGNOSTICS VALIDATION TESTS
 *
 * Verifies that:
 * 1. Image candidate resolution follows strict priority (main_image -> images[0] -> photos[0]).
 * 2. Relative image paths resolve to canonical public HTTPS, and local hostnames are rejected.
 * 3. URL sanitization removes sensitive query params/tokens for clean diagnostics.
 * 4. Image accessibility pre-check validates HEAD and GET Range fallback.
 * 5. Error discernment accurately distinguishes genuine photo errors from non-photo errors.
 * 6. Non-photo errors (admin rights, chat not found) NEVER trigger photo fallback.
 * 7. Photo error with successful direct multipart upload delivers post WITH photo.
 * 8. Photo error with failed multipart gracefully falls back to text post with diagnostic logging.
 * 9. Properties without photos deliver text-only post directly.
 *
 * ZERO real Telegram posts or Supabase mutations.
 */

import {
  resolvePropertyPhotoUrl,
  resolveCanonicalPhotoUrl,
  sanitizeDiagnosticUrl,
  checkImageUrlAccessible,
  isTelegramPhotoSpecificError,
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

const baseProperty: Property = {
  id: "prop-test-photo-101",
  slug: "prop-test-photo-101",
  title_uz: "Test Obyekt",
  title_ru: "Тестовый Объект",
  description_uz: "Test tavsifi",
  description_ru: "Тестовое описание",
  address_uz: "Mustaqillik ko‘chasi",
  address_ru: "ул. Мустакиллик",
  district_name_uz: "Markaz",
  district_name_ru: "Центр",
  transaction_type: "sale",
  property_type: "apartment",
  status: "published",
  price_uzs: 500000000,
  price_usd: 40000,
  currency: "USD",
  area_sqm: 80,
  rooms: 3,
  floor: 3,
  total_floors: 5,
  renovation: "euro",
  images: [],
  utilities: {} as any,
  amenities: {} as any,
  created_at: new Date().toISOString(),
  coordinates: { lat: 41.012, lng: 70.123 },
  contact_phone: "+998 90 123 45 67",
  realtor: {
    id: "r1",
    name: "Alisher Realtor",
    phone: "+998 90 123 45 67",
    telegram: "@alisher_realtor",
    experience_years: 5,
    specialization_uz: "Kvartiralar",
    specialization_ru: "Квартиры",
    districts: ["Markaz"],
    is_active: true,
    created_at: new Date().toISOString(),
  },
};

async function runPhotoDeliveryTests() {
  console.log("\n=======================================================");
  console.log("TELEGRAM CHANNEL PHOTO DELIVERY & DIAGNOSTICS TESTS");
  console.log("=======================================================\n");

  // -------------------------------------------------------------------------
  // 1. Photo Candidate Resolution Priority Tests
  // -------------------------------------------------------------------------
  console.log("--- 1. Photo Resolution Priority Tests ---");

  // 1.1: Priority 1 - main_image
  const propWithAllImages: Property = {
    ...baseProperty,
    main_image: "https://gemozzkmoogjxtdwvepz.supabase.co/main.jpg",
    images: ["https://gemozzkmoogjxtdwvepz.supabase.co/img1.jpg"],
    photos: ["https://gemozzkmoogjxtdwvepz.supabase.co/photo1.jpg"],
  };
  assert(
    resolvePropertyPhotoUrl(propWithAllImages) === "https://gemozzkmoogjxtdwvepz.supabase.co/main.jpg",
    "1.1: Priority 1 - Selects main_image when all fields present"
  );

  // 1.2: Priority 2 - images[0] when main_image is empty string
  const propWithImagesOnly: Property = {
    ...baseProperty,
    main_image: "   ",
    images: ["https://gemozzkmoogjxtdwvepz.supabase.co/img1.jpg"],
    photos: ["https://gemozzkmoogjxtdwvepz.supabase.co/photo1.jpg"],
  };
  assert(
    resolvePropertyPhotoUrl(propWithImagesOnly) === "https://gemozzkmoogjxtdwvepz.supabase.co/img1.jpg",
    "1.2: Priority 2 - Falls back to images[0] when main_image is whitespace or missing"
  );

  // 1.3: Priority 3 - photos[0] when main_image and images are empty
  const propWithPhotosOnly: Property = {
    ...baseProperty,
    main_image: undefined,
    images: [],
    photos: ["https://gemozzkmoogjxtdwvepz.supabase.co/photo1.jpg"],
  };
  assert(
    resolvePropertyPhotoUrl(propWithPhotosOnly) === "https://gemozzkmoogjxtdwvepz.supabase.co/photo1.jpg",
    "1.3: Priority 3 - Falls back to photos[0] when main_image and images are empty"
  );

  // 1.4: Empty when no image fields present
  const propNoImages: Property = {
    ...baseProperty,
    main_image: undefined,
    images: [],
    photos: [],
  };
  assert(
    resolvePropertyPhotoUrl(propNoImages) === "",
    "1.4: Returns empty string when no image fields exist"
  );

  // -------------------------------------------------------------------------
  // 2. Canonical Photo URL Resolution & Localhost Protection
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Canonical Photo URL Resolution Tests ---");

  // 2.1: Relative path
  const relResult = resolveCanonicalPhotoUrl("/uploads/properties/prop1/photo.jpg");
  assert(
    relResult.isValidPublicHttps === true,
    "2.1: Relative path resolves to valid public HTTPS"
  );
  assert(
    relResult.url === "https://angrenestate.uz/uploads/properties/prop1/photo.jpg",
    "2.1: Relative path is prefixed with canonical production site URL"
  );

  // 2.2: Localhost rejection
  const localResult = resolveCanonicalPhotoUrl("http://localhost:3000/photo.jpg");
  assert(
    localResult.isValidPublicHttps === false,
    "2.2: Localhost URL is strictly marked invalid for Telegram photo delivery"
  );
  assert(
    localResult.url === "",
    "2.2: Localhost URL is cleared"
  );

  // 2.3: 127.0.0.1 rejection
  const ipResult = resolveCanonicalPhotoUrl("http://127.0.0.1:8080/image.png");
  assert(
    ipResult.isValidPublicHttps === false,
    "2.3: 127.0.0.1 URL is strictly marked invalid"
  );

  // 2.4: Valid Supabase public HTTPS
  const supabaseResult = resolveCanonicalPhotoUrl(
    "https://gemozzkmoogjxtdwvepz.supabase.co/storage/v1/object/public/property-images/prop.jpg"
  );
  assert(
    supabaseResult.isValidPublicHttps === true,
    "2.4: Valid Supabase public storage HTTPS URL is accepted"
  );

  // -------------------------------------------------------------------------
  // 3. Diagnostic URL Sanitization Tests
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Diagnostic URL Sanitization Tests ---");

  assert(
    sanitizeDiagnosticUrl("https://example.com/photo.jpg?token=secretKey123&signature=abc") ===
      "https://example.com/photo.jpg?[REDACTED_QUERY]",
    "3.1: Sensitive query tokens are redacted in diagnostic logs"
  );
  assert(
    sanitizeDiagnosticUrl("https://example.com/clean-photo.jpg") ===
      "https://example.com/clean-photo.jpg",
    "3.2: Clean URLs without query parameters are preserved"
  );

  // -------------------------------------------------------------------------
  // 4. Photo-Specific Error Discernment Tests
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Error Discernment Tests ---");

  // Genuine photo errors: MUST return true (eligible for multipart/text fallback)
  assert(
    isTelegramPhotoSpecificError("Bad Request: failed to get HTTP URL content") === true,
    "4.1: 'failed to get HTTP URL content' is recognized as photo error"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: wrong type of the web page content") === true,
    "4.2: 'wrong type of the web page content' is recognized as photo error"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: IMAGE_PROCESS_FAILED") === true,
    "4.3: 'IMAGE_PROCESS_FAILED' is recognized as photo error"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: PHOTO_INVALID_DIMENSIONS") === true,
    "4.4: 'PHOTO_INVALID_DIMENSIONS' is recognized as photo error"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: photo is too big") === true,
    "4.5: 'photo is too big' is recognized as photo error"
  );

  // Non-photo errors: MUST return false (NEVER trigger photo fallback)
  assert(
    isTelegramPhotoSpecificError("Bad Request: chat not found") === false,
    "4.6: 'chat not found' is strictly rejected from photo fallback"
  );
  assert(
    isTelegramPhotoSpecificError("Forbidden: bot is not an administrator in the channel") === false,
    "4.7: 'bot is not an administrator' is strictly rejected from photo fallback"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: inline keyboard button URL '...' is invalid: Wrong HTTP URL") === false,
    "4.8: 'Wrong HTTP URL' on inline button is strictly rejected from photo fallback"
  );
  assert(
    isTelegramPhotoSpecificError("Bad Request: BUTTON_TYPE_INVALID") === false,
    "4.9: 'BUTTON_TYPE_INVALID' is strictly rejected from photo fallback"
  );
  assert(
    isTelegramPhotoSpecificError("Too Many Requests: retry after 5") === false,
    "4.10: Rate limit error is strictly rejected from photo fallback"
  );

  // -------------------------------------------------------------------------
  // 5. Image Accessibility Pre-check (HEAD & GET Range) Tests
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Image Accessibility Pre-check Tests ---");

  const origFetch = global.fetch;

  // 5.1: HEAD 200 OK succeeds directly
  global.fetch = async (url: any, opts: any) => {
    if (opts?.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "204800" },
      });
    }
    return new Response(null, { status: 404 });
  };
  const headOkCheck = await checkImageUrlAccessible("https://example.com/test.jpg");
  assert(headOkCheck.accessible === true, "5.1: HEAD 200 returns accessible=true");
  assert(headOkCheck.contentType === "image/jpeg", "5.1: Content-type image/jpeg detected");
  assert(headOkCheck.size === 204800, "5.1: Size 204800 detected");

  // 5.2: HEAD returns 405 Method Not Allowed -> GET Range succeeds with 206
  global.fetch = async (url: any, opts: any) => {
    if (opts?.method === "HEAD") {
      return new Response(null, { status: 405, statusText: "Method Not Allowed" });
    }
    if (opts?.method === "GET" && opts?.headers?.Range) {
      return new Response(new Uint8Array(1024), {
        status: 206,
        headers: { "content-type": "image/webp", "content-length": "1024" },
      });
    }
    return new Response(null, { status: 404 });
  };
  const getFallbackCheck = await checkImageUrlAccessible("https://example.com/test.webp");
  assert(
    getFallbackCheck.accessible === true,
    "5.2: HEAD 405 correctly falls back to GET Range and returns accessible=true"
  );
  assert(
    getFallbackCheck.contentType === "image/webp",
    "5.2: Correct content-type image/webp detected via GET Range"
  );

  // 5.3: Both HEAD and GET return 404 Not Found
  global.fetch = async () => {
    return new Response(null, { status: 404, statusText: "Not Found" });
  };
  const deadCheck = await checkImageUrlAccessible("https://example.com/dead.jpg");
  assert(deadCheck.accessible === false, "5.3: 404 image returns accessible=false");

  // -------------------------------------------------------------------------
  // 6. Channel Publishing Workflows (Mocked Telegram Bot API)
  // -------------------------------------------------------------------------
  console.log("\n--- 6. End-to-End Publishing & Fallback Tests ---");

  process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_mock";
  process.env.TELEGRAM_CHANNEL_ID = "@angren_estate";

  // Scenario 6.1: Normal successful sendPhoto via URL
  {
    let sendPhotoCalledWithUrl: boolean = false;
    let textMessageCalled: boolean = false;

    global.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/sendPhoto")) {
        sendPhotoCalledWithUrl = true;
        return new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 301, chat: { id: "@angren_estate" } },
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes("/sendMessage")) {
        textMessageCalled = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 302 } }), { status: 200 });
      }
      // Image HEAD/GET check
      return new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } });
    };

    const propWithImage: Property = {
      ...baseProperty,
      main_image: "https://gemozzkmoogjxtdwvepz.supabase.co/img.jpg",
    };

    const res = await publishPropertyToTelegramChannel(propWithImage, {
      forceRepeat: true,
      updatePropertyFn: async () => propWithImage,
    });

    assert(res.success === true, "6.1: Returns success=true on normal photo publish");
    assert(res.messageId === 301, "6.1: Returns messageId 301");
    assert(Boolean(sendPhotoCalledWithUrl), "6.1: sendPhoto API was called with photo URL");
    assert(!textMessageCalled, "6.1: textMessage fallback was NOT called");
  }

  // Scenario 6.2: Photo URL fails with photo error ("failed to get HTTP URL content"),
  //               direct multipart buffer upload succeeds
  {
    let urlAttemptFailed: boolean = false;
    let multipartAttemptSucceeded: boolean = false;
    let textFallbackCalled: boolean = false;

    global.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/sendPhoto")) {
        // Distinguish JSON body (URL attempt) vs FormData (multipart attempt)
        if (opts?.headers?.["Content-Type"] === "application/json") {
          urlAttemptFailed = true;
          return new Response(
            JSON.stringify({
              ok: false,
              error_code: 400,
              description: "Bad Request: failed to get HTTP URL content",
            }),
            { status: 400 }
          );
        } else {
          // Multipart FormData attempt
          multipartAttemptSucceeded = true;
          return new Response(
            JSON.stringify({
              ok: true,
              result: { message_id: 401, chat: { id: "@angren_estate" } },
            }),
            { status: 200 }
          );
        }
      }
      if (urlStr.includes("/sendMessage")) {
        textFallbackCalled = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 402 } }), { status: 200 });
      }
      // Image download endpoint
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "4" },
      });
    };

    const propMultipart: Property = {
      ...baseProperty,
      id: "prop-multipart-test",
      main_image: "https://gemozzkmoogjxtdwvepz.supabase.co/cf-blocked.jpg",
    };

    const res = await publishPropertyToTelegramChannel(propMultipart, {
      forceRepeat: true,
      updatePropertyFn: async () => propMultipart,
    });

    assert(res.success === true, "6.2: Returns success=true when direct multipart succeeds");
    assert(res.messageId === 401, "6.2: Captures messageId 401 from multipart post");
    assert(Boolean(urlAttemptFailed), "6.2: Detected Telegram URL download failure");
    assert(Boolean(multipartAttemptSucceeded), "6.2: Successfully uploaded binary buffer via multipart");
    assert(!textFallbackCalled, "6.2: Preserved photo post (did NOT degrade to text-only)");
  }

  // Scenario 6.3: Both URL and multipart fail with photo error -> Gracefully falls back to text post
  {
    let urlAttemptFailed: boolean = false;
    let multipartAttemptFailed: boolean = false;
    let textFallbackSucceeded: boolean = false;

    global.fetch = async (url: any, opts: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/sendPhoto")) {
        if (opts?.headers?.["Content-Type"] === "application/json") {
          urlAttemptFailed = true;
          return new Response(
            JSON.stringify({
              ok: false,
              error_code: 400,
              description: "Bad Request: failed to get HTTP URL content",
            }),
            { status: 400 }
          );
        } else {
          multipartAttemptFailed = true;
          return new Response(
            JSON.stringify({
              ok: false,
              error_code: 400,
              description: "Bad Request: IMAGE_PROCESS_FAILED",
            }),
            { status: 400 }
          );
        }
      }
      if (urlStr.includes("/sendMessage")) {
        textFallbackSucceeded = true;
        return new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 501, chat: { id: "@angren_estate" } },
          }),
          { status: 200 }
        );
      }
      // Image download endpoint
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    };

    const propFallback: Property = {
      ...baseProperty,
      id: "prop-fallback-test",
      main_image: "https://gemozzkmoogjxtdwvepz.supabase.co/corrupt.jpg",
    };

    const res = await publishPropertyToTelegramChannel(propFallback, {
      forceRepeat: true,
      updatePropertyFn: async () => propFallback,
    });

    assert(res.success === true, "6.3: Fallback text post succeeds when photo delivery is impossible");
    assert(res.messageId === 501, "6.3: MessageId 501 recorded from text fallback");
    assert(Boolean(urlAttemptFailed), "6.3: URL attempt failed");
    assert(Boolean(multipartAttemptFailed), "6.3: Multipart attempt failed");
    assert(Boolean(textFallbackSucceeded), "6.3: Direct text message fallback succeeded");
  }

  // Scenario 6.4: Non-photo error (Forbidden: bot is not an administrator) -> NO FALLBACK, reports error
  {
    let textFallbackCalled: boolean = false;

    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/sendPhoto")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error_code: 403,
            description: "Forbidden: bot is not an administrator in the channel",
          }),
          { status: 403 }
        );
      }
      if (urlStr.includes("/sendMessage")) {
        textFallbackCalled = true;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 999 } }), { status: 200 });
      }
      return new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } });
    };

    const propAdminError: Property = {
      ...baseProperty,
      id: "prop-admin-err",
      main_image: "https://gemozzkmoogjxtdwvepz.supabase.co/img.jpg",
    };

    const res = await publishPropertyToTelegramChannel(propAdminError, {
      forceRepeat: true,
      updatePropertyFn: async () => propAdminError,
    });

    assert(res.success === false, "6.4: Returns success=false when bot is not administrator");
    assert(res.status === "error", "6.4: Status is 'error'");
    assert(
      res.error === "Forbidden: bot is not an administrator in the channel",
      "6.4: Accurately preserves administrator error without masking"
    );
    assert(
      textFallbackCalled === false,
      "6.4: CRITICAL: Did NOT attempt text fallback on non-photo error"
    );
  }

  // Scenario 6.5: Property without photo delivers text post directly
  {
    let sendPhotoCalled: boolean = false;
    let textMessageCalled: boolean = false;

    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/sendPhoto")) {
        sendPhotoCalled = true;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (urlStr.includes("/sendMessage")) {
        textMessageCalled = true;
        return new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 601, chat: { id: "@angren_estate" } },
          }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    };

    const propNoImg: Property = {
      ...baseProperty,
      id: "prop-no-img",
      main_image: undefined,
      images: [],
      photos: [],
    };

    const res = await publishPropertyToTelegramChannel(propNoImg, {
      forceRepeat: true,
      updatePropertyFn: async () => propNoImg,
    });

    assert(res.success === true, "6.5: Returns success=true for property without photo");
    assert(res.messageId === 601, "6.5: Returns messageId 601 from text post");
    assert(!sendPhotoCalled, "6.5: sendPhoto was NEVER called when no photo exists");
    assert(Boolean(textMessageCalled), "6.5: sendMessage called directly");
  }

  // Restore original fetch
  global.fetch = origFetch;

  console.log("\n=======================================================");
  console.log(`PHOTO DELIVERY TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhotoDeliveryTests().catch((err) => {
  console.error("Test execution exception:", err);
  process.exit(1);
});
