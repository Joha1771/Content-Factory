"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LandingRenderer, { Block } from "@/components/landing/LandingRenderer";

type Landing = {
  blocks: Block[];
  bg_image: string | null;
  settings: { brandColor?: string };
};

export default function LandingPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [landing, setLanding] = useState<Landing | null>(null);

  useEffect(() => {
    fetch(`/api/landings/${id}`)
      .then(r => r.json())
      .then(d => setLanding(d))
      .catch(() => {});
  }, [id]);

  if (!landing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#94A3B8", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
        Загрузка...
      </div>
    );
  }

  return (
    <LandingRenderer
      blocks={landing.blocks ?? []}
      bgImage={landing.bg_image ?? undefined}
      brandColor={landing.settings?.brandColor ?? "#6366f1"}
    />
  );
}
