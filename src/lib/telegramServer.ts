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

    // Sort all key-value pairs alphabetically (excluding 'hash')
    const pairs: string[] = [];
    urlParams.forEach((val, key) => {
      if (key !== "hash") {
        pairs.push(`${key}=${val}`);
      }
    });
    pairs.sort();

    const dataCheckString = pairs.join("\n");

    // 1. Generate secret key using HMAC-SHA256 of "WebAppData" with botToken
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    // 2. Generate calculated hash using HMAC-SHA256 of dataCheckString with secretKey
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // 3. Timing-safe comparison to prevent timing attacks
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

    // 4. Validate auth_date freshness (allow up to 24 hours to prevent replay attacks)
    const authDateStr = urlParams.get("auth_date");
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (authDate > 0 && (now - authDate > 86400 || authDate - now > 300)) {
      return {
        valid: false,
        error: "initData session has expired",
      };
    }

    // 5. Parse user data safely
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
 * Docs: https://core.telegram.org/bots/api#setwebhook
 */
export async function setTelegramWebhook(
  botToken?: string,
  webhookUrl: string = "https://angrenestate.uz/api/telegram/webhook"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

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
 * Docs: https://core.telegram.org/bots/api#setchatmenubutton
 */
export async function setTelegramMenuButton(
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setChatMenuButton`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "ANGREN ESTATE",
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
 * Docs: https://core.telegram.org/bots/api#setmycommands
 */
export async function setTelegramBotCommands(botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

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
 * Inspection methods: getMe, getWebhookInfo, getMyCommands, getChatMenuButton
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
 * Send welcome message with Telegram Web App button
 * Uses HTML parse mode for 100% reliable entity parsing
 */
export async function sendTelegramWelcomeMessage(
  chatId: number | string,
  userLanguageCode: string = "uz",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const isUz = userLanguageCode.startsWith("uz");

  const messageHtml = isUz
    ? `🏢 <b>ANGREN ESTATE</b> — Angren shahrining rasmiy ko‘chmas mulk platformasi.\n\n` +
      `Xarita orqali kvartiralar, hovlilar va tijorat binolarini ko‘ring, solishtiring va qulay tanlang.\n\n` +
      `Ilovani to‘g‘ridan-to‘g‘ri Telegram ichida ochish uchun pastdagi tugmani bosing:`
    : `🏢 <b>ANGREN ESTATE</b> — официальная платформа недвижимости города Ангрен.\n\n` +
      `Интерактивная карта, актуальные цены на квартиры, дома и коммерческую недвижимость.\n\n` +
      `Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram:`;

  const primaryButtonText = isUz
    ? "Obyektlarni ko‘rish 📍"
    : "Открыть ANGREN ESTATE 🏢";

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: primaryButtonText,
                web_app: {
                  url: webAppUrl,
                },
              },
            ],
            [
              {
                text: isUz ? "🇷🇺 Русский" : "🇺🇿 O‘zbekcha",
                web_app: {
                  url: `${webAppUrl}?lang=${isUz ? "ru" : "uz"}`,
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
