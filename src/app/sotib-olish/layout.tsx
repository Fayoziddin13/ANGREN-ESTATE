import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Angrenda ko‘chmas mulk sotib olish — kvartira, hovli, yer | ANGREN ESTATE",
  description: "Angren shahrida sotuvdagi kvartiralar, hovli-uylar, yer uchastkalari va tijorat obyektlari. Xaritada qidiring va narx, xona soni hamda hudud bo‘yicha filtrlang.",
  path: "/sotib-olish",
});

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
