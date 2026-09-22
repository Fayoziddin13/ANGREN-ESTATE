import crypto from "crypto";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "./supabaseServer";
import { isSupabaseConfigured } from "./supabase";
import {
  TelegramSubscriber,
  TelegramPropertyNotificationRecord,
  TelegramPropertyNotificationStats,
} from "./types";

export {
  type TelegramSubscriber,
  type TelegramPropertyNotificationRecord,
  type TelegramPropertyNotificationStats,
};

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
  webAppUrl: string = "https://angrenestate.uz",
  isRegistered: boolean = false
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

  const inline_keyboard: any[][] = [];

  // If user is not yet registered, add [Регистрация] / [Ro‘yxatdan o‘tish]
  if (!isRegistered) {
    inline_keyboard.push([
      {
        text: isUz ? "Ro‘yxatdan o‘tish" : "Регистрация",
        callback_data: "start_registration",
      },
    ]);
  }

  inline_keyboard.push([
    {
      text: "🏠 ANGREN ESTATE",
      web_app: {
        url: appUrl,
      },
    },
  ]);

  inline_keyboard.push([
    {
      text: "🇷🇺 Русский | 🇺🇿 O‘zbekcha",
      callback_data: isUz ? "lang_ru" : "lang_uz",
    },
  ]);

  const reply_markup = { inline_keyboard };

  return { text, reply_markup };
}

/**
 * Send welcome message with Telegram Web App button
 */
export async function sendTelegramWelcomeMessage(
  chatId: number | string,
  userLanguageCode: string = "uz",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz",
  isRegistered: boolean = false
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const lang = userLanguageCode.startsWith("ru") ? "ru" : "uz";
  const { text, reply_markup } = getTelegramWelcomePayload(lang, webAppUrl, isRegistered);

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
  webAppUrl: string = "https://angrenestate.uz",
  isRegistered: boolean = false
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const { text, reply_markup } = getTelegramWelcomePayload(targetLang, webAppUrl, isRegistered);

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
 * Prompt user to share their contact for registration
 */
export async function sendContactRequestMessage(
  chatId: number | string,
  lang: "uz" | "ru" = "uz",
  botToken?: string
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const isUz = lang === "uz";
  const text = isUz
    ? "📱 Ro‘yxatdan o‘tish uchun telefon raqamingizni yuboring."
    : "📱 Для регистрации поделитесь своим номером телефона.";

  const reply_markup = {
    keyboard: [
      [
        {
          text: isUz ? "📱 Kontaktni ulashish" : "📱 Поделиться контактом",
          request_contact: true,
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup,
    }),
  });

  return await response.json();
}

/**
 * Send registration success message, removing contact keyboard and displaying Mini App & lang buttons
 */
export async function sendRegistrationSuccessMessage(
  chatId: number | string,
  lang: "uz" | "ru" = "uz",
  botToken?: string,
  webAppUrl: string = "https://angrenestate.uz"
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const isUz = lang === "uz";
  const appUrl = isUz ? `${webAppUrl}?lang=uz` : `${webAppUrl}?lang=ru`;

  const inline_keyboard = [
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
  ];

  const successText = isUz
    ? "✅ Ro‘yxatdan o‘tish muvaffaqiyatli yakunlandi.\n\nEndi ANGREN ESTATE'ni ochib, xizmatdan foydalanishingiz mumkin."
    : "✅ Регистрация успешно завершена.\n\nТеперь вы можете открыть ANGREN ESTATE и пользоваться сервисом.";

  const firstRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: successText,
      reply_markup: {
        remove_keyboard: true,
      },
    }),
  });

  const firstJson = await firstRes.json();
  if (firstJson.ok && firstJson.result?.message_id) {
    const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: firstJson.result.message_id,
        reply_markup: {
          inline_keyboard,
        },
      }),
    });

    const editJson = await editRes.json();
    if (!editJson.ok) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: isUz ? "🏠 ANGREN ESTATE:" : "🏠 ANGREN ESTATE:",
          reply_markup: {
            inline_keyboard,
          },
        }),
      });
    }
  }

  return firstJson;
}

