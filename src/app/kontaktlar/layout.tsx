import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Kontaktlar va e’lon berish | ANGREN ESTATE",
  description: "ANGREN ESTATE bilan bog‘laning yoki obyektingizni joylashtirish uchun ariza qoldiring.",
  path: "/kontaktlar",
});

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
