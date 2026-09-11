import { uz, Dictionary } from "./uz";
import { ru } from "./ru";
import { Locale } from "@/lib/types";

export const dictionaries: Record<Locale, Dictionary> = {
  uz,
  ru,
};

export type { Dictionary };
