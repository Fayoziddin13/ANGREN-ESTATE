"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { Property } from "@/lib/types";
import { PropertyCard } from "./PropertyCard";
import { useLanguage } from "@/context/LanguageContext";

interface PopularSectionProps {
  properties: Property[];
}

export function PopularSection({ properties }: PopularSectionProps) {
  const { t } = useLanguage();

  return (
    <section id="popular" className="w-full bg-brand-canvas py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex items-end justify-between pb-6 sm:pb-8">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark">
              {t.popular.title}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {t.popular.subtitle}
            </p>
          </div>

          <a
            href="#popular"
            className="group flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-primary hover:text-brand-primary-hover transition-colors"
          >
            <span>{t.popular.viewAll}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        {/* 4-Column Responsive Grid on Desktop / 2-col on Mobile (matching reference) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {properties.slice(0, 4).map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>

      </div>
    </section>
  );
}
