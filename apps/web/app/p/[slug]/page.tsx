import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getPropertyCheckInCard } from "@/lib/property-reps";
import { getRepCard, offlineContactQrUrl, vCardDownloadUrl } from "@/lib/reps";
import { CheckInCard } from "./CheckInCard";

type LeadPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    "check-in"?: string | string[];
    session?: string | string[];
    sessionId?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

const getPublicCard = cache(async (slug: string) =>
  getRepCard(slug) ?? await getPropertyCheckInCard(slug)
);

function wantsCheckIn(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = (raw ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function firstQueryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || null;
}

export async function generateMetadata({ params }: LeadPageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = await getPublicCard(slug);

  if (!card) {
    return { title: "Tour contact" };
  }

  const { rep, property } = card;
  const title = `${property.name} tour with ${rep.name}`;
  const description = `Check in for your tour at ${property.name} with ${rep.name}, ${rep.title}.`;
  const cardImage = rep.slug ? `/api/p/${rep.slug}/card` : null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      ...(cardImage ? { images: [{ url: cardImage, width: 1200, height: 630, alt: `${rep.name} tour card` }] } : {})
    },
    twitter: {
      card: cardImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(cardImage ? { images: [cardImage] } : {})
    }
  };
}

export default async function LeadPage({ params, searchParams }: LeadPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const card = await getPublicCard(slug);

  if (!card) {
    notFound();
  }

  return (
    <CheckInCard
      card={card}
      vCardUrl={vCardDownloadUrl(card.rep)}
      offlineQrUrl={offlineContactQrUrl(card.rep)}
      initialSheet={wantsCheckIn(query["check-in"]) ? "contact" : "none"}
      sessionId={firstQueryValue(query.sessionId ?? query.session)}
    />
  );
}
