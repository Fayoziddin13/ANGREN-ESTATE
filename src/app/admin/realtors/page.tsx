"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Phone,
  Send,
  Calendar,
  MapPin,
  X,
  Check,
  AlertCircle,
  Search,
  Building2,
  Inbox,
  ExternalLink,
  Unlink,
  RefreshCw,
  Clock,
  Eye,
  Instagram,
  Upload,
  Camera,
  Trash2,
  Power,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useRealtors, formatInstagramUrl } from "@/lib/realtorStore";
import { useProperties } from "@/lib/propertyStore";
import { Realtor, Property } from "@/lib/types";

interface RealtorFormData {
  name: string;
  phone: string;
  telegram: string;
  instagram_url: string;
  experience_years: number;
  specialization_uz: string;
  specialization_ru: string;
  districts_str: string;
  avatar_url: string;
  photo_url: string;
  bio_uz: string;
  bio_ru: string;
  is_active: boolean;
}

const emptyForm: RealtorFormData = {
  name: "",
  phone: "+998 ",
  telegram: "@",
  instagram_url: "",
  experience_years: 3,
  specialization_uz: "",
  specialization_ru: "",
  districts_str: "",
  avatar_url: "",
  photo_url: "",
  bio_uz: "",
  bio_ru: "",
  is_active: true,
};

