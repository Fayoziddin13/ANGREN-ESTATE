"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Sparkles,
  Award,
  Compass,
  MapPin,
  PhoneCall,
  Users,
  ShieldCheck,
  Phone,
  Send,
  ArrowRight,
  UserCheck,
  Instagram,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useLanguage } from "@/context/LanguageContext";
import { useRealtors } from "@/lib/realtorStore";
import { useCMS } from "@/lib/cmsStore";

export default function AboutPage() {
  const { locale, t } = useLanguage();
  const { activeRealtors, isLoaded: isRealtorsLoaded } = useRealtors();
  const { about, isLoaded: isCmsLoaded } = useCMS();

  // Prefer live Supabase CMS text with fallback to dictionary
  const badgeText = (locale === "uz" ? about?.badge_uz : about?.badge_ru) || t.aboutPage.badge;
  const headlineText = (locale === "uz" ? about?.headline_uz : about?.headline_ru) || t.aboutPage.headline;
  const p1Text = (locale === "uz" ? about?.intro_p1_uz : about?.intro_p1_ru) || t.aboutPage.introP1;
  const p2Text = (locale === "uz" ? about?.intro_p2_uz : about?.intro_p2_ru) || t.aboutPage.introP2;
  const p3Text = (locale === "uz" ? about?.intro_p3_uz : about?.intro_p3_ru) || t.aboutPage.introP3;

  const advantages = [
    {
      icon: Sparkles,
      title: (locale === "uz" ? about?.advantages?.[0]?.title_uz : about?.advantages?.[0]?.title_ru) || t.aboutPage.adv1Title,
      desc: (locale === "uz" ? about?.advantages?.[0]?.desc_uz : about?.advantages?.[0]?.desc_ru) || t.aboutPage.adv1Desc,
    },
    {
      icon: Award,
      title: (locale === "uz" ? about?.advantages?.[1]?.title_uz : about?.advantages?.[1]?.title_ru) || t.aboutPage.adv2Title,
      desc: (locale === "uz" ? about?.advantages?.[1]?.desc_uz : about?.advantages?.[1]?.desc_ru) || t.aboutPage.adv2Desc,
    },
    {
      icon: Compass,
      title: (locale === "uz" ? about?.advantages?.[2]?.title_uz : about?.advantages?.[2]?.title_ru) || t.aboutPage.adv3Title,
      desc: (locale === "uz" ? about?.advantages?.[2]?.desc_uz : about?.advantages?.[2]?.desc_ru) || t.aboutPage.adv3Desc,
    },
    {
      icon: MapPin,
      title: (locale === "uz" ? about?.advantages?.[3]?.title_uz : about?.advantages?.[3]?.title_ru) || t.aboutPage.adv4Title,
      desc: (locale === "uz" ? about?.advantages?.[3]?.desc_uz : about?.advantages?.[3]?.desc_ru) || t.aboutPage.adv4Desc,
    },
    {
      icon: PhoneCall,
      title: (locale === "uz" ? about?.advantages?.[4]?.title_uz : about?.advantages?.[4]?.title_ru) || t.aboutPage.adv5Title,
      desc: (locale === "uz" ? about?.advantages?.[4]?.desc_uz : about?.advantages?.[4]?.desc_ru) || t.aboutPage.adv5Desc,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-brand-canvas overflow-x-hidden text-brand-dark">
      {/* 1. Header */}
      <Header />

      <main className="flex-1 pb-16 sm:pb-24">
        {/* 2. Hero Mission Section */}
        <section className="relative overflow-hidden bg-white border-b border-gray-100 py-16 sm:py-24">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className="absolute -top-32 right-0 w-96 h-96 rounded-full bg-brand-light/50 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-emerald-50 blur-2xl" />
          </div>

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-light px-4 py-1.5 text-xs font-extrabold text-brand-primary border border-brand-border/60">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
              <span>{badgeText}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-brand-dark leading-tight">
              {headlineText}
            </h1>

            <div className="max-w-3xl mx-auto space-y-4 text-base sm:text-lg text-gray-600 leading-relaxed font-normal">
              <p>{p1Text}</p>
              <p>{p2Text}</p>
              <p className="font-semibold text-brand-primary text-lg sm:text-xl">
                {p3Text}
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-3.5 text-sm font-bold text-white shadow-card hover:bg-brand-primary-hover hover:shadow-elevated transition-all active:scale-95"
              >
                <span>{t.aboutPage.goToMap}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* 3. Visual Advantages Grid */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
              {t.aboutPage.advantagesTitle}
            </h2>
            <p className="text-sm text-gray-500">
              {t.aboutPage.advantagesSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {advantages.map((adv, idx) => {
              const Icon = adv.icon;
              return (
                <motion.div
                  key={adv.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.06 }}
                  className="rounded-3xl bg-white/90 backdrop-blur-md p-6 border border-gray-100/90 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors mb-4 shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-brand-dark mb-1.5">
                    {adv.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                    {adv.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 4. Experienced Realtors Section */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-4 pb-12">
          <div className="rounded-3xl bg-white/95 backdrop-blur-xl p-6 sm:p-10 border border-gray-100 shadow-elevated">
            <div className="max-w-3xl space-y-3 mb-8">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand-primary">
                <Users className="h-3.5 w-3.5" />
                <span>{t.aboutPage.realtorsSectionTitle}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark">
                {t.aboutPage.realtorsSectionTitle}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                {t.aboutPage.realtorsSectionDesc}
              </p>
            </div>

            {/* Realtor Cards Grid or Empty State */}
            {isRealtorsLoaded && activeRealtors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeRealtors.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col rounded-2xl bg-brand-canvas/70 border border-brand-border/60 p-5 shadow-sm hover:shadow-card transition-all"
                  >
                    <div className="flex items-center gap-3.5 mb-4">
                      <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-brand-light flex items-center justify-center text-brand-primary font-black text-xl shrink-0 shadow-sm border border-brand-border/40">
                        {r.photo_url || r.avatar_url ? (
                          <Image
                            src={r.photo_url || r.avatar_url || ""}
                            alt={r.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <UserCheck className="h-7 w-7 text-brand-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-base text-brand-dark truncate">
                          {r.name}
                        </h3>
                        <p className="text-xs text-brand-primary font-semibold truncate">
                          {locale === "uz" ? r.specialization_uz : r.specialization_ru}
                        </p>
                        <span className="inline-block mt-0.5 rounded-md bg-brand-light/80 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                          {r.experience_years} {t.aboutPage.yearsExp}
                        </span>
                      </div>
                    </div>

                    {(r.bio_uz || r.bio_ru) && (
                      <p className="text-xs text-gray-600 line-clamp-3 mb-4 leading-relaxed">
                        {locale === "uz" ? r.bio_uz : r.bio_ru}
                      </p>
                    )}

                    {(r.location || (r.districts && r.districts.length > 0)) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mb-4">
                        <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span className="truncate">{r.location || r.districts?.join(", ")}</span>
                      </div>
                    )}

                    <div className={`mt-auto grid ${r.instagram_url || r.instagram ? "grid-cols-3" : "grid-cols-2"} gap-2 pt-2 border-t border-gray-100`}>
                      <a
                        href={`tel:${r.phone}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-xs font-bold text-white hover:bg-brand-primary-hover transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{t.aboutPage.callBtn}</span>
                      </a>
                      <a
                        href={r.telegram.startsWith("http") ? r.telegram : `https://t.me/${r.telegram.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-brand-dark hover:bg-gray-50 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5 text-sky-600" />
                        <span>{t.aboutPage.telegramBtn}</span>
                      </a>
                      {(r.instagram_url || r.instagram) && (
                        <a
                          href={r.instagram_url || r.instagram}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50/50 px-2.5 py-2 text-xs font-bold text-pink-700 hover:bg-pink-100 transition-colors"
                          title="Instagram"
                        >
                          <Instagram className="h-3.5 w-3.5 text-pink-600" />
                          <span>Instagram</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* High-end Minimalist Empty State */
              <div className="rounded-2xl border border-dashed border-gray-200 bg-brand-canvas/50 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand-primary shadow-sm">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-brand-dark">
                  {t.aboutPage.emptyRealtorsTitle}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  {t.aboutPage.emptyRealtorsDesc}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-gray-500 border border-gray-200/80 shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                    <span>ANGREN ESTATE Verified Partner Network</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