/**
 * Acknowledge Telegram callback query
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  botToken?: string,
  text?: string,
  showAlert?: boolean
) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: Boolean(showAlert),
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

// =============================================================================
// TELEGRAM SUBSCRIBERS & PROPERTY NOTIFICATIONS PERSISTENCE
// =============================================================================

const SUBSCRIBERS_FILE_PATH = path.join(process.cwd(), "data", "telegram_users.json");
const NOTIFICATIONS_FILE_PATH = path.join(process.cwd(), "data", "telegram_property_notifications.json");

async function readLocalSubscribers(): Promise<TelegramSubscriber[]> {
  try {
    if (!fs.existsSync(SUBSCRIBERS_FILE_PATH)) return [];
    const raw = await fs.promises.readFile(SUBSCRIBERS_FILE_PATH, "utf8");
    return JSON.parse(raw) as TelegramSubscriber[];
  } catch {
    return [];
  }
}

async function writeLocalSubscribers(users: TelegramSubscriber[]): Promise<void> {
  try {
    const dir = path.dirname(SUBSCRIBERS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const temp = `${SUBSCRIBERS_FILE_PATH}.tmp.${Date.now()}`;
    await fs.promises.writeFile(temp, JSON.stringify(users, null, 2), "utf8");
    await fs.promises.rename(temp, SUBSCRIBERS_FILE_PATH);
  } catch (e) {
    console.error("[TelegramServer] writeLocalSubscribers error:", e);
  }
}

async function readLocalNotifications(): Promise<TelegramPropertyNotificationRecord[]> {
  try {
    if (!fs.existsSync(NOTIFICATIONS_FILE_PATH)) return [];
    const raw = await fs.promises.readFile(NOTIFICATIONS_FILE_PATH, "utf8");
    return JSON.parse(raw) as TelegramPropertyNotificationRecord[];
  } catch {
    return [];
  }
}

async function writeLocalNotifications(records: TelegramPropertyNotificationRecord[]): Promise<void> {
  try {
    const dir = path.dirname(NOTIFICATIONS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const temp = `${NOTIFICATIONS_FILE_PATH}.tmp.${Date.now()}`;
    await fs.promises.writeFile(temp, JSON.stringify(records, null, 2), "utf8");
    await fs.promises.rename(temp, NOTIFICATIONS_FILE_PATH);
  } catch (e) {
    console.error("[TelegramServer] writeLocalNotifications error:", e);
  }
}

export interface UpsertTelegramUserInput {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  language_code?: string | null;
  language?: "uz" | "ru";
  notifications_enabled?: boolean;
  registered_at?: string | null;
}

/**
 * Register or update a Telegram user upon /start or contact registration.
 * Idempotent: updates existing user, preserves phone/registration, enables notifications.
 */
