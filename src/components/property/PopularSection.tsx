"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Property } from "@/lib/types";
import { PropertyCard } from "./PropertyCard";
import { useLanguage } from "@/context/LanguageContext";

interface PopularSectionProps {
  properties: Property[];
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
  limit?: number;
  id?: string;
  onViewDetails?: (property: Property) => void;
}

export function PopularSection({
  properties,
  title,
  subtitle,
  viewAllHref = "/sotib-olish",
  limit,
  id = "popular",
  onViewDetails,
}: PopularSectionProps) {
  const { t } = useLanguage();

  const displayProperties = typeof limit === "number" ? properties.slice(0, limit) : properties;

  return (
    <section id={id} className="w-full bg-brand-canvas py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex items-end justify-between pb-6 sm:pb-8">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark">
              {title || t.popular.title}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {subtitle || t.popular.subtitle}
            </p>
          </div>

          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="group flex items-center gap-1.5 text-xs sm:text-sm font-bold text-brand-primary hover:text-brand-primary-hover transition-colors"
            >
              <span>{t.popular.viewAll}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>

        {/* Empty state if 0 properties match */}
        {displayProperties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 sm:p-12 text-center text-gray-500 text-sm">
            {t.search.noResults}
          </div>
        ) : (
          /* 4-Column Responsive Grid on Desktop / 2-col on Mobile (matching reference) */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {displayProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
