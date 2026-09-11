import { Currency, Locale } from "./types";

export const USD_EXCHANGE_RATE = 12800; // 1 USD = 12,800 UZS (default base rate)

export function uzsToUsd(amountUzs: number): number {
  return Math.round(amountUzs / USD_EXCHANGE_RATE);
}

export function usdToUzs(amountUsd: number): number {
  return amountUsd * USD_EXCHANGE_RATE;
}

export function formatPrice(
  amountUzs: number,
  locale: Locale,
  displayCurrency: Currency = "UZS",
  compact: boolean = false
): { primary: string; secondary: string } {
  const isUz = locale === "uz";
  const uzsSuffix = isUz ? "so‘m" : "сум";
  const mlnSuffix = isUz ? "mln" : "млн";

  if (displayCurrency === "UZS") {
    let primaryText = "";
    if (compact && amountUzs >= 1_000_000) {
      const mln = (amountUzs / 1_000_000).toFixed(1).replace(/\.0$/, "");
      primaryText = `${mln} ${mlnSuffix} ${uzsSuffix}`;
    } else {
      primaryText = `${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;
    }
    const usdEquivalent = uzsToUsd(amountUzs);
    const secondaryText = `~$${usdEquivalent.toLocaleString("ru-RU")}`;

    return { primary: primaryText, secondary: secondaryText };
  } else {
    // USD mode
    const usdVal = uzsToUsd(amountUzs);
    const primaryText = `$${usdVal.toLocaleString("ru-RU")}`;
    const secondaryText = `~${amountUzs.toLocaleString("ru-RU")} ${uzsSuffix}`;

    return { primary: primaryText, secondary: secondaryText };
  }
}
