import { Currency, Locale } from "./types";

export const USD_EXCHANGE_RATE = 12800; // 1 USD = 12,800 UZS (default base rate)

export function uzsToUsd(amountUzs: number, rate: number = USD_EXCHANGE_RATE): number {
  const activeRate = rate > 0 ? rate : USD_EXCHANGE_RATE;
  return Math.round(amountUzs / activeRate);
}

export function usdToUzs(amountUsd: number, rate: number = USD_EXCHANGE_RATE): number {
  const activeRate = rate > 0 ? rate : USD_EXCHANGE_RATE;
  return Math.round(amountUsd * activeRate);
}

export function formatPrice(
  amountUzs: number,
  locale: Locale,
  displayCurrency: Currency = "UZS",
  compact: boolean = false,
  rate: number = USD_EXCHANGE_RATE,
  exactPriceUsd?: number,
  isNegotiable?: boolean,
  bargainAllowed?: boolean
): { primary: string; secondary: string; hasBargain: boolean; bargainBadge: string } {
  const isUz = locale === "uz";
  const hasBargain = Boolean(bargainAllowed);
  const bargainBadge = isUz ? "Savdolashish mumkin" : "Торг уместен";

  if (isNegotiable || (!amountUzs && (!exactPriceUsd || exactPriceUsd <= 0))) {
    return {
      primary: isUz ? "Narxi kelishiladi" : "Цена договорная",
      secondary: "",
      hasBargain,
      bargainBadge,
    };
  }

  const uzsSuffix = isUz ? "so‘m" : "сум";
  const mlnSuffix = isUz ? "mln" : "млн";
  const activeRate = rate > 0 ? rate : USD_EXCHANGE_RATE;

  // Single source of truth: if exactPriceUsd is given, use it directly without dynamic recalculation
  const usdVal =
    exactPriceUsd !== undefined && exactPriceUsd > 0
      ? exactPriceUsd
      : uzsToUsd(amountUzs, activeRate);
  const formattedUsd = usdVal.toLocaleString("en-US");

  if (displayCurrency === "UZS") {
    let primaryText = "";
    if (compact && amountUzs >= 1_000_000) {
      const mln = (amountUzs / 1_000_000).toFixed(1).replace(/\.0$/, "");
      primaryText = `${mln} ${mlnSuffix} ${uzsSuffix}`;
    } else {
      primaryText = `${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;
    }
    const secondaryText = `~$${formattedUsd}`;

    return { primary: primaryText, secondary: secondaryText, hasBargain, bargainBadge };
  } else {
    // USD mode
    const primaryText = `$${formattedUsd}`;
    const secondaryText = `~${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;

    return { primary: primaryText, secondary: secondaryText, hasBargain, bargainBadge };
  }
}

/**
 * Universal property price formatter.
 * Ensures that if a property has a stored price_usd, it is strictly used as the Single Source of Truth
 * across all public pages (never recalculated via price_uzs / exchangeRate).
 */
export function formatPropertyPrice({
  priceUzs,
  priceUsd,
  currency,
  locale,
  isSale = true,
  exchangeRate = USD_EXCHANGE_RATE,
  isNegotiable = false,
  bargainAllowed = false,
}: {
  priceUzs: number;
  priceUsd?: number;
  currency: Currency;
  locale: Locale;
  isSale?: boolean;
  exchangeRate?: number;
  isNegotiable?: boolean;
  bargainAllowed?: boolean;
}): {
  priceDisplay: string;
  secondaryPrice: string;
  hasBargain: boolean;
  bargainBadge: string;
} {
  const isUz = locale === "uz";
  const hasBargain = Boolean(bargainAllowed);
  const bargainBadge = isUz ? "Savdolashish mumkin" : "Торг уместен";

  if (isNegotiable || (!priceUzs && (!priceUsd || priceUsd <= 0))) {
    return {
      priceDisplay: isUz ? "Narxi kelishiladi" : "Цена договорная",
      secondaryPrice: "",
      hasBargain,
      bargainBadge,
    };
  }

  const uzsSuffix = isUz ? "so‘m" : "сум";
  const monthSuffix = isSale ? "" : ` / ${isUz ? "oy" : "мес"}`;
  const activeRate = exchangeRate > 0 ? exchangeRate : USD_EXCHANGE_RATE;

  const usdAmount =
    priceUsd !== undefined && priceUsd > 0
      ? priceUsd
      : uzsToUsd(priceUzs, activeRate);
  const formattedUsd = usdAmount.toLocaleString("en-US");

  if (currency === "USD") {
    const priceDisplay = `$${formattedUsd}${monthSuffix}`;
    const secondaryPrice = `≈ ${priceUzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`;
    return { priceDisplay, secondaryPrice, hasBargain, bargainBadge };
  } else {
    const priceDisplay = `${priceUzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`;
    const secondaryPrice = `≈ $${formattedUsd}${monthSuffix}`;
    return { priceDisplay, secondaryPrice, hasBargain, bargainBadge };
  }
}

