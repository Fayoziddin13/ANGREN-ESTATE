"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Currency } from "@/lib/types";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  toggleCurrency: () => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("UZS");

  useEffect(() => {
    const saved = localStorage.getItem("angren_estate_currency") as Currency;
    if (saved === "UZS" || saved === "USD") {
      setCurrencyState(saved);
    }
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("angren_estate_currency", newCurrency);
  };

  const toggleCurrency = () => {
    setCurrency(currency === "UZS" ? "USD" : "UZS");
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, toggleCurrency }}>
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