export default function AdminRealtorsPage() {
  const { locale, t } = useLanguage();
  const {
    realtors,
    isLoaded,
    refresh: refreshRealtors,
    addRealtor,
    updateRealtor,
    toggleRealtorStatus,
    assignProperty,
  } = useRealtors({ adminOnly: true });

  const { properties: allProperties } = useProperties({ adminMode: true });

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRealtorId, setEditingRealtorId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RealtorFormData>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [deactivateConfirmRealtor, setDeactivateConfirmRealtor] = useState<Realtor | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  // Permanent Delete state
  const [permanentDeleteRealtor, setPermanentDeleteRealtor] = useState<Realtor | null>(null);
  const [permanentDeleteConfirmText, setPermanentDeleteConfirmText] = useState("");
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);

  // Assigned Properties Modal state
  const [propertiesModalRealtor, setPropertiesModalRealtor] = useState<Realtor | null>(null);
  const [assignedProperties, setAssignedProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedPropertyToAssign, setSelectedPropertyToAssign] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Attributed Leads Modal state
  const [leadsModalRealtor, setLeadsModalRealtor] = useState<Realtor | null>(null);
  const [attributedLeads, setAttributedLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Create Modal
  const handleOpenAddModal = () => {
    setEditingRealtorId(null);
    setFormData(emptyForm);
    setPhotoUploadError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (realtor: Realtor) => {
    setEditingRealtorId(realtor.id);
    const photo = realtor.photo_url || realtor.avatar_url || "";
    const instagram = realtor.instagram_url || realtor.instagram || "";
    setFormData({
      name: realtor.name,
      phone: realtor.phone,
      telegram: realtor.telegram || "",
      instagram_url: instagram,
      experience_years: realtor.experience_years,
      specialization_uz: realtor.specialization_uz,
      specialization_ru: realtor.specialization_ru,
      districts_str: realtor.location || (realtor.districts || []).join(", "),
      avatar_url: photo,
      photo_url: photo,
      bio_uz: realtor.bio_uz || "",
      bio_ru: realtor.bio_ru || "",
      is_active: realtor.is_active,
    });
    setPhotoUploadError(null);
    setModalOpen(true);
  };

  // Handle Photo File Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError(
        locale === "uz"
          ? "Rasm hajmi 5MB dan oshmasligi lozim"
          : "Размер фото не должен превышать 5МБ"
      );
      return;
    }

    setUploadingPhoto(true);
    setPhotoUploadError(null);

    try {
      const data = new FormData();
      data.append("photo", file);
      if (editingRealtorId) {
        data.append("realtor_id", editingRealtorId);
      }

      const res = await fetch("/api/admin/realtors/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();

      if (res.ok && json.success && json.url) {
        setFormData((prev) => ({
          ...prev,
          photo_url: json.url,
          avatar_url: json.url,
        }));
        showToast(
          locale === "uz" ? "Rieltor fotosi yuklandi" : "Фото риелтора успешно загружено"
        );
      } else {
        setPhotoUploadError(
          json.error || (locale === "uz" ? "Rasm yuklashda xatolik" : "Ошибка загрузки фото")
        );
      }
    } catch (err: any) {
      setPhotoUploadError(err.message || "Rasm yuklab bo'lmadi");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      photo_url: "",
      avatar_url: "",
    }));
  };

  // Save Realtor Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim()) {
      alert(locale === "uz" ? "Ism va telefon raqamini kiriting" : "Укажите имя и телефон");
      return;
    }

    const districtsArray = formData.districts_str
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    const resolvedPhoto = formData.photo_url.trim() || formData.avatar_url.trim() || undefined;

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      telegram: formData.telegram.trim(),
      instagram_url: formData.instagram_url.trim() ? formData.instagram_url.trim() : null,
      experience_years: Number(formData.experience_years) || 1,
      specialization_uz: formData.specialization_uz.trim() || "Ko‘chmas mulk mutaxassisi",
      specialization_ru: formData.specialization_ru.trim() || "Специалист по недвижимости",
      districts: districtsArray.length > 0 ? districtsArray : ["Angren"],
      location: formData.districts_str.trim() || (districtsArray.length > 0 ? districtsArray.join(", ") : "Angren"),
      avatar_url: resolvedPhoto,
      photo_url: resolvedPhoto,
      bio_uz: formData.bio_uz.trim() || undefined,
      bio_ru: formData.bio_ru.trim() || undefined,
      is_active: formData.is_active,
    };

    if (editingRealtorId) {
      const ok = await updateRealtor(editingRealtorId, payload);
      if (ok) {
        showToast(locale === "uz" ? "Rieltor ma'lumotlari yangilandi" : "Данные риелтора обновлены");
        setModalOpen(false);
      } else {
        showToast(locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка");
      }
    } else {
      const created = await addRealtor(payload);
      if (created) {
        showToast(locale === "uz" ? "Yangi rieltor qo‘shildi" : "Новый риелтор успешно добавлен");
        setModalOpen(false);
      } else {
        showToast(locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка");
      }
    }
  };

  // Toggle Realtor Status with Safe Confirmation (NO PHYSICAL DELETE)
  const handleToggleRealtorStatus = async (realtor: Realtor) => {
    if (realtor.is_active) {
      setDeactivateConfirmRealtor(realtor);
      return;
    }
    const ok = await toggleRealtorStatus(realtor.id);
    if (ok) {
      showToast(locale === "uz" ? "Rieltor faollashtirildi (saytda ko‘rsatiladi)" : "Риелтор активирован");
    }
  };

  // Fetch Assigned Properties for a Realtor
  const openPropertiesModal = async (realtor: Realtor) => {
    setPropertiesModalRealtor(realtor);
    setSelectedPropertyToAssign("");
    setLoadingProperties(true);
    try {
      const res = await fetch(`/api/admin/realtors/${realtor.id}/properties`);
      if (res.ok) {
        const data = await res.json();
        setAssignedProperties(data.properties || []);
      }
    } catch (e) {
      console.error("Failed to load assigned properties:", e);
    } finally {
      setLoadingProperties(false);
    }
  };

  // Fetch Attributed Leads for a Realtor
  const openLeadsModal = async (realtor: Realtor) => {
    setLeadsModalRealtor(realtor);
    setLoadingLeads(true);
    try {
      const res = await fetch(`/api/admin/realtors/${realtor.id}/leads`);
      if (res.ok) {
        const data = await res.json();
        setAttributedLeads(data.leads || []);
      }
    } catch (e) {
      console.error("Failed to load realtor leads:", e);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Unassign Property
  const handleUnassignProperty = async (propertyId: string) => {
    if (!propertiesModalRealtor) return;
    setIsAssigning(true);
    const ok = await assignProperty(propertiesModalRealtor.id, propertyId, "unassign");
    if (ok) {
      setAssignedProperties((prev) => prev.filter((p) => p.id !== propertyId));
      showToast(locale === "uz" ? "Obyekt rieltordan chiqarildi" : "Объект откреплён от риелтора");
      await refreshRealtors();
    } else {
      showToast(locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка");
    }
    setIsAssigning(false);
  };

  // Assign Selected Property
  const handleAssignSelectedProperty = async () => {
    if (!propertiesModalRealtor || !selectedPropertyToAssign) return;
    setIsAssigning(true);
    const ok = await assignProperty(propertiesModalRealtor.id, selectedPropertyToAssign, "assign");
    if (ok) {
      showToast(locale === "uz" ? "Obyekt muvaffaqiyatli biriktirildi" : "Объект успешно прикреплён");
      setSelectedPropertyToAssign("");
      // Reload properties list for modal
      const res = await fetch(`/api/admin/realtors/${propertiesModalRealtor.id}/properties`);
      if (res.ok) {
        const data = await res.json();
        setAssignedProperties(data.properties || []);
      }
      await refreshRealtors();
    } else {
      showToast(locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка");
    }
    setIsAssigning(false);
  };

  const filteredRealtors = realtors.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.specialization_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.specialization_ru.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && r.is_active) ||
      (statusFilter === "inactive" && !r.is_active);

    return matchesSearch && matchesStatus;
  });

  const realtorCounts = {
    all: realtors.length,
    active: realtors.filter((r) => r.is_active).length,
    inactive: realtors.filter((r) => !r.is_active).length,
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#167d4f] text-white px-5 py-3 rounded-2xl shadow-xl border border-[#167d4f]/40 flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="h-4 w-4 text-[#2db477]" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.admin.realtors}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {locale === "uz"
              ? "Platformaning barcha rasmiy hamkor rieltorlari ro‘yxati va boshqaruvi."
              : "Список и управление официальными риелторами-партнёрами платформы."}
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#167d4f] text-white hover:bg-[#167d4f] font-bold text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{t.admin.addRealtor}</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            statusFilter === "all"
              ? "bg-[#167d4f] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>{locale === "uz" ? "Barchasi" : "Все"}</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {realtorCounts.all}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter("active")}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            statusFilter === "active"
              ? "bg-[#167d4f] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>{locale === "uz" ? "Faol rieltorlar" : "Активные"}</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === "active" ? "bg-white/20 text-white" : "bg-[#eaf5f0] text-[#167d4f]"
            }`}
          >
            {realtorCounts.active}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter("inactive")}
          className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
            statusFilter === "inactive"
              ? "bg-[#167d4f] text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>{locale === "uz" ? "Nofaol" : "Неактивные"}</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === "inactive" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {realtorCounts.inactive}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              locale === "uz"
                ? "Ism yoki mutaxassislik bo‘yicha qidirish..."
                : "Поиск по имени или специализации..."
            }
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#167d4f] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Realtors Grid or Empty State */}
      {!isLoaded ? (
        <div className="text-center py-16 text-slate-600 font-medium text-sm flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-[#167d4f]" />
          <span>{locale === "uz" ? "Yuklanmoqda..." : "Загрузка..."}</span>
        </div>
      ) : filteredRealtors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-[#eaf5f0]/60 text-[#167d4f] flex items-center justify-center mx-auto">
            <Users className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {locale === "uz"
                ? "Hozircha hech qanday rieltor topilmadi"
                : "Риелторы не найдены"}
            </h3>
            <p className="text-xs text-slate-500">
              {locale === "uz"
                ? "Yangi rieltor qo‘shish tugmasini bosing yoki qidiruv parametrlarini o‘zgartiring."
                : "Нажмите «Добавить риелтора» или измените параметры поиска."}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#167d4f] text-white hover:bg-[#167d4f] font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.admin.addRealtor}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRealtors.map((realtor) => {
            const spec = locale === "uz" ? realtor.specialization_uz : realtor.specialization_ru;
            const bio = locale === "uz" ? realtor.bio_uz : realtor.bio_ru;
            const propCount = realtor.properties_count ?? 0;
            const leadCount = realtor.leads_count ?? 0;

            return (
              <div
                key={realtor.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                  realtor.is_active ? "border-slate-200" : "border-slate-200/80 bg-slate-50/50 opacity-90"
                }`}
              >
                <div className="space-y-3">
                  {/* Top: Avatar, Name, Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-sm">
                        {realtor.photo_url || realtor.avatar_url ? (
                          <Image
                            src={realtor.photo_url || realtor.avatar_url || ""}
                            alt={realtor.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-[#eaf5f0]/60 text-[#167d4f] font-extrabold text-base">
                            {realtor.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {realtor.name}
                          </h4>
                          {!realtor.is_active ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              {locale === "uz" ? "Nofaol" : "Неактивен"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#eaf5f0] text-[#167d4f] border border-[#bdd1c8]">
                              {locale === "uz" ? "Faol" : "Активен"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#167d4f] font-semibold">{spec}</p>
                      </div>
                    </div>

                    {/* Status Pill Toggle */}
                    <button
                      onClick={() => handleToggleRealtorStatus(realtor)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        realtor.is_active
                          ? "bg-[#eaf5f0] text-[#167d4f] hover:bg-[#bdd1c8] border border-[#bdd1c8]"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300"
                      }`}
                      title={locale === "uz" ? "Holatni o‘zgartirish (Faol / Nofaol)" : "Сменить статус (Активен / Неактивен)"}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          realtor.is_active ? "bg-[#167d4f]" : "bg-slate-500"
                        }`}
                      />
                      <span>{realtor.is_active ? t.admin.statusActive : t.admin.statusHidden}</span>
                    </button>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate font-medium">{realtor.phone}</span>
                    </div>
                    {realtor.telegram && (
                      <div className="flex items-center gap-1.5">
                        <Send className="h-3.5 w-3.5 text-[#2AABEE] shrink-0" />
                        <span className="truncate font-medium">{realtor.telegram}</span>
                      </div>
                    )}
                    {formatInstagramUrl(realtor.instagram_url || realtor.instagram) && (
                      <div className="flex items-center gap-1.5">
                        <Instagram className="h-3.5 w-3.5 text-pink-600 shrink-0" />
                        <a
                          href={formatInstagramUrl(realtor.instagram_url || realtor.instagram)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-pink-600 font-semibold hover:underline"
                        >
                          Instagram
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span>
                        {realtor.experience_years}{" "}
                        {locale === "uz" ? "yil tajriba" : "лет опыта"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate font-medium">{realtor.location || (realtor.districts || []).join(", ")}</span>
                    </div>
                  </div>

                  {/* Dynamic Statistics Bar: Properties & Leads */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openPropertiesModal(realtor)}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#eaf5f0]/60/70 hover:bg-[#eaf5f0] border border-[#bdd1c8] text-left transition-colors group"
                      title={locale === "uz" ? "Biriktirilgan obyektlarni ko‘rish" : "Посмотреть прикреплённые объекты"}
                    >
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                        <Building2 className="h-3.5 w-3.5 text-[#167d4f]" />
                        <span>{locale === "uz" ? "Obyektlar:" : "Объекты:"}</span>
                      </div>
                      <span className="font-extrabold text-xs text-[#167d4f] group-hover:underline">
                        {propCount} {locale === "uz" ? "ta" : "шт"}
                      </span>
                    </button>

                    <button
                      onClick={() => openLeadsModal(realtor)}
                      className="flex items-center justify-between p-2 rounded-xl bg-sky-50/70 hover:bg-sky-100 border border-sky-200 text-left transition-colors group"
                      title={locale === "uz" ? "Rieltordan kelgan lidlarni ko‘rish" : "Посмотреть лиды риелтора"}
                    >
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                        <Inbox className="h-3.5 w-3.5 text-sky-600" />
                        <span>{locale === "uz" ? "Murojaatlar:" : "Лиды:"}</span>
                      </div>
                      <span className="font-extrabold text-xs text-sky-700 group-hover:underline">
                        {leadCount} {locale === "uz" ? "ta" : "шт"}
                      </span>
                    </button>
                  </div>

                  {/* Bio */}
                  {bio && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 italic font-medium">
                      "{bio}"
                    </p>
                  )}
                </div>

                {/* Bottom Card Actions: Responsive on Mobile */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {realtor.id.slice(0, 8)}...
                  </span>

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                    <button
                      onClick={() => handleToggleRealtorStatus(realtor)}
                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        realtor.is_active
                          ? "text-amber-800 bg-amber-100/80 hover:bg-amber-200 border border-amber-300"
                          : "text-[#167d4f] bg-[#eaf5f0]/80 hover:bg-[#bdd1c8] border border-[#bdd1c8]"
                      }`}
                      title={
                        realtor.is_active
                          ? (locale === "uz" ? "Rieltorni nofaol qilish (saytdan yashirish)" : "Деактивировать риелтора")
                          : (locale === "uz" ? "Rieltorni qayta faollashtirish" : "Активировать риелтора")
                      }
                    >
                      <Power className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {realtor.is_active
                          ? (locale === "uz" ? "Nofaol qilish" : "Деактивировать")
                          : (locale === "uz" ? "Faollashtirish" : "Активировать")}
                      </span>
                    </button>

                    <button
                      onClick={() => openPropertiesModal(realtor)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                      title={locale === "uz" ? "Obyektlarni boshqarish" : "Управление объектами"}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{locale === "uz" ? "Obyektlar" : "Объекты"}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(realtor)}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold text-[#167d4f] bg-[#eaf5f0]/80 hover:bg-[#bdd1c8] border border-[#bdd1c8] transition-colors"
                      title={t.admin.editRealtor}
                    >
                      <Edit2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{locale === "uz" ? "Tahrirlash" : "Редактировать"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setPermanentDeleteConfirmText("");
                        setPermanentDeleteRealtor(realtor);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                      title={locale === "uz" ? "To'liq o'chirish (qaytarib bo'lmaydi)" : "Удалить навсегда (необратимо)"}
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{locale === "uz" ? "O'chirish" : "Удалить"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ASSIGNED PROPERTIES MANAGEMENT                   */}
      {/* ========================================================= */}
      {propertiesModalRealtor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#167d4f]" />
                  <span>
                    {locale === "uz" ? "Biriktirilgan obyektlar" : "Прикреплённые объекты"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {propertiesModalRealtor.name} ({propertiesModalRealtor.phone})
                </p>
              </div>
              <button
                onClick={() => setPropertiesModalRealtor(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Assign Section */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="text-xs font-bold text-slate-800 block">
                {locale === "uz"
                  ? "+ Ushbu rieltorga yangi obyekt biriktirish:"
                  : "+ Прикрепить новый объект к этому риелтору:"}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedPropertyToAssign}
                  onChange={(e) => setSelectedPropertyToAssign(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-[#167d4f] outline-none"
                >
                  <option value="">
                    {locale === "uz" ? "-- Obyektni tanlang --" : "-- Выберите объект --"}
                  </option>
                  {allProperties
                    .filter((p) => p.realtor_id !== propertiesModalRealtor.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title_uz || p.title_ru} ({p.district_name_uz || p.district}) - $
                        {(p.price_usd || 0).toLocaleString()}
                        {p.realtor_id ? " [Boshqa rieltorda]" : " [Rieltorsiz]"}
                      </option>
                    ))}
                </select>
                <button
                  disabled={!selectedPropertyToAssign || isAssigning}
                  onClick={handleAssignSelectedProperty}
                  className="px-4 py-2 rounded-xl bg-[#167d4f] text-white text-xs font-bold hover:bg-[#167d4f] disabled:opacity-50 transition-colors shrink-0"
                >
                  {isAssigning ? "..." : locale === "uz" ? "Biriktirish" : "Прикрепить"}
                </button>
              </div>
            </div>

            {/* Assigned Properties List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase text-slate-600 tracking-wider">
                  {locale === "uz"
                    ? `Mavjud obyektlar (${assignedProperties.length})`
                    : `Текущие объекты (${assignedProperties.length})`}
                </h4>
              </div>

              {loadingProperties ? (
                <div className="py-8 text-center text-xs text-slate-600 font-medium flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#167d4f]" />
                  <span>{locale === "uz" ? "Yuklanmoqda..." : "Загрузка..."}</span>
                </div>
              ) : assignedProperties.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {locale === "uz"
                    ? "Ushbu rieltorga hozircha hech qanday obyekt biriktirilmagan."
                    : "К этому риелтору пока не прикреплено ни одного объекта."}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {assignedProperties.map((prop) => (
                    <div
                      key={prop.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          {prop.main_image || (prop.images && prop.images[0]) ? (
                            <Image
                              src={prop.main_image || prop.images[0]}
                              alt={prop.title_uz || "Property"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                              <Building2 className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate">
                            {locale === "uz" ? prop.title_uz : prop.title_ru}
                          </h5>
                          <p className="text-[11px] text-slate-500 truncate">
                            {prop.district_name_uz || prop.district}, {prop.address_uz || prop.address_ru}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="font-extrabold text-[#167d4f]">
                              ${(prop.price_usd || 0).toLocaleString()}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                prop.status === "published"
                                  ? "bg-[#eaf5f0] text-[#167d4f]"
                                  : prop.status === "draft"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {prop.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/properties/${prop.slug || prop.id}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title={locale === "uz" ? "Saytda ko‘rish" : "Открыть на сайте"}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>

                        <Link
                          href={`/admin/properties/${prop.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title={locale === "uz" ? "Tahrirlash" : "Редактировать"}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>

                        <button
                          onClick={() => handleUnassignProperty(prop.id)}
                          disabled={isAssigning}
                          className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          title={locale === "uz" ? "Biriktirishdan chiqarish" : "Открепить"}
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPropertiesModalRealtor(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {locale === "uz" ? "Yopish" : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ATTRIBUTED LEADS INSPECTION                     */}
      {/* ========================================================= */}
      {leadsModalRealtor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-sky-600" />
                  <span>
                    {locale === "uz" ? "Rieltorga biriktirilgan lidlar" : "Лиды риелтора"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {leadsModalRealtor.name} • {locale === "uz" ? "Tijorat hisoboti" : "Коммерческий отчёт"}
                </p>
              </div>
              <button
                onClick={() => setLeadsModalRealtor(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Leads List */}
            {loadingLeads ? (
              <div className="py-12 text-center text-xs text-slate-600 font-medium flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
                <span>{locale === "uz" ? "Yuklanmoqda..." : "Загрузка..."}</span>
              </div>
            ) : attributedLeads.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {locale === "uz"
                  ? "Ushbu rieltorga hozircha hech qanday murojaat kelib tushmagan."
                  : "По этому риелтору пока не зафиксировано обращений."}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {attributedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            lead.contact_type === "telegram"
                              ? "bg-sky-100 text-sky-800"
                              : lead.contact_type === "call"
                              ? "bg-[#eaf5f0] text-[#167d4f]"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {lead.contact_type}
                        </span>
                        <span className="font-bold text-slate-900">
                          {lead.name || lead.phone || lead.telegram || "Anonim murojaat"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          lead.status === "new"
                            ? "bg-amber-100 text-amber-800"
                            : lead.status === "contacted"
                            ? "bg-blue-100 text-blue-800"
                            : lead.status === "closed"
                            ? "bg-[#eaf5f0] text-[#167d4f]"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </div>

                    {lead.property_title && (
                      <p className="text-[11px] text-slate-600 font-medium">
                        {locale === "uz" ? "Obyekt:" : "Объект:"} {lead.property_title}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                      <span>ID: {lead.id.slice(0, 8)}...</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(lead.created_at).toLocaleDateString()} {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/admin/leads"
                className="text-xs font-bold text-[#167d4f] hover:underline flex items-center gap-1"
              >
                <span>{locale === "uz" ? "Barcha lidlar bo‘limiga o‘tish" : "Перейти ко всем лидам"}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setLeadsModalRealtor(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {locale === "uz" ? "Yopish" : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD / EDIT REALTOR                               */}
      {/* ========================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {editingRealtorId ? t.admin.editRealtor : t.admin.addRealtor}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  {t.admin.realtorName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masalan: Nodir Aliyev"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] focus:border-transparent outline-none"
                />
              </div>

              {/* Phone, Telegram & Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorPhone} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorTelegram}
                  </label>
                  <input
                    type="text"
                    value={formData.telegram}
                    onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                    placeholder="@username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorInstagram || "Instagram"}
                  </label>
                  <input
                    type="text"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="@username yoki URL"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Experience & Districts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorExp}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.experience_years}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        experience_years: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorDistricts}
                  </label>
                  <input
                    type="text"
                    value={formData.districts_str}
                    onChange={(e) => setFormData({ ...formData, districts_str: e.target.value })}
                    placeholder="Markaz, 1/1, 2/3, 5/1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Specialization UZ & RU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorSpecUz}
                  </label>
                  <input
                    type="text"
                    value={formData.specialization_uz}
                    onChange={(e) =>
                      setFormData({ ...formData, specialization_uz: e.target.value })
                    }
                    placeholder="Kvartiralar va hovlilar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {t.admin.realtorSpecRu}
                  </label>
                  <input
                    type="text"
                    value={formData.specialization_ru}
                    onChange={(e) =>
                      setFormData({ ...formData, specialization_ru: e.target.value })
                    }
                    placeholder="Квартиры и частные дома"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Photo Upload & Preview */}
              <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-[#167d4f]" />
                    {locale === "uz" ? "Rieltor fotosurati" : "Фотография риелтора"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    JPEG, PNG, WEBP (max 5MB)
                  </span>
                </label>

                {photoUploadError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{photoUploadError}</span>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {formData.photo_url || formData.avatar_url ? (
                    <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-slate-200 border-2 border-[#167d4f] shrink-0 shadow-sm">
                      <Image
                        src={formData.photo_url || formData.avatar_url}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-[#eaf5f0]/60 border-2 border-dashed border-[#bdd1c8] flex items-center justify-center text-[#167d4f] shrink-0 font-bold text-lg">
                      {formData.name ? formData.name.charAt(0).toUpperCase() : <Camera className="h-6 w-6 text-[#167d4f]" />}
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#167d4f] hover:bg-[#167d4f] text-white text-xs font-bold transition-colors shadow-sm">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {uploadingPhoto
                            ? (locale === "uz" ? "Yuklanmoqda..." : "Загрузка...")
                            : formData.photo_url || formData.avatar_url
                            ? (locale === "uz" ? "Almashtirish" : "Заменить")
                            : (locale === "uz" ? "Rasm yuklash" : "Загрузить фото")}
                        </span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          disabled={uploadingPhoto}
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>

                      {(formData.photo_url || formData.avatar_url) && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 text-xs font-bold transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{locale === "uz" ? "O‘chirish" : "Удалить"}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {locale === "uz"
                        ? "Saytda va bosh sahifada ushbu fotosurat aks etadi."
                        : "Это фото будет отображаться на сайте и главной странице."}
                    </p>
                  </div>
                </div>

                {/* Direct photo URL fallback input */}
                <div className="pt-2 border-t border-slate-200/80">
                  <input
                    type="url"
                    value={formData.photo_url || formData.avatar_url}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        photo_url: e.target.value,
                        avatar_url: e.target.value,
                      })
                    }
                    placeholder={locale === "uz" ? "Yoki rasm URL havolasini kiriting (https://...)" : "Или вставьте прямую ссылку на фото (https://...)"}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#167d4f] outline-none"
                  />
                </div>
              </div>

              {/* Instagram URL */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  <span>Instagram profili</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/realtor_angren yoki @username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {locale === "uz"
                    ? "Rieltor kartasida rasmiy Instagram sahifasiga havola ko‘rsatiladi."
                    : "Ссылка на Instagram будет отображаться в профиле риелтора на сайте."}
                </p>
              </div>

              {/* Bio UZ & RU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Tavsif (UZ)" : "Описание (UZ)"}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.bio_uz}
                    onChange={(e) => setFormData({ ...formData, bio_uz: e.target.value })}
                    placeholder="Angren shahri bo‘yicha tajribali mutaxassis..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {locale === "uz" ? "Tavsif (RU)" : "Описание (RU)"}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.bio_ru}
                    onChange={(e) => setFormData({ ...formData, bio_ru: e.target.value })}
                    placeholder="Опытный специалист по городу Ангрен..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#167d4f] outline-none resize-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="realtor_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-[#167d4f] rounded border-slate-300 focus:ring-[#167d4f]"
                />
                <label htmlFor="realtor_active" className="font-semibold text-slate-700">
                  {locale === "uz"
                    ? "Saytda ko‘rsatilsin (Faol)"
                    : "Отображать на сайте (Активен)"}
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  {locale === "uz" ? "Bekor qilish" : "Отмена"}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#167d4f] hover:bg-[#167d4f] text-white font-bold transition-colors shadow-sm"
                >
                  {locale === "uz" ? "Saqlash" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Realtor Confirmation Modal */}
      {deactivateConfirmRealtor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Power className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {locale === "uz" ? "Rieltorni nofaol qilish" : "Деактивировать риелтора"}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  {deactivateConfirmRealtor.name}
                </p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-amber-900">
                {locale === "uz"
                  ? `«${deactivateConfirmRealtor.name}» saytdan yashiriladi`
                  : `Риелтор «${deactivateConfirmRealtor.name}» будет скрыт с сайта`}
              </p>
              <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                {locale === "uz"
                  ? "Rieltor jamoat sahifalaridan (Kontaktlar, Biz haqimizda) yashiriladi. Unga biriktirilgan barcha obyektlar va arizalar tarixi bazada xavfsiz saqlanadi. Istalgan vaqtda uni yana qayta faollashtirishingiz mumkin."
                  : "Риелтор перестанет отображаться на публичных страницах. Все прикрепленные к нему объекты недвижимости и лиды сохранятся в базе данных. Вы сможете вернуть его в любой момент."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeactivating}
                onClick={() => setDeactivateConfirmRealtor(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={isDeactivating}
                onClick={async () => {
                  setIsDeactivating(true);
                  try {
                    const ok = await toggleRealtorStatus(deactivateConfirmRealtor.id);
                    if (ok) {
                      showToast(
                        locale === "uz"
                          ? "Rieltor nofaol qilindi (saytdan yashirildi)"
                          : "Риелтор скрыт с сайта"
                      );
                      setDeactivateConfirmRealtor(null);
                    }
                  } finally {
                    setIsDeactivating(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Power className="h-3.5 w-3.5" />
                <span>
                  {isDeactivating
                    ? locale === "uz" ? "Saqlanmoqda..." : "Сохранение..."
                    : locale === "uz" ? "Ha, nofaol qilish" : "Да, деактивировать"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Realtor Confirmation Modal */}
      {permanentDeleteRealtor && (
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
                <p className="text-[11px] text-slate-500 font-bold">
                  {permanentDeleteRealtor.name}
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-black text-rose-900">
                {locale === "uz" ? "⚠️ Bu amalni bekor qilib bo'lmaydi!" : "⚠️ Это действие необратимо!"}
              </p>
              <ul className="text-[11px] text-rose-800 space-y-1 font-medium">
                <li>✗ {locale === "uz" ? "Rieltor bazadan butunlay o'chiriladi" : "Риелтор будет полностью удалён из базы"}</li>
                <li>✗ {locale === "uz" ? "Unga biriktirilgan arizalardagi ma'lumot NULL bo'ladi" : "В связанных заявках realtor_id станет NULL"}</li>
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
                  setPermanentDeleteRealtor(null);
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
                  if (!permanentDeleteRealtor) return;
                  setIsPermanentDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/realtors/${permanentDeleteRealtor.id}`, {
                      method: "DELETE",
                    });
                    const json = await res.json();
                    if (res.ok && json.success) {
                      showToast(
                        locale === "uz"
                          ? `«${permanentDeleteRealtor.name}» to'liq o'chirildi`
                          : `«${permanentDeleteRealtor.name}» удалён навсегда`
                      );
                      setPermanentDeleteRealtor(null);
                      setPermanentDeleteConfirmText("");
                      refreshRealtors();
                    } else {
                      showToast(json.error || (locale === "uz" ? "O'chirishda xatolik" : "Ошибка удаления"));
                    }
                  } catch {
                    showToast(locale === "uz" ? "Tarmoq xatoligi" : "Ошибка сети");
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
