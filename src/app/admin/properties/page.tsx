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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperties } from "@/lib/propertyStore";
import { Property, PropertyStatus } from "@/lib/types";

export default function AdminPropertiesPage() {
  const { locale } = useLanguage();
  const {
    properties,
    isLoaded,
    duplicateProperty,
    updatePropertyStatus,
  } = useProperties();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<string>("all");
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

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
    showToast(locale === "uz" ? `Status yangilandi: ${newStatus}` : `Статус изменен: ${newStatus}`);
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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
                            {locale === "uz" ? prop.title_uz : prop.title_ru}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span>{prop.district_name_uz}, {prop.address_uz}</span>
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Type & Tx */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {prop.property_type}
                        </span>
                        <div className="text-[11px] font-bold text-slate-500">
                          {prop.transaction_type === "sale" ? (
                            <span className="text-emerald-700">Sotuv</span>
                          ) : (
                            <span className="text-blue-700">Ijara</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                      {prop.price_usd ? (
                        <>
                          <div>${prop.price_usd.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
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
                                  showToast(
                                    locale === "uz"
                                      ? `Status yangilandi: ${newStatus}`
                                      : `Статус обновлен: ${newStatus}`
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
                    <td className="py-3.5 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(prop.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-right relative">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewProperty(prop)}
                          title={locale === "uz" ? "Ko‘rish" : "Просмотр"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/properties/${prop.id}`}
                          title={locale === "uz" ? "Tahrirlash" : "Редактировать"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(prop.id)}
                          title={locale === "uz" ? "Nusxa ko‘chirish (Dublikat)" : "Дублировать"}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setActionMenuOpenId(actionMenuOpenId === prop.id ? null : prop.id)
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Dropdown Action Popover */}
                      {actionMenuOpenId === prop.id && (
                        <div className="absolute right-4 mt-2 w-44 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-30 text-left space-y-0.5">
                          <Link
                            href={`/admin/properties/${prop.id}`}
                            className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>{locale === "uz" ? "Tahrirlash" : "Редактировать"}</span>
                          </Link>
                          <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                            Statusni o‘zgartirish
                          </div>
                          {prop.status !== "published" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "published")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-emerald-50 text-emerald-800 text-xs font-bold"
                            >
                              ✓ Nashr qilish (Publish)
                            </button>
                          )}
                          {prop.status !== "draft" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "draft")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium"
                            >
                              Qoralamaga o‘tkazish
                            </button>
                          )}
                          {prop.status !== "sold" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "sold")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-red-50 text-red-700 text-xs font-medium"
                            >
                              Sotildi deb belgilash
                            </button>
                          )}
                          {prop.status !== "rented" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "rented")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-blue-50 text-blue-700 text-xs font-medium"
                            >
                              Ijaraga berildi
                            </button>
                          )}
                          {prop.status !== "archived" && (
                            <button
                              onClick={() => handleStatusChange(prop.id, "archived")}
                              className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 text-xs font-medium"
                            >
                              Arxivlash
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
                <span className="text-slate-400">Narx:</span>
                <div className="font-black text-slate-900 text-sm">
                  ${previewProperty.price_usd?.toLocaleString()}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400">Maydon:</span>
                <div className="font-black text-slate-900 text-sm">
                  {previewProperty.area_sqm} m² ({previewProperty.rooms || 3} xona)
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
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
