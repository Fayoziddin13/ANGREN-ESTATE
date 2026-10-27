"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProperties } from "@/lib/propertyStore";
import { useSavedSearches } from "@/lib/savedSearchStore";
import { FloatingCompareBar } from "@/components/compare/FloatingCompareBar";
import { PropertyCompareModal } from "@/components/compare/PropertyCompareModal";
import { SavedSearchesModal } from "@/components/search/SavedSearchesModal";
import { PublicListingSubmissionModal } from "@/components/property/PublicListingSubmissionModal";
import { SavedSearch, Property } from "@/lib/types";
import { useTelegram } from "@/context/TelegramContext";

export function GlobalModals() {
  const pathname = usePathname();
  const router = useRouter();
  const { publishedProperties } = useProperties();
  const { checkMatchingAlerts } = useSavedSearches();
  const { isTelegram, setBackButton } = useTelegram();

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isSavedSearchesOpen, setIsSavedSearchesOpen] = useState(false);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);

  // Sync Telegram BackButton with compare, saved searches, and listing modals
  useEffect(() => {
    if (!isTelegram) return;

    if (isCompareOpen) {
      setBackButton({
        visible: true,
        onClick: () => setIsCompareOpen(false),
      });
    } else if (isSavedSearchesOpen) {
      setBackButton({
        visible: true,
        onClick: () => setIsSavedSearchesOpen(false),
      });
    } else if (isListingModalOpen) {
      setBackButton({
        visible: true,
        onClick: () => setIsListingModalOpen(false),
      });
    }
  }, [isTelegram, setBackButton, isCompareOpen, isSavedSearchesOpen, isListingModalOpen]);

  // Check matching saved search alerts when properties are loaded
  useEffect(() => {
    if (publishedProperties && publishedProperties.length > 0) {
      checkMatchingAlerts(publishedProperties);
    }
  }, [publishedProperties, checkMatchingAlerts]);

  // Listen for global modal open events from Header, MobileNav, or other triggers
  useEffect(() => {
    const handleOpenCompare = () => setIsCompareOpen(true);
    const handleOpenSavedSearches = () => setIsSavedSearchesOpen(true);
    const handleOpenListing = () => setIsListingModalOpen(true);

    window.addEventListener("angren_open_compare", handleOpenCompare);
    window.addEventListener("angren_open_saved_searches", handleOpenSavedSearches);
    window.addEventListener("angren_open_listing_modal", handleOpenListing);

    // Auto-open listing modal if URL search params specify action=ariza or modal=ariza
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        const action = sp.get("action");
        const modal = sp.get("modal");
        const ariza = sp.get("ariza");
        if (
          action === "ariza" ||
          action === "listing" ||
          modal === "ariza" ||
          modal === "listing" ||
          ariza === "1"
        ) {
          setIsListingModalOpen(true);
        }
      } catch {
        // ignore search params parsing error
      }
    }

    return () => {
      window.removeEventListener("angren_open_compare", handleOpenCompare);
      window.removeEventListener("angren_open_saved_searches", handleOpenSavedSearches);
      window.removeEventListener("angren_open_listing_modal", handleOpenListing);
    };
  }, [pathname]);

  // Do not render floating compare widgets on admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const handleApplySearch = (search: SavedSearch) => {
    setIsSavedSearchesOpen(false);

    if (pathname === "/") {
      window.dispatchEvent(
        new CustomEvent("angren_apply_search", {
          detail: search.filters,
        })
      );
    } else {
      const params = new URLSearchParams();
      if (search.filters.query) params.set("q", search.filters.query);
      if (search.filters.transactionType && search.filters.transactionType !== "all") {
        params.set("type", search.filters.transactionType);
      }
      if (search.filters.propertyType && search.filters.propertyType !== "all") {
        params.set("propertyType", search.filters.propertyType);
      }
      if (search.filters.district && search.filters.district !== "all") {
        params.set("district", search.filters.district);
      }
      router.push(`/?${params.toString()}`);
    }
  };

  const handleViewProperty = (propertyId: string) => {
    setIsSavedSearchesOpen(false);
    setIsCompareOpen(false);

    if (pathname === "/") {
      window.dispatchEvent(
        new CustomEvent("angren_open_detail", {
          detail: { id: propertyId },
        })
      );
    } else {
      router.push(`/?selected=${propertyId}&detail=1`);
    }
  };

  const handleSelectCompareProperty = (property: Property) => {
    setIsCompareOpen(false);
    handleViewProperty(property.id);
  };

  return (
    <>
      <FloatingCompareBar onOpenCompare={() => setIsCompareOpen(true)} />
      <PropertyCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        properties={publishedProperties}
        onSelectProperty={handleSelectCompareProperty}
      />
      <SavedSearchesModal
        isOpen={isSavedSearchesOpen}
        onClose={() => setIsSavedSearchesOpen(false)}
        onApplySearch={handleApplySearch}
        onViewProperty={handleViewProperty}
      />
      <PublicListingSubmissionModal
        isOpen={isListingModalOpen}
        onClose={() => setIsListingModalOpen(false)}
      />
    </>
  );
}
