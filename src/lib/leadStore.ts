"use client";

import { useState, useEffect, useCallback } from "react";
import { Lead } from "./types";

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  phone: number;
  telegram: number;
}

export interface LeadFilters {
  status?: string;
  type?: string;
  property_id?: string;
  realtor_id?: string;
  date_range?: string;
  search?: string;
}

export function useLeads(initialFilters?: LeadFilters) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    total: 0,
    new: 0,
    contacted: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    phone: 0,
    telegram: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadFilters>(initialFilters || {});

  const fetchLeads = useCallback(async (currentFilters?: LeadFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFilters = currentFilters !== undefined ? currentFilters : filters;
      const params = new URLSearchParams();

      if (activeFilters.status && activeFilters.status !== "all") {
        params.set("status", activeFilters.status);
      }
      if (activeFilters.type && activeFilters.type !== "all") {
        params.set("type", activeFilters.type);
      }
      if (activeFilters.property_id) {
        params.set("property_id", activeFilters.property_id);
      }
      if (activeFilters.realtor_id) {
        params.set("realtor_id", activeFilters.realtor_id);
      }
      if (activeFilters.date_range && activeFilters.date_range !== "all") {
        params.set("date_range", activeFilters.date_range);
      }
      if (activeFilters.search && activeFilters.search.trim()) {
        params.set("search", activeFilters.search.trim());
      }

      const queryString = params.toString();
      const res = await fetch(`/api/admin/leads${queryString ? `?${queryString}` : ""}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Admin sessiyasi talab qilinadi");
        } else {
          setError(`Xatolik yuz berdi (${res.status})`);
        }
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setError(data.error || "Lidlarni yuklashda xatolik");
      }
    } catch (err: any) {
      console.error("[useLeads] Fetch error:", err);
      setError(err?.message || "Tarmoq xatosi");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateLead = useCallback(
    async (id: string, patch: { status?: Lead["status"]; notes?: string }): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          return false;
        }

        const data = await res.json();
        if (data.success && data.lead) {
          setLeads((prev) =>
            prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l))
          );
          // Re-fetch stats to reflect the status change accurately
          fetchLeads();
          return true;
        }
        return false;
      } catch (err) {
        console.error("[useLeads] Update error:", err);
        return false;
      }
    },
    [fetchLeads]
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: Lead["status"]): Promise<boolean> => {
      return updateLead(id, { status });
    },
    [updateLead]
  );

  const updateLeadNotes = useCallback(
    async (id: string, notes: string): Promise<boolean> => {
      return updateLead(id, { notes });
    },
    [updateLead]
  );

  return {
    leads,
    newLeads: leads.filter((l) => l.status === "new"),
    inProgressLeads: leads.filter((l) => l.status === "in_progress"),
    closedLeads: leads.filter((l) => l.status === "completed" || l.status === "closed"),
    stats,
    isLoading,
    isLoaded: !isLoading,
    error,
    filters,
    setFilters,
    refresh: () => fetchLeads(),
    updateLead,
    updateLeadStatus,
    updateLeadNotes,
  };
}
