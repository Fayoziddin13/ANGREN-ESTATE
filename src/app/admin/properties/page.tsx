"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  Plus,
  Search,
  Filter,
  Copy,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  MoreVertical,
  ArrowUpDown,
  Tag,
  MapPin,
  Calendar,
  AlertCircle,
  Archive,
  Check,
  RotateCcw,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperties } from "@/lib/propertyStore";
import { Property, PropertyStatus } from "@/lib/types";
import {
  getPropertyTypeLabel,
  getDealTypeLabel,
  getPropertyStatusLabel,
  getPropertyDistrict,
  getPropertyAddress,
  formatRooms,
} from "@/lib/propertyFormatters";

export default function AdminPropertiesPage() {
  const { locale } = useLanguage();
  const {
    properties,
    isLoaded,
    duplicateProperty,
    updatePropertyStatus,
    deleteProperty,
  } = useProperties();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<string>("all");
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [archiveConfirmProperty, setArchiveConfirmProperty] = useState<Property | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  // Permanent Delete state
  const [permanentDeleteProperty, setPermanentDeleteProperty] = useState<Property | null>(null);
  const [permanentDeleteConfirmText, setPermanentDeleteConfirmText] = useState("");
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDuplicate = async (id: string) => {
    setActionMenuOpenId(null);
    const dup = await duplicateProperty(id);
    if (dup) {
      showToast(locale === "uz" ? "Obyektdan nusxa yaratildi (Qoralama)" : "Создана копия объекта (Черновик)");
    }
  };

  const handleStatusChange = async (id: string, newStatus: PropertyStatus) => {
    setActionMenuOpenId(null);
    await updatePropertyStatus(id, newStatus);
    const label = getPropertyStatusLabel(newStatus, locale);
    showToast(locale === "uz" ? `Status yangilandi: ${label}` : `Статус изменен: ${label}`);
  };

  // Filtered properties
  const filtered = properties.filter((p) => {
    const matchSearch =
      p.title_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title_ru.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.district_name_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = selectedStatus === "all" || p.status === selectedStatus;
    const matchType = selectedType === "all" || p.property_type === selectedType;
    const matchTx = selectedTransaction === "all" || p.transaction_type === selectedTransaction;

    return matchSearch && matchStatus && matchType && matchTx;
  });

  const statusCounts = {
    all: properties.length,
    published: properties.filter((p) => p.status === "published").length,
    draft: properties.filter((p) => p.status === "draft").length,
    sold: properties.filter((p) => p.status === "sold").length,
    rented: properties.filter((p) => p.status === "rented").length,
    archived: properties.filter((p) => p.status === "archived").length,
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0E3324] text-white px-5 py-3 rounded-2xl shadow-xl border border-emerald-500/40 flex items-center gap-2.5 animate-bounce text-xs font-bold">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {locale === "uz" ? "Ko‘chmas mulk obyektlari" : "Управление объектами"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {locale === "uz"
              ? "Barcha e'lonlar holatini boshqarish, tahrirlash, dublikat qilish va tahlil."
              : "Полный контроль над базой объектов недвижимости города Ангрен."}
          </p>
        </div>

        <Link
          href="/admin/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16543C] text-white hover:bg-[#0E3324] font-bold text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{locale === "uz" ? "Yangi obyekt qo‘shish" : "Добавить объект"}</span>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
        {(
          [
            { key: "all", label: locale === "uz" ? "Barchasi" : "Все", count: statusCounts.all },
            { key: "published", label: locale === "uz" ? "Faol" : "Опубликовано", count: statusCounts.published },
            { key: "draft", label: locale === "uz" ? "Qoralamalar" : "Черновики", count: statusCounts.draft },
            { key: "sold", label: locale === "uz" ? "Sotilgan" : "Продано", count: statusCounts.sold },
            { key: "rented", label: locale === "uz" ? "Ijarada" : "Сдано", count: statusCounts.rented },
            { key: "archived", label: locale === "uz" ? "Arxiv" : "В архиве", count: statusCounts.archived },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedStatus(tab.key)}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              selectedStatus === tab.key
                ? "bg-[#16543C] text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                selectedStatus === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Secondary Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search */}
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === "uz" ? "Nomi, manzili, tumani yoki ID bo‘yicha qidirish..." : "Поиск по названию, адресу, району или ID..."}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none"
          />
        </div>

        {/* Type Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none font-medium text-slate-700"
          >
            <option value="all">{locale === "uz" ? "Barcha turlar" : "Все типы"}</option>
            <option value="apartment">{locale === "uz" ? "Kvartira" : "Квартира"}</option>
            <option value="house_yard">{locale === "uz" ? "Hovli / Kottej" : "Дом / Участок"}</option>
            <option value="new_build">{locale === "uz" ? "Yangi bino" : "Новостройка"}</option>
            <option value="commercial">{locale === "uz" ? "Tijorat" : "Коммерция"}</option>
            <option value="land">{locale === "uz" ? "Yer" : "Земля"}</option>
          </select>
        </div>

        {/* Transaction Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedTransaction}
            onChange={(e) => setSelectedTransaction(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#16543C] outline-none font-medium text-slate-700"
          >
            <option value="all">{locale === "uz" ? "Barcha bitimlar" : "Все сделки"}</option>
            <option value="sale">{locale === "uz" ? "Sotuv" : "Продажа"}</option>
            <option value="rent">{locale === "uz" ? "Ijara" : "Аренда"}</option>
          </select>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{locale === "uz" ? "Obyekt" : "Объект"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Turi & Bitim" : "Тип и сделка"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Narxi" : "Цена"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Holati" : "Статус"}</th>
                <th className="py-3.5 px-4 text-center">{locale === "uz" ? "Ko‘rishlar" : "Просмотры"}</th>
                <th className="py-3.5 px-4 text-center">{locale === "uz" ? "Aloqalar" : "Контакты"}</th>
                <th className="py-3.5 px-4">{locale === "uz" ? "Sana" : "Дата"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "uz" ? "Amallar" : "Действия"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    {locale === "uz" ? "Hech qanday obyekt topilmadi" : "Объекты не найдены"}
                  </td>
                </tr>
              ) : (
                filtered.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Object Details & Photo */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {prop.images[0] ? (
                            <Image
                              src={prop.images[0]}
                              alt={prop.title_uz}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-400 m-auto mt-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <h4 className="font-bold text-slate-900 truncate">
                            {locale === "uz" ? prop.title_uz : (prop.title_ru || prop.title_uz)}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {getPropertyDistrict(prop, locale)}, {getPropertyAddress(prop, locale)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Type & Tx */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {getPropertyTypeLabel(prop.property_type, locale)}
                        </span>
                        <div className="text-[11px] font-bold text-slate-600">
                          {prop.transaction_type === "sale" ? (
                            <span className="text-emerald-800">{getDealTypeLabel("sale", locale)}</span>
                          ) : (
                            <span className="text-blue-800">{getDealTypeLabel("rent", locale)}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                      {prop.price_usd ? (
                        <>
                          <div>${prop.price_usd.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {(prop.price_uzs / 1000000).toFixed(0)} mln UZS
                          </div>
                        </>
                      ) : (
                        <div>{(prop.price_uzs / 1000000).toFixed(0)} mln UZS</div>
                      )}
                    </td>

                    {/* Interactive Quick Status Selector */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="relative inline-flex items-center">
                        {updatingStatusId === prop.id ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-600 animate-pulse">
                            <span className="h-3 w-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                            <span>{locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."}</span>
                          </span>
                        ) : (
                          <select
                            value={prop.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as PropertyStatus;
                              if (newStatus === prop.status) return;
                              setUpdatingStatusId(prop.id);
                              try {
                                const ok = await updatePropertyStatus(prop.id, newStatus);
                                if (ok) {
                                  const label = getPropertyStatusLabel(newStatus, locale);
                                  showToast(
                                    locale === "uz"
                                      ? `Status yangilandi: ${label}`
                                      : `Статус обновлен: ${label}`
                                  );
                                } else {
                                  showToast(
                                    locale === "uz"
                                      ? "Statusni yangilashda xatolik"
                                      : "Ошибка обновления статуса"
                                  );
                                }
                              } finally {
                                setUpdatingStatusId(null);
                              }
                            }}
                            className={`cursor-pointer appearance-none pl-6 pr-6 py-1 rounded-full text-[11px] font-extrabold border shadow-xs transition-all outline-none focus:ring-2 focus:ring-[#16543C] ${
                              prop.status === "published"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                : prop.status === "draft"
                                ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                : prop.status === "sold"
                                ? "bg-red-50 text-red-800 border-red-300 hover:bg-red-100"
                                : prop.status === "rented"
                                ? "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100"
                                : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                            }`}
                          >
                            <option value="published" className="bg-white text-emerald-800 font-bold">
                              ● {locale === "uz" ? "Nashr qilingan" : "Опубликовано"}
                            </option>
                            <option value="draft" className="bg-white text-amber-800 font-bold">
                              ● {locale === "uz" ? "Qoralama" : "Черновик"}
                            </option>
                            <option value="sold" className="bg-white text-red-800 font-bold">
                              ● {locale === "uz" ? "Sotilgan" : "Продано"}
                            </option>
                            <option value="rented" className="bg-white text-blue-800 font-bold">
                              ● {locale === "uz" ? "Ijaraga berildi" : "Арендовано"}
                            </option>
                            <option value="archived" className="bg-white text-slate-700 font-bold">
                              ● {locale === "uz" ? "Arxivlangan" : "В архиве"}
                            </option>
                          </select>
                        )}
                        {updatingStatusId !== prop.id && (
                          <span
                            className={`absolute left-2.5 h-1.5 w-1.5 rounded-full pointer-events-none ${
                              prop.status === "published"
                                ? "bg-emerald-600"
                                : prop.status === "draft"
                                ? "bg-amber-600"
                                : prop.status === "sold"
                                ? "bg-red-600"
                                : prop.status === "rented"
                                ? "bg-blue-600"
                                : "bg-slate-600"
                            }`}
                          />
                        )}
                      </div>
                    </td>

                    {/* Views & Favs */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                      {prop.views_count || 0}
                    </td>

                    {/* Contact Clicks */}
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                      {prop.contacts_count || 0}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-[11px] text-slate-600 font-medium whitespace-nowrap">
                      {new Date(prop.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-right relative">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewProperty(prop)}
                          title={locale === "uz" ? "Ko‘rish" : "Просмотр"}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/properties/${prop.id}`}
                          title={locale === "uz" ? "Tahrirlash" : "Редактировать"}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(prop.id)}
                          title={locale === "uz" ? "Nusxa ko‘chirish (Dublikat)" : "Дублировать"}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {prop.status === "archived" ? (
                          <button
                            onClick={() => handleStatusChange(prop.id, "published")}
                            title={locale === "uz" ? "Qayta nashr qilish (Faollashtirish)" : "Опубликовать снова"}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setArchiveConfirmProperty(prop)}
                            title={locale === "uz" ? "Arxivga o'tkazish (Olib tashlash)" : "В архив (Удалить)"}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActionMenuOpenId(null);
                            setPermanentDeleteConfirmText("");
                            setPermanentDeleteProperty(prop);
                          }}
                          title={locale === "uz" ? "To'liq o'chirish (qaytarib bo'lmaydi)" : "Удалить навсегда (необратимо)"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setActionMenuOpenId(actionMenuOpenId === prop.id ? null : prop.id)
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Dropdown Action Popover */}
                      {actionMenuOpenId === prop.id && (
                        <div className="absolute right-4 mt-2 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-30 text-left space-y-0.5">
                          <Link
                            href={`/admin/properties/${prop.id}`}
                            className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>{locale === "uz" ? "Tahrirlash" : "Редактировать"}</span>
                          </Link>
                          <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-500">
                            {locale === "uz" ? "Statusni o‘zgartirish" : "Изменить статус"}
                          </div>
                          {prop.status !== "published" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "published")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-emerald-50 text-emerald-800 text-xs font-bold"
                            >
                              ✓ {locale === "uz" ? "Nashr qilish" : "Опубликовать"}
                            </button>
                          )}
                          {prop.status !== "draft" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "draft")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium"
                            >
                              {locale === "uz" ? "Qoralamaga o‘tkazish" : "В черновик"}
                            </button>
                          )}
                          {prop.status !== "sold" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "sold")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-red-50 text-red-700 text-xs font-medium"
                            >
                              {locale === "uz" ? "Sotildi deb belgilash" : "Отметить как продано"}
                            </button>
                          )}
                          {prop.status !== "rented" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "rented")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-blue-50 text-blue-700 text-xs font-medium"
                            >
                              {locale === "uz" ? "Ijaraga berildi" : "Сдано в аренду"}
                            </button>
                          )}
                          {prop.status !== "archived" ? (
                            <button
                              onClick={() => {
                                setActionMenuOpenId(null);
                                setArchiveConfirmProperty(prop);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-1.5 border-t border-slate-100 mt-1"
                            >
                              <Archive className="h-3.5 w-3.5 text-amber-600" />
                              <span>{locale === "uz" ? "Arxivga o‘tkazish" : "В архив"}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(prop.id, "published")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 border-t border-slate-100 mt-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{locale === "uz" ? "Qayta nashr qilish" : "Опубликовать снова"}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Property Quick Preview Modal */}
      {previewProperty && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">
                {locale === "uz" ? previewProperty.title_uz : previewProperty.title_ru}
              </h3>
              <button
                onClick={() => setPreviewProperty(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="relative h-56 rounded-2xl overflow-hidden bg-slate-100">
              {previewProperty.images[0] && (
                <Image
                  src={previewProperty.images[0]}
                  alt="Cover"
                  fill
                  className="object-cover"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Narx:" : "Цена:"}</span>
                <div className="font-black text-slate-900 text-sm">
                  ${previewProperty.price_usd?.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-bold">{locale === "uz" ? "Maydon:" : "Площадь:"}</span>
                <div className="font-black text-slate-900 text-sm">
                  {previewProperty.area_sqm} m² ({formatRooms(previewProperty.rooms || 3, locale)})
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {locale === "uz" ? previewProperty.description_uz : previewProperty.description_ru}
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setPreviewProperty(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                {locale === "uz" ? "Yopish" : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Archive Confirmation Modal */}
      {archiveConfirmProperty && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Archive className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {locale === "uz" ? "Obyektni arxivga o'tkazish" : "Архивировать объект"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  ID: {archiveConfirmProperty.id}
                </p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-amber-900 line-clamp-1">
                {locale === "uz" ? archiveConfirmProperty.title_uz : archiveConfirmProperty.title_ru}
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                {locale === "uz"
                  ? "Ushbu obyekt arxivlanadi va ommaviy sayt (xarita, katalog, qidiruv)dan darhol yashiriladi. Barcha parametrlar, fotosuratlar va statistika bazada saqlanadi. Istalgan vaqtda uni «Arxiv» bo'limidan qayta nashr qilishingiz mumkin."
                  : "Объект будет перемещен в архив и скрыт из публичного доступа (карты, каталога, поиска). Все данные, фотографии и статистика сохранятся в базе. Вы сможете в любой момент восстановить его из раздела «В архиве»."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isArchiving}
                onClick={() => setArchiveConfirmProperty(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={isArchiving}
                onClick={async () => {
                  setIsArchiving(true);
                  try {
                    await handleStatusChange(archiveConfirmProperty.id, "archived");
                    setArchiveConfirmProperty(null);
                  } finally {
                    setIsArchiving(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>
                  {isArchiving
                    ? locale === "uz" ? "Arxivlanmoqda..." : "Архивация..."
                    : locale === "uz" ? "Ha, arxivlash" : "Да, в архив"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {permanentDeleteProperty && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-rose-900 text-base">
                  {locale === "uz" ? "To'liq o'chirish — qaytarib bo'lmaydi!" : "Удалить навсегда — необратимо!"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold line-clamp-1">
                  {locale === "uz" ? permanentDeleteProperty.title_uz : permanentDeleteProperty.title_ru}
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-black text-rose-900">
                {locale === "uz" ? "⚠️ Bu amalni bekor qilib bo'lmaydi!" : "⚠️ Это действие необратимо!"}
              </p>
              <ul className="text-[11px] text-rose-800 space-y-1 font-medium">
                <li>✗ {locale === "uz" ? "Barcha ma'lumotlar bazadan o'chiriladi" : "Все данные будут удалены из базы"}</li>
                <li>✗ {locale === "uz" ? "Rasmlar Storage'dan ham o'chiriladi" : "Фотографии будут удалены из Storage"}</li>
                <li>✗ {locale === "uz" ? "Bu amalni bekor qilish MUMKIN EMAS" : "Отмена действия НЕВОЗМОЖНА"}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {locale === "uz"
                  ? "Tasdiqlash uchun «O'CHIRAMAN» yozing:"
                  : "Для подтверждения напишите «УДАЛИТЬ»:"}
              </label>
              <input
                type="text"
                value={permanentDeleteConfirmText}
                onChange={(e) => setPermanentDeleteConfirmText(e.target.value)}
                placeholder={locale === "uz" ? "O'CHIRAMAN" : "УДАЛИТЬ"}
                className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50/30 text-xs font-bold text-rose-900 placeholder:text-rose-300 focus:outline-none focus:border-rose-500 transition-all"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isPermanentDeleting}
                onClick={() => {
                  setPermanentDeleteProperty(null);
                  setPermanentDeleteConfirmText("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={
                  isPermanentDeleting ||
                  (locale === "uz"
                    ? permanentDeleteConfirmText.trim() !== "O'CHIRAMAN"
                    : permanentDeleteConfirmText.trim().toUpperCase() !== "УДАЛИТЬ")
                }
                onClick={async () => {
                  if (!permanentDeleteProperty) return;
                  setIsPermanentDeleting(true);
                  try {
                    const ok = await deleteProperty(permanentDeleteProperty.id);
                    if (ok) {
                      showToast(
                        locale === "uz"
                          ? `«${permanentDeleteProperty.title_uz}» to'liq o'chirildi`
                          : `«${permanentDeleteProperty.title_ru}» удалён навсегда`
                      );
                      setPermanentDeleteProperty(null);
                      setPermanentDeleteConfirmText("");
                    } else {
                      showToast(locale === "uz" ? "O'chirishda xatolik yuz berdi" : "Ошибка при удалении");
                    }
                  } finally {
                    setIsPermanentDeleting(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isPermanentDeleting
                    ? locale === "uz" ? "O'chirilmoqda..." : "Удаление..."
                    : locale === "uz" ? "To'liq o'chirish" : "Удалить навсегда"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
