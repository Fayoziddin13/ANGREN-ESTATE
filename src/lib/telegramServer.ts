import crypto from "crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ValidatedTelegramData {
  valid: boolean;
  user?: TelegramUser;
  authDate?: number;
  queryId?: string;
  error?: string;
}

/**
 * Validates Telegram WebApp initData according to official specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken?: string
): ValidatedTelegramData {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      valid: false,
      error: "TELEGRAM_BOT_TOKEN is not configured on the server",
    };
  }

  if (!initData || typeof initData !== "string") {
    return {
      valid: false,
      error: "initData is required and must be a string",
    };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");

    if (!hash) {
      return {
        valid: false,
        error: "Missing hash parameter in initData",
      };
    }

    const pairs: string[] = [];
    urlParams.forEach((val, key) => {
      if (key !== "hash") {
        pairs.push(`${key}=${val}`);
      }
    });
    pairs.sort();

    const dataCheckString = pairs.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    const receivedBuffer = Buffer.from(hash, "hex");

    if (
      calculatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, receivedBuffer)
    ) {
      return {
        valid: false,
        error: "Invalid cryptographic signature (hash mismatch)",
      };
    }

    const authDateStr = urlParams.get("auth_date");
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (authDate > 0 && (now - authDate > 86400 || authDate - now > 300)) {
      return {
        valid: false,
        error: "initData session has expired",
      };
    }

    const userStr = urlParams.get("user");
    let user: TelegramUser | undefined = undefined;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        console.warn("[TelegramServer] Failed to parse user JSON:", e);
      }
    }

    return {
      valid: true,
      user,
      authDate,
      queryId: urlParams.get("query_id") || undefined,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Validation exception: ${err.message}`,
    };
  }
}

/**
 * Configure Telegram Bot Webhook
 */
export async function setTelegramWebhook(
  botToken?: string,
  webhookUrl: string = "https://angrenestate.uz/api/telegram/webhook"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`setWebhook failed: ${data.description}`);
  }
  return data;
}

/**
 * Configure Telegram Bot Menu Button to open ANGREN ESTATE Web App
 */
export async function setTelegramMenuButton(
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setChatMenuButton`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "🏠 ANGREN ESTATE",
          web_app: {
            url: webAppUrl,
          },
        },
      }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`setChatMenuButton failed: ${data.description}`);
  }
  return data;
}

/**
 * Register default bot commands
 */
export async function setTelegramBotCommands(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setMyCommands`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          {
            command: "start",
            description: "Boshlash / Запустить бота",
          },
          {
            command: "app",
            description: "ANGREN ESTATE Mini App",
          },
        ],
      }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`setMyCommands failed: ${data.description}`);
  }
  return data;
}

/**
 * Inspection methods
 */
export async function getTelegramBotInfo(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return await res.json();
}

export async function getTelegramWebhookInfo(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  return await res.json();
}

export async function getTelegramBotCommands(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/getMyCommands`);
  return await res.json();
}

export async function getTelegramMenuButton(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`);
  return await res.json();
}

/**
 * Generate standard welcome message payload
 */
export function getTelegramWelcomePayload(
  lang: "uz" | "ru" = "uz",
  webAppUrl: string = "https://angrenestate.uz"
) {
  const isUz = lang === "uz";

  const text = isUz
    ? "🏠 ANGREN ESTATE — Angren ko‘chmas mulki bir joyda.\n\n" +
      "📍 Kvartira, uy, yer va tijorat obyektlari.\n" +
      "🔎 Xarita orqali qidiring va filtrlardan foydalaning.\n" +
      "💚 Yoqtirgan obyektlaringizni saqlang.\n" +
      "📞 Mulk egasi yoki rieltor bilan bog‘laning.\n\n" +
      "Ilovani oching va o‘zingizga mos obyektni toping."
    : "🏠 ANGREN ESTATE — недвижимость Ангрена в одном месте.\n\n" +
      "📍 Квартиры, дома, участки и коммерческие объекты.\n" +
      "🔎 Поиск и фильтры на карте.\n" +
      "💚 Сохраняйте понравившиеся объекты.\n" +
      "📞 Связывайтесь с владельцами и риелторами.\n\n" +
      "Откройте приложение и найдите подходящий объект.";

  const appUrl = isUz ? `${webAppUrl}?lang=uz` : `${webAppUrl}?lang=ru`;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: "🏠 ANGREN ESTATE",
          web_app: {
            url: appUrl,
          },
        },
      ],
      [
        {
          text: "🇷🇺 Русский | 🇺🇿 O‘zbekcha",
          callback_data: isUz ? "lang_ru" : "lang_uz",
        },
      ],
    ],
  };

  return { text, reply_markup };
}

/**
 * Send welcome message with Telegram Web App button
 */
export async function sendTelegramWelcomeMessage(
  chatId: number | string,
  userLanguageCode: string = "uz",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const lang = userLanguageCode.startsWith("uz") ? "uz" : "ru";
  const { text, reply_markup } = getTelegramWelcomePayload(lang, webAppUrl);

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup,
      }),
    }
  );

  return await response.json();
}

/**
 * Edit existing welcome message in-place when language toggled
 */
export async function editTelegramWelcomeMessage(
  chatId: number | string,
  messageId: number,
  targetLang: "uz" | "ru",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const { text, reply_markup } = getTelegramWelcomePayload(targetLang, webAppUrl);

  const response = await fetch(
    `https://api.telegram.org/bot${token}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup,
      }),
    }
  );

  return await response.json();
}

/**
 * Acknowledge Telegram callback query
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  botToken?: string
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
    }),
  }).catch(() => {});
}

/**
 * Send /app direct Mini App button
 */
export async function sendTelegramAppMessage(
  chatId: number | string,
  userLanguageCode: string = "uz",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const isUz = userLanguageCode.startsWith("uz");
  const text = isUz
    ? "🏠 ANGREN ESTATE Mini App:"
    : "🏠 Приложение ANGREN ESTATE:";

  const appUrl = isUz ? `${webAppUrl}?lang=uz` : `${webAppUrl}?lang=ru`;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏠 ANGREN ESTATE",
                web_app: {
                  url: appUrl,
                },
              },
            ],
          ],
        },
      }),
    }
  );

  return await response.json();
}
