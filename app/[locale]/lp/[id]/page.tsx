import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import LandingRenderer from "@/components/landing/LandingRenderer";

type Props = { params: Promise<{ id: string }> };

export default async function LandingPreviewPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;

  const landing = await queryOne<{
    id: string;
    content: Record<string, any> | null;
  }>(
    "SELECT id, content FROM landings WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );

  if (!landing) notFound();

  const content = (landing.content ?? {}) as {
    blocks?: unknown[];
    bg_image?: string | null;
    settings?: { brandColor?: string };
  };
  const blocks = (content.blocks ?? []) as any[];
  const bgImage = content.bg_image ?? undefined;
  const brandColor = content.settings?.brandColor ?? "#6366f1";

  return (
    <div style={{ margin: 0, padding: 0 }}>
      <LandingRenderer
        blocks={blocks}
        bgImage={bgImage}
        brandColor={brandColor}
        preview={false}
      />
    </div>
  );
}
