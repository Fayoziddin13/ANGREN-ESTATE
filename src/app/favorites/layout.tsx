import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Saqlangan obyektlar | ANGREN ESTATE",
  description: "Siz saqlagan ko‘chmas mulk obyektlari.",
  path: "/favorites",
  noIndex: true,
});

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
