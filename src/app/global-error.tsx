"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself
 * (providers, Telegram guard). Must render its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#ffffff",
          color: "#0f172a",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px" }}>ANGREN ESTATE</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 4px" }}>
            Kutilmagan xatolik yuz berdi. Sahifani qayta yuklang.
          </p>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>
            Произошла непредвиденная ошибка. Перезагрузите страницу.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: "#167d4f",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Qayta urinish / Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
