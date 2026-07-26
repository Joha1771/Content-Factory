import { Metadata } from "next";
import { notFound } from "next/navigation";
import { queryOne, query } from "@/lib/db";
import PublicLandingClient from "./PublicLandingClient";

type Props = { params: Promise<{ slug: string }> };

type LandingRow = {
  id: string;
  title: string;
  created_at: string;
  content: {
    blocks: unknown[];
    bg_image?: string | null;
    settings?: {
      brandColor?: string;
      tone?: string;
      autoCloseDays?: number | null;
      widgets?: { chat?: boolean; quickCall?: boolean };
      pixels?: { metaPixelId?: string; yandexMetrikaId?: string; gaId?: string };
      seo?: { description?: string; ogImage?: string };
      afterSubmit?: {
        mode?: string;
        message?: string;
        redirectUrl?: string;
        telegramUrl?: string;
        whatsappPhone?: string;
      };
    };
  } | null;
};

// Pixel ID validators — SECURITY CRITICAL
const META_PIXEL_RE = /^\d{15,16}$/;
const YM_RE = /^\d+$/;
const GA_RE = /^(G|UA|AW)-[\w-]+$/;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mvira.uz";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await queryOne<{ title: string; content: LandingRow["content"] }>(
    "SELECT title, content FROM landings WHERE slug = $1 AND published = true",
    [slug]
  );
  if (!row) return { title: "Лендинг" };

  const settings = (row.content as any)?.settings ?? {};
  const seo = settings.seo ?? {};
  const blocks: any[] = (row.content as any)?.blocks ?? [];
  const bgImage: string | null | undefined = (row.content as any)?.bg_image;

  // Description: seo.description → first hero subheadline
  const heroBlock = blocks.find((b: any) => b.type === "hero");
  const description: string | undefined =
    seo.description ||
    heroBlock?.subheadline ||
    undefined;

  // OG image: seo.ogImage if http → bg_image if http
  let ogImage: string | undefined;
  if (typeof seo.ogImage === "string" && seo.ogImage.startsWith("http")) {
    ogImage = seo.ogImage;
  } else if (typeof bgImage === "string" && bgImage.startsWith("http")) {
    ogImage = bgImage;
  }

  const pageUrl = `${SITE_URL}/l/${slug}`;

  return {
    title: row.title ?? "Лендинг",
    description,
    openGraph: {
      title: row.title ?? "Лендинг",
      description,
      url: pageUrl,
      images: ogImage ? [{ url: ogImage }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: row.title ?? "Лендинг",
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params;

  const landing = await queryOne<LandingRow>(
    "SELECT id, title, created_at, content FROM landings WHERE slug = $1 AND published = true",
    [slug]
  );

  if (!landing) notFound();

  // increment view counter (fire-and-forget)
  query("UPDATE landings SET views = views + 1 WHERE id = $1", [landing.id]).catch(() => {});

  const content = (landing.content ?? {}) as {
    blocks?: unknown[];
    bg_image?: string | null;
    settings?: {
      brandColor?: string;
      autoCloseDays?: number | null;
      widgets?: { chat?: boolean; quickCall?: boolean };
      pixels?: { metaPixelId?: string; yandexMetrikaId?: string; gaId?: string };
      afterSubmit?: {
        mode?: string;
        message?: string;
        redirectUrl?: string;
        telegramUrl?: string;
        whatsappPhone?: string;
      };
    };
  };
  const blocks = content.blocks ?? [];
  const bgImage = content.bg_image ?? undefined;
  const brandColor = content.settings?.brandColor ?? "#6366f1";
  const autoCloseDays = content.settings?.autoCloseDays ?? null;
  const widgets = content.settings?.widgets ?? {};
  const afterSubmit = content.settings?.afterSubmit ?? {};

  // Feature 1: Validate pixel IDs (XSS prevention — SECURITY CRITICAL)
  const rawPixels = content.settings?.pixels ?? {};
  const pixels: { metaPixelId?: string; yandexMetrikaId?: string; gaId?: string } = {};
  if (typeof rawPixels.metaPixelId === "string" && META_PIXEL_RE.test(rawPixels.metaPixelId)) {
    pixels.metaPixelId = rawPixels.metaPixelId;
  }
  if (typeof rawPixels.yandexMetrikaId === "string" && YM_RE.test(rawPixels.yandexMetrikaId)) {
    pixels.yandexMetrikaId = rawPixels.yandexMetrikaId;
  }
  if (typeof rawPixels.gaId === "string" && GA_RE.test(rawPixels.gaId)) {
    pixels.gaId = rawPixels.gaId;
  }

  return (
    <PublicLandingClient
      landingId={landing.id}
      createdAt={landing.created_at}
      blocks={blocks as any}
      bgImage={bgImage}
      brandColor={brandColor}
      autoCloseDays={autoCloseDays}
      widgets={widgets}
      pixels={pixels}
      afterSubmit={afterSubmit}
    />
  );
}
