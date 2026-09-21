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
 * Configure Telegram Bot Menu Button to open ANGREN ESTATE Web App
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
 * Send welcome message with Telegram Web App button
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

  const messageText = isUz
    ? `🏢 *ANGREN ESTATE* — Angren shahrining rasmiy ko‘chmas mulk platformasi\.\n\n` +
      `Xarita orqali kvartiralar, hovlilar va tijorat binolarini ko‘ring, solishtiring va qulay tanlang\.\n\n` +
      `Ilovani to‘g‘ridan\-to‘g‘ri Telegram ichida ochish uchun pastdagi tugmani bosing:`
    : `🏢 *ANGREN ESTATE* — официальная платформа недвижимости города Ангрен\.\n\n` +
      `Интерактивная карта, актуальные цены на квартиры, дома и коммерческую недвижимость\.\n\n` +
      `Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram:`;

  const buttonText = isUz
    ? "Obyektlarni ko‘rish 📍"
    : "Открыть ANGREN ESTATE 🏢";

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: buttonText,
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
