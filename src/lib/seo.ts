import type { Metadata } from "next";
import { absoluteUrl } from "./siteUrl";

export const SITE_NAME = "ANGREN ESTATE";

interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

const DEFAULT_OG_IMAGE: OgImage = { url: "/logo.png", width: 800, height: 600, alt: SITE_NAME };

/**
 * Complete per-page metadata. Every indexable route should call this so it gets
 * its own canonical URL; child segments replace (not merge) `alternates` and
 * `openGraph`, so nothing is inherited from the root layout by accident.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  images,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  images?: OgImage[];
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImages = images && images.length > 0 ? images : [DEFAULT_OG_IMAGE];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: ogImages,
      locale: "uz_UZ",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages.map((image) => image.url),
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
