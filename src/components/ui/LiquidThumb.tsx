"use client";

import { motion } from "framer-motion";

/**
 * Liquid glass selection "thumb" for segmented controls and tab groups.
 *
 * Render it as the first child of the *active* option (which must be
 * `relative isolate`). All options of one group share the same `id`; framer-motion
 * then glides — and gently stretches — the glass from the old option to the new
 * one, like iOS segmented controls. Respects prefers-reduced-motion via the
 * app-wide MotionConfig.
 */
export function LiquidThumb({
  id,
  variant = "brand",
}: {
  id: string;
  variant?: "brand" | "light" | "white";
}) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden="true"
      className={`lg-thumb lg-thumb-${variant}`}
      transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.9 }}
    />
  );
}
