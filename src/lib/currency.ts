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
  rate: number = USD_EXCHANGE_RATE
): { primary: string; secondary: string } {
  const isUz = locale === "uz";
  const uzsSuffix = isUz ? "so‘m" : "сум";
  const mlnSuffix = isUz ? "mln" : "млн";
  const activeRate = rate > 0 ? rate : USD_EXCHANGE_RATE;

  if (displayCurrency === "UZS") {
    let primaryText = "";
    if (compact && amountUzs >= 1_000_000) {
      const mln = (amountUzs / 1_000_000).toFixed(1).replace(/\.0$/, "");
      primaryText = `${mln} ${mlnSuffix} ${uzsSuffix}`;
    } else {
      primaryText = `${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;
    }
    const usdEquivalent = uzsToUsd(amountUzs, activeRate);
    const secondaryText = `~$${usdEquivalent.toLocaleString("ru-RU")}`;

    return { primary: primaryText, secondary: secondaryText };
  } else {
    // USD mode
    const usdVal = uzsToUsd(amountUzs, activeRate);
    const primaryText = `$${usdVal.toLocaleString("ru-RU")}`;
    const secondaryText = `~${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;

    return { primary: primaryText, secondary: secondaryText };
  }
}

