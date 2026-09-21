"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserProfile } from "@/lib/types";
import { supabase, isSupabaseConfigured, signInWithGoogle, signOut } from "@/lib/supabase";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  handleGoogleLogin: () => Promise<void>;
  handleTelegramLogin: (initData: string) => Promise<boolean>;
  handleLogout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Safe migration of guest favorites on login
  const migrateGuestFavorites = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("angren_estate_favorites_v1");
      if (!raw) return;
      const guestFavs: string[] = JSON.parse(raw);
      if (Array.isArray(guestFavs) && guestFavs.length > 0) {
        const rows = guestFavs.map((pid) => ({
          user_id: userId,
          property_id: pid,
        }));
        await supabase.from("favorites").upsert(rows, { onConflict: "user_id,property_id" });
      }
      localStorage.removeItem("angren_estate_favorites_v1");
    } catch (e) {
      console.warn("[AuthContext] Guest favorites migration warning:", e);
    }
  }, []);

  // Hydrate user profile from Supabase profiles table
  const syncProfile = useCallback(
    async (authUser: any) => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, email, full_name, avatar_url, role, status, phone")
          .eq("id", authUser.id)
          .maybeSingle();

        if (error) {
          console.warn("[AuthContext] Error reading profile:", error.message);
        }

        // Server-enforced disabled user check
        if (profile?.status === "disabled") {
          console.warn("[AuthContext] Disabled user account detected. Terminating session.");
          await signOut();
          setUser(null);
          if (typeof window !== "undefined") {
            alert(
              "Hisobingiz ma’muriyat tomonidan bloklangan.\nВаш аккаунт заблокирован администратором."
            );
          }
          return;
        }

        const role: "admin" | "user" = profile?.role === "admin" ? "admin" : "user";
        const fullName =
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          (authUser.email ? authUser.email.split("@")[0] : "Foydalanuvchi");
        const avatarUrl =
          profile?.avatar_url ||
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          undefined;

        setUser({
          id: authUser.id,
          email: authUser.email || profile?.email || "",
          full_name: fullName,
          avatar_url: avatarUrl,
          role,
          status: profile?.status || "active",
          phone: profile?.phone,
        });

        // Migrate guest favorites to database
        await migrateGuestFavorites(authUser.id);
      } catch (err) {
        console.error("[AuthContext] Profile sync exception:", err);
      }
    },
    [migrateGuestFavorites]
  );

  useEffect(() => {
    // One-time cleanup of legacy mock user storage
    if (typeof window !== "undefined") {
      localStorage.removeItem("angren_estate_users_v1");
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncProfile(session.user).finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await syncProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [syncProfile]);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[AuthContext] Google sign in error:", err);
    }
  };

  const handleTelegramLogin = async (initData: string): Promise<boolean> => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setIsAuthModalOpen(false);
        await migrateGuestFavorites(data.user.id);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[AuthContext] Telegram sign in error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn("[AuthContext] Sign out warning:", e);
    }
    setUser(null);
  };

  const refreshProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await syncProfile(session.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        handleGoogleLogin,
        handleTelegramLogin,
        handleLogout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
