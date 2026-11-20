import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyById, sanitizePublicProperty } from "@/lib/properties";
import { buildPageMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/siteUrl";
import { Property } from "@/lib/types";
import PropertyDetailView from "@/components/property/PropertyDetailView";

interface PageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const property = await getPropertyById(params.id, { useAdmin: true });
  if (!property || property.status === "draft" || property.status === "archived") {
    return {
      title: "Obyekt topilmadi - ANGREN ESTATE",
      description: "Angren shahrida ko'chmas mulk e'lonlari",
      robots: { index: false, follow: true },
    };
  }

  const title = `${property.title_uz} | ANGREN ESTATE`;
  const description =
    property.description_uz?.slice(0, 160) ||
    `${property.address_uz || property.district_name_uz || "Angren"}, Angren shahrida joylashgan ko‘chmas mulk.`;
  const imageUrl = property.images?.[0] || property.photos?.[0] || "/logo.png";

  return buildPageMetadata({
    title,
    description,
    path: `/properties/${encodeURIComponent(property.id)}`,
    images: [{ url: imageUrl, width: 1200, height: 630, alt: property.title_uz }],
  });
}

export default async function PropertyPage({ params }: PageProps) {
  const property = await getPropertyById(params.id, { useAdmin: true });
  if (!property || property.status === "draft" || property.status === "archived") {
    notFound();
  }

  // The property is read with the service role; strip private fields (hidden
  // owner phone) before it is serialized into the client component's payload.
  const publicProperty = sanitizePublicProperty(property);

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD structured data for search engines; "<" is escaped so listing
        // text can never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildListingJsonLd(publicProperty)).replace(/</g, "\\u003c"),
        }}
      />
      <PropertyDetailView initialProperty={publicProperty} propertyId={params.id} />
    </>
  );
}

function buildListingJsonLd(property: Property) {
  const url = absoluteUrl(`/properties/${encodeURIComponent(property.id)}`);
  const images = (property.images?.length ? property.images : property.photos || []).slice(0, 6);
  const priceUsd = Number(property.price_usd) || 0;
  const priceUzs = Number(property.price_uzs || property.price) || 0;
  const offer =
    priceUsd > 0
      ? { "@type": "Offer", price: priceUsd, priceCurrency: "USD" }
      : priceUzs > 0
      ? { "@type": "Offer", price: priceUzs, priceCurrency: "UZS" }
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title_uz,
    description: property.description_uz?.slice(0, 500) || undefined,
    url,
    image: images.length ? images : undefined,
    datePosted: (property as any).published_at || property.created_at || undefined,
    ...(offer
      ? {
          offers: {
            ...offer,
            availability:
              property.status === "published"
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
            businessFunction:
              property.transaction_type === "rent"
                ? "https://purl.org/goodrelations/v1#LeaseOut"
                : "https://purl.org/goodrelations/v1#Sell",
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: "Angren",
      addressRegion: "Toshkent viloyati",
      addressCountry: "UZ",
      streetAddress: property.address_uz || undefined,
    },
    ...(property.latitude && property.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude } }
      : {}),
  };
}
