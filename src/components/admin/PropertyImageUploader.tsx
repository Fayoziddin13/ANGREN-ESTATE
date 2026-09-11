"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  UploadCloud,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Link2,
  Plus,
  CheckCircle2,
} from "lucide-react";

export interface PropertyImageUploaderProps {
  images: string[];
  mainImage?: string;
  onChangeImages: (images: string[]) => void;
  onChangeMainImage: (mainUrl: string) => void;
  propertyId?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function PropertyImageUploader({
  images = [],
  mainImage,
  onChangeImages,
  onChangeMainImage,
  propertyId = "new",
}: PropertyImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active main image is either the prop or the first image in array
  const activeMain = mainImage || images[0] || "";

  // Show temporary success feedback
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Upload handler
  const handleUploadFiles = async (selectedFiles: FileList | File[]) => {
    setErrorMessage(null);
    const filesArray = Array.from(selectedFiles);

    if (filesArray.length === 0) return;

    // 1. Validate files
    const validFiles: File[] = [];
    for (const f of filesArray) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setErrorMessage(
          `Faqat JPG, PNG yoki WEBP rasmlar qabul qilinadi (${f.name})`
        );
        return;
      }
      if (f.size > MAX_SIZE_BYTES) {
        setErrorMessage(
          `Rasm hajmi ${MAX_SIZE_MB}MB dan oshmasligi lozim (${f.name}: ${(
            f.size /
            (1024 * 1024)
          ).toFixed(1)}MB)`
        );
        return;
      }
      // Check for duplicates by name and size in current selection
      const isDuplicate = validFiles.some(
        (v) => v.name === f.name && v.size === f.size
      );
      if (!isDuplicate) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgressText(
        validFiles.length === 1
          ? "Rasm Supabase Storage ga yuklanmoqda..."
          : `${validFiles.length} ta rasm yuklanmoqda...`
      );

      const formData = new FormData();
      formData.append("propertyId", propertyId);
      for (const file of validFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/admin/properties/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Rasmlarni yuklashda xatolik yuz berdi");
      }

      const newUrls: string[] = (data.images || []).map((img: any) => img.url);
      const combined = [...images, ...newUrls];

      onChangeImages(combined);
      if (!activeMain && combined.length > 0) {
        onChangeMainImage(combined[0]);
      }

      triggerSuccess(
        `${newUrls.length} ta rasm muvaffaqiyatli yuklandi!`
      );
    } catch (err: any) {
      console.error("[PropertyImageUploader] Upload failed:", err);
      setErrorMessage(err?.message || "Rasmni yuklab bo‘lmadi.");
    } finally {
      setIsUploading(false);
      setUploadProgressText("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Remove image
  const handleRemove = async (idx: number) => {
    const targetUrl = images[idx];
    const newImages = images.filter((_, i) => i !== idx);

    // If removing the active main image, set new main
    if (targetUrl === activeMain) {
      onChangeMainImage(newImages[0] || "");
    }
    onChangeImages(newImages);

    // Call server to safely clean up storage object if unreferenced
    if (targetUrl.includes("/property-images/")) {
      fetch("/api/admin/properties/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      }).catch((e) => console.warn("Background storage delete warning:", e));
    }
  };

  // Set as Main Image (and move to index 0 for universal gallery compatibility)
  const handleSetMain = (url: string) => {
    const reordered = [url, ...images.filter((img) => img !== url)];
    onChangeMainImage(url);
    onChangeImages(reordered);
    triggerSuccess("Asosiy rasm belgilandi va birinchi o'ringa surildi");
  };

  // Move left / right
  const handleMove = (idx: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;

    const copy = [...images];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;

    // If position 0 changed, update main image
    if (idx === 0 || targetIdx === 0) {
      onChangeMainImage(copy[0]);
    }
    onChangeImages(copy);
  };

  // Add external URL fallback
  const handleAddExternalUrl = () => {
    if (!fallbackUrl.trim()) return;
    const url = fallbackUrl.trim();
    const updated = [...images, url];
    onChangeImages(updated);
    if (!activeMain) {
      onChangeMainImage(url);
    }
    setFallbackUrl("");
    setShowUrlFallback(false);
    triggerSuccess("Rasm havolasi qo'shildi");
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleUploadFiles(e.target.files);
        }}
      />

      {/* Main Drag-and-Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-[#16543C] bg-emerald-50/60 ring-4 ring-emerald-500/20"
            : "border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-emerald-300"
        } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#16543C]">
            {isUploading ? (
              <Loader2 className="w-7 h-7 animate-spin text-[#16543C]" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800">
              {isUploading
                ? uploadProgressText
                : isDragging
                ? "Rasmlarni shu yerga tashlang"
                : "Rasmlarni yuklash uchun bosing yoki shu yerga tortib keling"}
            </p>
            <p className="text-xs text-slate-500">
              JPG, JPEG, PNG, WEBP formatlar • Har bir rasm maksimal {MAX_SIZE_MB}MB
            </p>
          </div>

          {!isUploading && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16543C] text-white text-xs font-bold shadow-xs hover:bg-[#0E3324] transition-colors">
                <Plus className="w-3.5 h-3.5" />
                <span>Qurilmadan tanlash</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-700 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 text-xs underline font-bold"
          >
            Yopish
          </button>
        </div>
      )}

      {/* Success Toast */}
      {successMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Optional External URL Fallback Link */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span className="font-medium">
          Jami rasmlar:{" "}
          <strong className="text-slate-800">{images.length} ta</strong>
          {images.length > 0 && " (1-rasm asosiy muqova hisoblanadi)"}
        </span>
        <button
          type="button"
          onClick={() => setShowUrlFallback(!showUrlFallback)}
          className="text-[#16543C] hover:underline font-bold flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          <span>{showUrlFallback ? "URL kiritishni yopish" : "URL orqali qo'shish"}</span>
        </button>
      </div>

      {/* Fallback URL Input Box */}
      {showUrlFallback && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex gap-2">
          <input
            type="url"
            value={fallbackUrl}
            onChange={(e) => setFallbackUrl(e.target.value)}
            placeholder="https://images.unsplash.com/... yoki to'g'ridan-to'g'ri URL"
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white"
          />
          <button
            type="button"
            onClick={handleAddExternalUrl}
            className="px-4 py-2 bg-[#16543C] text-white text-xs font-bold rounded-xl hover:bg-[#0E3324]"
          >
            Qo‘shish
          </button>
        </div>
      )}

      {/* Previews & Image Management Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-2">
          {images.map((url, idx) => {
            const isMain = url === activeMain || (idx === 0 && !mainImage);

            return (
              <div
                key={idx}
                className={`relative aspect-[4/3] rounded-2xl overflow-hidden group border transition-all ${
                  isMain
                    ? "border-[#16543C] ring-2 ring-[#16543C] shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <Image
                  src={url}
                  alt={`Obyekt rasmi ${idx + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />

                {/* Main Badge / Indicator */}
                {isMain ? (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#16543C] text-white text-[10px] font-black tracking-wide shadow-md">
                    <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                    <span>Asosiy rasm</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetMain(url)}
                    className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-xl bg-black/60 hover:bg-[#16543C] text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title="Asosiy rasm qilish"
                  >
                    <Star className="w-3 h-3" />
                    <span>Asosiy qilish</span>
                  </button>
                )}

                {/* Action Controls Overlay (Top Right: Delete, Bottom: Move arrows) */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-xl bg-red-600/90 text-white hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Rasmni o'chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sequence & Move Controls */}
                <div className="absolute bottom-2 inset-x-2 z-10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, "left")}
                    className="p-1 rounded-lg bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-all"
                    title="Oldinga surish"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[10px] font-mono font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>

                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => handleMove(idx, "right")}
                    className="p-1 rounded-lg bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-all"
                    title="Keyinga surish"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
