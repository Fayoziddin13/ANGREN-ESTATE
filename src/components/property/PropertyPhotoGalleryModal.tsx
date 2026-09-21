"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

interface PropertyPhotoGalleryModalProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function PropertyPhotoGalleryModal({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  title,
}: PropertyPhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const validImages = images && images.length > 0 ? images : ["/placeholder.jpg"];
  const total = validImages.length;

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Desktop keyboard controls: ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Lock background scroll while gallery is open
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Mobile swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;

    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handlePrev(); // swipe right -> previous photo
      } else {
        handleNext(); // swipe left -> next photo
      }
    }
    setTouchStartX(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="property-photo-gallery-modal"
    >
      {/* Top Header Row: Counter, Title, Close Button */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-mono font-black tracking-wider text-white border border-white/10 shadow-sm">
            {currentIndex + 1} / {total}
          </span>
          {title && (
            <span className="text-xs sm:text-sm font-semibold text-white/80 truncate max-w-[200px] sm:max-w-md hidden xs:inline">
              {title}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all border border-white/10 cursor-pointer"
          aria-label="Close Gallery"
          data-testid="gallery-close-button"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Main Image Viewing Stage */}
      <div className="relative flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        {/* Desktop Prev Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="hidden sm:flex absolute left-4 sm:left-6 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95 border border-white/15 cursor-pointer"
            aria-label="Previous Photo"
            data-testid="gallery-prev-button"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* 3:4 Vertical Aspect Ratio Container (No distortion, object-contain inside) */}
        <div className="relative h-full max-h-[75vh] sm:max-h-[82vh] w-full max-w-2xl flex items-center justify-center">
          <div className="relative w-full h-full aspect-[3/4] max-h-full max-w-full rounded-2xl overflow-hidden shadow-2xl">
            <Image
              src={validImages[currentIndex]}
              alt={title || `Photo ${currentIndex + 1}`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 80vw"
              className="object-contain"
            />
          </div>
        </div>

        {/* Desktop Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="hidden sm:flex absolute right-4 sm:right-6 z-20 h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95 border border-white/15 cursor-pointer"
            aria-label="Next Photo"
            data-testid="gallery-next-button"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {total > 1 && (
        <div className="px-4 sm:px-6 py-3 z-20 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-4xl mx-auto py-1 no-scrollbar">
            {validImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative h-12 w-9 sm:h-14 sm:w-11 shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  currentIndex === idx
                    ? "border-[#2db477] ring-2 ring-[#2db477]/50 scale-105"
                    : "border-transparent opacity-50 hover:opacity-100"
                }`}
              >
                <Image
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
