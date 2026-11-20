import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Angrenda ijaraga kvartira va uylar | ANGREN ESTATE",
  description: "Angren shahrida ijaraga beriladigan kvartiralar, uylar va tijorat binolari — shahar xaritasida.",
  path: "/ijara",
});

export default function RentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
