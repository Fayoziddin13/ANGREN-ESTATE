import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Biz haqimizda | ANGREN ESTATE",
  description: "ANGREN ESTATE — Angren shahrida ko‘chmas mulkni topish, sotish va ijaraga berish uchun platforma.",
  path: "/biz-haqimizda",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
