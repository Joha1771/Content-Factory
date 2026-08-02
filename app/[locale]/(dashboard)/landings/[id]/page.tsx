"use client";
import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import LandingDetail from "@/components/landing/LandingDetail";

function LandingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const id = params.id as string;
  return (
    <LandingDetail
      id={id}
      onBack={() => router.push(`/${locale}/landings`)}
    />
  );
}

export default function Page() {
  return <Suspense fallback={null}><LandingDetailPage /></Suspense>;
}
