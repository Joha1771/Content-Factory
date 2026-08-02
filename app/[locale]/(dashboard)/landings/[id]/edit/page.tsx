"use client";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import LandingEditor from "@/components/landing/LandingEditor";

function EditPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const sp = useSearchParams();
  const fromCampaign = sp.get("from") === "campaign";
  const id = params.id as string;
  return (
    <div style={{ height: "100vh" }}>
      <LandingEditor
        id={id}
        onBack={() => fromCampaign ? router.back() : router.push(`/${locale}/landings`)}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><EditPage /></Suspense>;
}