export async function upsertTelegramUser(
  user: UpsertTelegramUserInput
): Promise<TelegramSubscriber> {
  const lang: "uz" | "ru" =
    user.language || (user.language_code?.toLowerCase().startsWith("ru") ? "ru" : "uz");
  const now = new Date().toISOString();

  let subscriber: TelegramSubscriber = {
    telegram_user_id: user.id,
    username: user.username || undefined,
    first_name: user.first_name || undefined,
    last_name: user.last_name || undefined,
    phone: user.phone || undefined,
    language: lang,
    notifications_enabled: user.notifications_enabled !== undefined ? user.notifications_enabled : true,
    registered_at: user.registered_at || (user.phone ? now : undefined),
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    // 1. Attempt update/insert into telegram_users table in Supabase
    try {
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from("telegram_users")
        .select("*")
        .eq("telegram_user_id", user.id)
        .single();

      if (!fetchErr && existing) {
        subscriber = {
          telegram_user_id: user.id,
          username: user.username || existing.username || undefined,
          first_name: user.first_name || existing.first_name || undefined,
          last_name: user.last_name || existing.last_name || undefined,
          phone: user.phone || existing.phone || undefined,
          language: user.language || existing.language || lang,
          notifications_enabled: true,
          registered_at: user.registered_at || existing.registered_at || (user.phone ? now : undefined),
          created_at: existing.created_at || now,
          updated_at: now,
        };

        await supabaseAdmin
          .from("telegram_users")
          .update({
            username: subscriber.username || null,
            first_name: subscriber.first_name || null,
            last_name: subscriber.last_name || null,
            phone: subscriber.phone || null,
            language: subscriber.language,
            notifications_enabled: true,
            registered_at: subscriber.registered_at || null,
            updated_at: now,
          })
          .eq("telegram_user_id", user.id);
      } else {
        await supabaseAdmin.from("telegram_users").upsert(
          {
            telegram_user_id: user.id,
            username: subscriber.username || null,
            first_name: subscriber.first_name || null,
            last_name: subscriber.last_name || null,
            phone: subscriber.phone || null,
            language: subscriber.language,
            notifications_enabled: true,
            registered_at: subscriber.registered_at || null,
            created_at: now,
            updated_at: now,
          },
          { onConflict: "telegram_user_id" }
        );
      }
    } catch (err: any) {
      console.warn("[TelegramServer] Supabase telegram_users upsert notice:", err?.message);
    }

    // 2. Also persist in Supabase app_settings (guaranteed available across all Vercel Lambdas)
    try {
      const { data: regData } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_users_registry")
        .single();

      let list: TelegramSubscriber[] = Array.isArray(regData?.value) ? regData.value : [];
      const existingIdx = list.findIndex(
        (u) => Number(u.telegram_user_id) === Number(user.id)
      );

      if (existingIdx !== -1) {
        list[existingIdx] = {
          ...list[existingIdx],
          username: user.username || list[existingIdx].username,
          first_name: user.first_name || list[existingIdx].first_name,
          last_name: user.last_name || list[existingIdx].last_name,
          phone: user.phone || list[existingIdx].phone,
          language: user.language || list[existingIdx].language || lang,
          notifications_enabled: true,
          registered_at: user.registered_at || list[existingIdx].registered_at || (user.phone ? now : undefined),
          updated_at: now,
        };
        subscriber = list[existingIdx];
      } else {
        list.push(subscriber);
      }

      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "telegram_users_registry",
          value: list,
          updated_at: now,
        },
        { onConflict: "key" }
      );
    } catch (e: any) {
      console.warn("[TelegramServer] Supabase app_settings upsert notice:", e?.message);
    }
  }

  // 3. Mirror to local file for dev resilience
  try {
    const localList = await readLocalSubscribers();
    const existingIdx = localList.findIndex((u) => u.telegram_user_id === user.id);
    if (existingIdx !== -1) {
      localList[existingIdx] = {
        ...localList[existingIdx],
        username: user.username || localList[existingIdx].username,
        first_name: user.first_name || localList[existingIdx].first_name,
        last_name: user.last_name || localList[existingIdx].last_name,
        phone: user.phone || localList[existingIdx].phone,
        language: user.language || localList[existingIdx].language || lang,
        notifications_enabled: true,
        registered_at: user.registered_at || localList[existingIdx].registered_at || (user.phone ? now : undefined),
        updated_at: now,
      };
      subscriber = localList[existingIdx];
    } else {
      localList.push(subscriber);
    }
    await writeLocalSubscribers(localList);
  } catch {}

  return subscriber;
}

/**
 * Toggle notifications on or off for a user.
 */
export async function setTelegramUserNotifications(
  telegramUserId: number,
  enabled: boolean
): Promise<boolean> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin
        .from("telegram_users")
        .update({
          notifications_enabled: enabled,
          updated_at: now,
        })
        .eq("telegram_user_id", telegramUserId);
    } catch (err: any) {
      console.warn("[TelegramServer] Supabase set notifications error:", err?.message);
    }

    try {
      const { data: regData } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_users_registry")
        .single();

      if (Array.isArray(regData?.value)) {
        const updatedList = (regData.value as TelegramSubscriber[]).map((u) =>
          Number(u.telegram_user_id) === Number(telegramUserId)
            ? { ...u, notifications_enabled: enabled, updated_at: now }
            : u
        );
        await supabaseAdmin.from("app_settings").upsert(
          {
            key: "telegram_users_registry",
            value: updatedList,
            updated_at: now,
          },
          { onConflict: "key" }
        );
      }
    } catch (e: any) {}
  }

  const localList = await readLocalSubscribers();
  const target = localList.find((u) => u.telegram_user_id === telegramUserId);
  if (target) {
    target.notifications_enabled = enabled;
    target.updated_at = now;
  } else {
    localList.push({
      telegram_user_id: telegramUserId,
      language: "uz",
      notifications_enabled: enabled,
      created_at: now,
      updated_at: now,
    });
  }
  await writeLocalSubscribers(localList);
  return true;
}

