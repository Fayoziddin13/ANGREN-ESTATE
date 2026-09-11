"use client";

import React, { useMemo, useState } from "react";
import { Property, PropertyType, TransactionType } from "@/lib/types";
import { PropertyCard } from "./PropertyCard";
import { useLanguage } from "@/context/LanguageContext";
import { Filter } from "lucide-react";

interface PropertyListProps {
  properties: Property[];
  activeTransaction: TransactionType | "all";
  searchQuery: string;
}

export function PropertyList({
  properties,
  activeTransaction,
  searchQuery,
}: PropertyListProps) {
  const { locale, t } = useLanguage();
  const [selectedType, setSelectedType] = useState<PropertyType | "all">("all");

  const propertyTypeOptions: Array<{ key: PropertyType | "all"; label: string }> = [
    { key: "all", label: t.propertyTypes.all },
    { key: "apartment", label: t.propertyTypes.apartment },
    { key: "house_yard", label: t.propertyTypes.house_yard },
    { key: "new_build", label: t.propertyTypes.new_build },
    { key: "land", label: t.propertyTypes.land },
    { key: "commercial", label: t.propertyTypes.commercial },
  ];

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // Transaction Filter
      if (activeTransaction !== "all" && p.transaction_type !== activeTransaction) {
        return false;
      }
      // Type Filter
      if (selectedType !== "all" && p.property_type !== selectedType) {
        return false;
      }
      // Search Query Filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase().trim();
        const matchTitleUz = p.title_uz.toLowerCase().includes(query);
        const matchTitleRu = p.title_ru.toLowerCase().includes(query);
        const matchAddressUz = p.address_uz.toLowerCase().includes(query);
        const matchAddressRu = p.address_ru.toLowerCase().includes(query);
        const matchDistrictUz = p.district_name_uz.toLowerCase().includes(query);
        const matchDistrictRu = p.district_name_ru.toLowerCase().includes(query);

        return (
          matchTitleUz ||
          matchTitleRu ||
          matchAddressUz ||
          matchAddressRu ||
          matchDistrictUz ||
          matchDistrictRu
        );
      }
      return true;
    });
  }, [properties, activeTransaction, selectedType, searchQuery]);

  return (
    <section className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full max-w-full overflow-hidden">
      {/* Category Pills & Found Counter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5 border-b border-brand-border/60 w-full min-w-0">
        
        {/* Horizontal Property Type Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none w-full min-w-0 max-w-full">
          {propertyTypeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedType(opt.key)}
              className={`rounded-2xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedType === opt.key
                  ? "bg-brand-primary text-white shadow-subtle"
                  : "bg-white text-brand-muted hover:text-brand-dark hover:bg-brand-light/50 border border-brand-border/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Found Count Badge */}
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-muted shrink-0">
          <span className="h-2 w-2 rounded-full bg-brand-primary animate-pulse" />
          <span>{t.filters.foundCount(filteredProperties.length)}</span>
        </div>
      </div>

      {/* Grid of Cards */}
      {filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-6">
          {filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-3xl bg-brand-light flex items-center justify-center text-brand-primary mb-3">
            <Filter className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-brand-dark">
            {t.search.noResults}
          </h4>
          <p className="text-xs text-brand-muted mt-1 max-w-xs">
            {locale === "uz"
              ? "Qidiruv parametrlarini yoki filtrlarni o‘zgartirib ko‘ring."
              : "Попробуйте изменить параметры поиска или сбросить фильтры."}
          </p>
          <button
            onClick={() => {
              setSelectedType("all");
            }}
            className="mt-4 rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-white shadow-subtle hover:bg-brand-primary-hover transition-colors"
          >
            {t.filters.reset}
          </button>
        </div>
      )}
    </section>
  );
}
