import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/properties";
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
    };
  }

  const title = `${property.title_uz} | ANGREN ESTATE`;
  const description =
    property.description_uz?.slice(0, 160) ||
    `${property.address_uz || property.district_name_uz || "Angren"}, Angren shahrida joylashgan ko‘chmas mulk.`;
  const imageUrl = property.images?.[0] || property.photos?.[0] || "/logo.png";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://angrenestate.uz";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/properties/${property.id}`,
      siteName: "ANGREN ESTATE",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: property.title_uz,
        },
      ],
      type: "website",
      locale: "uz_UZ",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PropertyPage({ params }: PageProps) {
  const property = await getPropertyById(params.id, { useAdmin: true });
  if (!property || property.status === "draft" || property.status === "archived") {
    notFound();
  }

  return <PropertyDetailView initialProperty={property} propertyId={params.id} />;
}