/**
 * Retrieve a single Telegram subscriber.
 */
export async function getTelegramUser(telegramUserId: number): Promise<TelegramSubscriber | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("telegram_users")
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .single();
      if (!error && data) {
        return data as TelegramSubscriber;
      }
    } catch {}

    try {
      const { data: regData } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_users_registry")
        .single();
      if (Array.isArray(regData?.value)) {
        const found = (regData.value as TelegramSubscriber[]).find(
          (u) => Number(u.telegram_user_id) === Number(telegramUserId)
        );
        if (found) return found;
      }
    } catch {}
  }

  const localList = await readLocalSubscribers();
  return localList.find((u) => u.telegram_user_id === telegramUserId) || null;
}

/**
 * Retrieve all subscribers eligible to receive property notifications.
 */
export async function getEligibleNotificationSubscribers(): Promise<TelegramSubscriber[]> {
  if (isSupabaseConfigured) {
    // 1. Try telegram_users table in Supabase
    try {
      const { data, error } = await supabaseAdmin
        .from("telegram_users")
        .select("*")
        .eq("notifications_enabled", true);
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as TelegramSubscriber[];
      }
    } catch (err: any) {
      console.warn(
        "[TelegramServer] Supabase telegram_users getEligibleNotificationSubscribers notice:",
        err?.message
      );
    }

    // 2. Check Supabase app_settings registry
    try {
      const { data: regData, error: regErr } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_users_registry")
        .single();

      if (!regErr && Array.isArray(regData?.value) && regData.value.length > 0) {
        const eligible = (regData.value as TelegramSubscriber[]).filter(
          (u) => u.notifications_enabled === true
        );
        return eligible;
      }
    } catch (e: any) {
      console.warn("[TelegramServer] Supabase registry check notice:", e?.message);
    }
  }

  const localList = await readLocalSubscribers();
  return localList.filter((u) => u.notifications_enabled === true);
}

/**
 * Check if a notification for property has already been successfully sent to user.
 */
export async function hasNotificationBeenSent(
  propertyId: string,
  telegramUserId: number
): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("telegram_property_notifications")
        .select("id, status")
        .eq("property_id", propertyId)
        .eq("telegram_user_id", telegramUserId)
        .single();
      if (!error && data && data.status === "sent") {
        return true;
      }
    } catch {}

    try {
      const { data: logData } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_notifications_log")
        .single();
      if (Array.isArray(logData?.value)) {
        const match = (logData.value as TelegramPropertyNotificationRecord[]).some(
          (r) =>
            r.property_id === propertyId &&
            Number(r.telegram_user_id) === Number(telegramUserId) &&
            r.status === "sent"
        );
        if (match) return true;
      }
    } catch {}
  }

  const localRecords = await readLocalNotifications();
  return localRecords.some(
    (r) => r.property_id === propertyId && r.telegram_user_id === telegramUserId && r.status === "sent"
  );
}

/**
 * Record the delivery result of a property notification.
 */
