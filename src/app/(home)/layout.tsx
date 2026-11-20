import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada",
  description: "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.",
  path: "/",
});

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The map-first home screen has no visible heading; give search engines and
          screen readers the page's main topic without changing the layout. */}
      <h1 className="sr-only">Angren ko‘chmas mulki — kvartira, hovli va tijorat obyektlari xaritada</h1>
      {children}
    </>
  );
}
