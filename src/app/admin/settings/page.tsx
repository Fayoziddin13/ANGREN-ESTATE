"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  CheckCircle2,
  Phone,
  Send,
  Mail,
  Instagram,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  MapPin,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Globe,
  Sliders,
  DollarSign,
  Layers,
  ShieldAlert,
  Clock,
  Laptop,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteSettings, defaultSiteSettings } from "@/lib/siteSettingsStore";
import { SiteSettingsData } from "@/lib/types";

export default function AdminSettingsPage() {
  const { locale } = useLanguage();
  const { settings, updateSettings, isLoaded } = useSiteSettings();

  const [formData, setFormData] = useState<SiteSettingsData>(defaultSiteSettings);
  const [activeTab, setActiveTab] = useState<"general" | "map" | "contacts" | "security">("general");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) {
      setFormData(settings);
    }
  }, [settings, isLoaded]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: formData }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateSettings(formData);
        showToast(
          locale === "uz"
            ? "Sozlamalar muvaffaqiyatli saqlandi"
            : "Настройки успешно сохранены"
        );
      } else {
        showToast(data.message || (locale === "uz" ? "Xatolik yuz berdi" : "Ошибка сохранения"));
      }
    } catch {
      showToast(locale === "uz" ? "Server bilan aloqa uzildi" : "Сбой связи с сервером");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordLoading(true);

    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Xatolik yuz berdi");
      } else {
        setPasswordSuccess(data.message || "Parol muvaffaqiyatli yangilandi");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showToast(locale === "uz" ? "Parol yangilandi" : "Пароль обновлен");
      }
    } catch {
      setPasswordError("Server bilan ulanishda xatolik yuz berdi");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 sm:top-6 right-4 sm:right-6 z-50 bg-[#16543C] border border-emerald-600 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-[#16543C] shrink-0" />
            <span>{locale === "uz" ? "Platforma Sozlamalari" : "Настройки Платформы"}</span>
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1 font-medium">
            {locale === "uz"
              ? "Xarita parametrlari, kontaktlar, valyuta va admin xavfsizlik sozlamalari"
              : "Параметры карты, контакты, валюта и безопасность администратора"}
          </p>
        </div>

        {activeTab !== "security" && (
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-[#16543C] hover:bg-[#0E3324] text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span>
              {isSaving
                ? locale === "uz"
                  ? "Saqlanmoqda..."
                  : "Сохранение..."
                : locale === "uz"
                ? "Sozlamalarni saqlash"
                : "Сохранить настройки"}
            </span>
          </button>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-3 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-bold no-scrollbar">
        <button
          onClick={() => setActiveTab("general")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "general"
              ? "border-[#16543C] text-[#16543C]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-4 h-4" />
          {locale === "uz" ? "Asosiy Sozlamalar" : "Основные настройки"}
        </button>

        <button
          onClick={() => setActiveTab("map")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "map"
              ? "border-[#16543C] text-[#16543C]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <MapPin className="w-4 h-4" />
          {locale === "uz" ? "Xarita Konfiguratsiyasi" : "Конфигурация карты"}
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "contacts"
              ? "border-[#16543C] text-[#16543C]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Phone className="w-4 h-4" />
          {locale === "uz" ? "Aloqa & Ijtimoiy Tarmoqlar" : "Контакты и соцсети"}
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === "security"
              ? "border-[#16543C] text-[#16543C]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          {locale === "uz" ? "Xavfsizlik & Parol" : "Безопасность и пароль"}
        </button>
      </div>

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#16543C]" />
              {locale === "uz" ? "Umumiy Platforma Parametrlari" : "Общие параметры платформы"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Sayt Nomi" : "Название сайта"}
                </label>
                <input
                  type="text"
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Asosiy Shahar" : "Основной город"}
                </label>
                <input
                  type="text"
                  value={formData.default_city}
                  onChange={(e) => setFormData({ ...formData, default_city: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Boshlang‘ich Valyuta" : "Основная валюта"}
                </label>
                <select
                  value={formData.default_currency}
                  onChange={(e) => setFormData({ ...formData, default_currency: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                >
                  <option value="UZS">{locale === "uz" ? "UZS — O‘zbekiston so‘mi" : "UZS — Узбекский сум"}</option>
                  <option value="USD">{locale === "uz" ? "USD — AQSH dollari" : "USD — Доллар США"}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Boshlang‘ich Til" : "Язык по умолчанию"}
                </label>
                <select
                  value={formData.default_language}
                  onChange={(e) => setFormData({ ...formData, default_language: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                >
                  <option value="uz">O‘zbekcha (Lotin)</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: MAP DEFAULTS */}
      {activeTab === "map" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#16543C]" />
              {locale === "uz" ? "Xarita Boshlang‘ich Holati" : "Начальное состояние карты"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Markaz Latitude (Kenglik)" : "Широта центра (Latitude)"}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.map_center_lat}
                  onChange={(e) => setFormData({ ...formData, map_center_lat: parseFloat(e.target.value) || 41.012277 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Markaz Longitude (Uzunlik)" : "Долгота центра (Longitude)"}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.map_center_lng}
                  onChange={(e) => setFormData({ ...formData, map_center_lng: parseFloat(e.target.value) || 70.085182 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Boshlang‘ich Zoom (Kattalashtirish)" : "Начальный масштаб (Zoom)"}
                </label>
                <input
                  type="number"
                  min={10}
                  max={18}
                  value={formData.map_default_zoom}
                  onChange={(e) => setFormData({ ...formData, map_default_zoom: parseInt(e.target.value) || 13 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {locale === "uz" ? "Boshlang‘ich Xarita Qatlami" : "Слой карты по умолчанию"}
              </label>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, map_default_style: "standard" })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    formData.map_default_style === "standard"
                      ? "bg-emerald-50 border-emerald-500 text-slate-900 ring-1 ring-emerald-500 shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">{locale === "uz" ? "Sxema (Standard)" : "Схема (Стандарт)"}</div>
                  <div className="text-xs text-slate-600 mt-1">{locale === "uz" ? "Toza, ko‘chalar va binolar aniq chizilgan" : "Четкие улицы, здания и ориентиры"}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, map_default_style: "satellite" })}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    formData.map_default_style === "satellite"
                      ? "bg-emerald-50 border-emerald-500 text-slate-900 ring-1 ring-emerald-500 shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">{locale === "uz" ? "Sun’iy yo‘ldosh (Satellite)" : "Спутник (Satellite)"}</div>
                  <div className="text-xs text-slate-600 mt-1">{locale === "uz" ? "Real aerofotosurat va kosmik tasvirlar" : "Реальные спутниковые снимки"}</div>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: CONTACTS */}
      {activeTab === "contacts" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#16543C]" />
              {locale === "uz" ? "Aloqa Ma’lumotlari va Tarmoqlar" : "Контактные данные и соцсети"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Aloqa Telefoni" : "Контактный телефон"}
                </label>
                <input
                  type="text"
                  value={formData.admin_phone}
                  onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Telegram Akkaunt / Bot" : "Telegram аккаунт или бот"}
                </label>
                <input
                  type="text"
                  value={formData.admin_telegram}
                  onChange={(e) => setFormData({ ...formData, admin_telegram: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Elektron Pochta (Email)" : "Электронная почта (Email)"}
                </label>
                <input
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: SECURITY & ADMIN PASSWORD */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Security Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#16543C]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-600 font-medium">{locale === "uz" ? "Sessiya Turi" : "Тип сессии"}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">HttpOnly + SHA-256</div>
                </div>
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{locale === "uz" ? "XSS va script o‘g‘irlashdan himoyalangan" : "Защищено от XSS и атак"}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-600 font-medium">{locale === "uz" ? "Brute-Force Himoyasi" : "Защита от подбора"}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{locale === "uz" ? "5 urinish / 15 daqiqa" : "5 попыток / 15 минут"}</div>
                </div>
              </div>
              <div className="text-xs text-blue-700 font-medium mt-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{locale === "uz" ? "Rate limiting avtomatik bloklash faol" : "Автоматическая защита активна"}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-600 font-medium">{locale === "uz" ? "Sessiya Muddati" : "Время сессии"}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{locale === "uz" ? "8 soat (30 kun 'Eslab qolish')" : "8 часов (30 дней с 'Запомнить')"}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 font-medium mt-3">
                {locale === "uz" ? "Avtomatik muddati tugaydi" : "Автоматическое завершение"}
              </div>
            </div>
          </div>

          {/* Change Admin Password Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#16543C]" />
                {locale === "uz" ? "Admin Parolini O‘zgartirish" : "Смена пароля администратора"}
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {locale === "uz"
                  ? "Admin login hisobi: admin@angrenestate.uz"
                  : "Учетная запись администратора: admin@angrenestate.uz"}
              </p>
            </div>

            {passwordError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#16543C]" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Joriy Parol" : "Текущий пароль"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-4 pr-11 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Yangi Parol" : "Новый пароль"}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {locale === "uz" ? "Yangi Parolni Qayta Kiriting" : "Повторите новый пароль"}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-[#16543C] focus:ring-1 focus:ring-[#16543C]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-3 px-5 bg-[#16543C] hover:bg-[#0E3324] disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {passwordLoading
                    ? locale === "uz"
                      ? "Tekshirilmoqda..."
                      : "Проверка..."
                    : locale === "uz"
                    ? "Parolni Yangilash"
                    : "Обновить пароль"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