export async function recordTelegramNotification(record: {
  property_id: string;
  telegram_user_id: number;
  status: "pending" | "sent" | "failed" | "blocked";
  telegram_message_id?: number;
  error_message?: string;
}): Promise<TelegramPropertyNotificationRecord> {
  const now = new Date().toISOString();
  const entry: TelegramPropertyNotificationRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    property_id: record.property_id,
    telegram_user_id: record.telegram_user_id,
    status: record.status,
    telegram_message_id: record.telegram_message_id,
    error_message: record.error_message,
    sent_at: record.status === "sent" ? now : undefined,
    created_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      await supabaseAdmin.from("telegram_property_notifications").upsert(
        {
          property_id: entry.property_id,
          telegram_user_id: entry.telegram_user_id,
          status: entry.status,
          telegram_message_id: entry.telegram_message_id || null,
          error_message: entry.error_message || null,
          sent_at: entry.sent_at || null,
          created_at: entry.created_at,
        },
        { onConflict: "property_id,telegram_user_id" }
      );
    } catch (err: any) {
      console.warn("[TelegramServer] Supabase record notification error:", err?.message);
    }

    try {
      const { data: logData } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_notifications_log")
        .single();
      let logs: TelegramPropertyNotificationRecord[] = Array.isArray(logData?.value)
        ? logData.value
        : [];
      const idx = logs.findIndex(
        (r) =>
          r.property_id === entry.property_id &&
          Number(r.telegram_user_id) === Number(entry.telegram_user_id)
      );
      if (idx !== -1) {
        logs[idx] = entry;
      } else {
        logs.push(entry);
      }
      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "telegram_notifications_log",
          value: logs,
          updated_at: now,
        },
        { onConflict: "key" }
      );
    } catch (e) {}
  }

  // Local mirror
  const localList = await readLocalNotifications();
  const existingIdx = localList.findIndex(
    (r) => r.property_id === record.property_id && r.telegram_user_id === record.telegram_user_id
  );
  if (existingIdx !== -1) {
    localList[existingIdx] = {
      ...localList[existingIdx],
      ...entry,
    };
  } else {
    localList.push(entry);
  }
  await writeLocalNotifications(localList);

  return entry;
}

/**
 * Get notification statistics for a specific property.
 */
export async function getTelegramNotificationStats(
  propertyId: string,
  channelStatus: "not_published" | "published" | "error" = "not_published",
  channelPostId?: number
): Promise<TelegramPropertyNotificationStats> {
  let records: TelegramPropertyNotificationRecord[] = [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabaseAdmin
        .from("telegram_property_notifications")
        .select("*")
        .eq("property_id", propertyId);
      if (!error && Array.isArray(data) && data.length > 0) {
        records = data as TelegramPropertyNotificationRecord[];
      }
    } catch {}

    if (records.length === 0) {
      try {
        const { data: logData } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "telegram_notifications_log")
          .single();
        if (Array.isArray(logData?.value)) {
          records = (logData.value as TelegramPropertyNotificationRecord[]).filter(
            (r) => r.property_id === propertyId
          );
        }
      } catch {}
    }
  }

  if (records.length === 0) {
    const localList = await readLocalNotifications();
    records = localList.filter((r) => r.property_id === propertyId);
  }

  let sentCount = 0;
  let failedCount = 0;
  let blockedCount = 0;
  let lastSentAt: string | undefined = undefined;

  for (const r of records) {
    if (r.status === "sent") {
      sentCount++;
      if (!lastSentAt || (r.sent_at && r.sent_at > lastSentAt)) {
        lastSentAt = r.sent_at;
      }
    } else if (r.status === "blocked") {
      blockedCount++;
    } else if (r.status === "failed") {
      failedCount++;
    }
  }

  return {
    property_id: propertyId,
    channel_status: channelStatus,
    channel_post_id: channelPostId,
    total_recipients: records.length,
    sent_count: sentCount,
    failed_count: failedCount,
    blocked_count: blockedCount,
    last_sent_at: lastSentAt,
  };
}

/**
 * Send photo with caption and inline keyboard to Telegram chat.
 */
export async function sendTelegramPhoto(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  replyMarkup?: any,
  botToken?: string
): Promise<{ ok: boolean; result?: any; description?: string; error_code?: number }> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        reply_markup: replyMarkup,
      }),
    });

    return await response.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || "Network error" };
  }
}

/**
 * Send direct text message with optional inline keyboard to Telegram chat.
 */
export async function sendTelegramDirectMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  botToken?: string
): Promise<{ ok: boolean; result?: any; description?: string; error_code?: number }> {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_markup: replyMarkup,
      }),
    });

    return await response.json();
  } catch (err: any) {
    return { ok: false, description: err?.message || "Network error" };
  }
}

