"use client";

import React from "react";
import { ShieldCheck, Handshake, MapPin, Headphones } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function TrustSection() {
  const { t } = useLanguage();

  const trustItems = [
    {
      icon: ShieldCheck,
      title: t.trust.item1Title,
      desc: t.trust.item1Desc,
    },
    {
      icon: Handshake,
      title: t.trust.item2Title,
      desc: t.trust.item2Desc,
    },
    {
      icon: MapPin,
      title: t.trust.item3Title,
      desc: t.trust.item3Desc,
    },
    {
      icon: Headphones,
      title: t.trust.item4Title,
      desc: t.trust.item4Desc,
    },
  ];

  return (
    <section id="trust" className="w-full bg-white py-6 sm:py-10 border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-4 gap-2 sm:gap-8">
          {trustItems.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div key={idx} className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-3.5 group">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-primary group-hover:scale-105 transition-transform shadow-sm">
                  <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <h3 className="text-[10px] sm:text-base font-bold text-brand-dark leading-tight">
                    {item.title}
                  </h3>
                  <p className="hidden sm:block text-xs text-gray-500 leading-relaxed max-w-[200px] sm:max-w-none">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
