"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Currency, Locale } from "@/lib/types";
import {
  USD_EXCHANGE_RATE,
  formatPrice as formatPriceLib,
  uzsToUsd as uzsToUsdLib,
  usdToUzs as usdToUzsLib,
} from "@/lib/currency";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  toggleCurrency: () => void;
  exchangeRate: number;
  isLoadingRate: boolean;
  rateSource: string;
  uzsToUsd: (amountUzs: number) => number;
  usdToUzs: (amountUsd: number) => number;
  formatPrice: (
    amountUzs: number,
    locale: Locale,
    compact?: boolean
  ) => { primary: string; secondary: string };
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("UZS");
  const [exchangeRate, setExchangeRate] = useState<number>(USD_EXCHANGE_RATE);
  const [rateSource, setRateSource] = useState<string>("default");
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("angren_estate_currency") as Currency;
    if (saved === "UZS" || saved === "USD") {
      setCurrencyState(saved);
    }

    const savedRate = localStorage.getItem("angren_estate_exchange_rate");
    if (savedRate) {
      const parsed = parseFloat(savedRate);
      if (!isNaN(parsed) && parsed > 5000) {
        setExchangeRate(parsed);
      }
    }

    // Fetch fresh rate from server
    fetch("/api/currency")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && typeof data.rate === "number" && data.rate > 0) {
          setExchangeRate(data.rate);
          setRateSource(data.source || "server");
          localStorage.setItem("angren_estate_exchange_rate", String(data.rate));
        }
      })
      .catch((err) => {
        console.warn("[CurrencyContext] Failed to fetch live currency rate:", err);
      })
      .finally(() => {
        setIsLoadingRate(false);
      });
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("angren_estate_currency", newCurrency);
  };

  const toggleCurrency = () => {
    setCurrency(currency === "UZS" ? "USD" : "UZS");
  };

  const uzsToUsd = useCallback(
    (amountUzs: number) => uzsToUsdLib(amountUzs, exchangeRate),
    [exchangeRate]
  );

  const usdToUzs = useCallback(
    (amountUsd: number) => usdToUzsLib(amountUsd, exchangeRate),
    [exchangeRate]
  );

  const formatPrice = useCallback(
    (amountUzs: number, locale: Locale, compact: boolean = false) =>
      formatPriceLib(amountUzs, locale, currency, compact, exchangeRate),
    [currency, exchangeRate]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        exchangeRate,
        isLoadingRate,
        rateSource,
        uzsToUsd,
        usdToUzs,
        formatPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

