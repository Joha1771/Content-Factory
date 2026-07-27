"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { ChevronLeft, Copy, Clock } from "lucide-react";

const SOCIAL_KEYS = ["instagram", "telegram", "tiktok", "youtube"];
const AD_KEYS = ["meta", "google", "yandex"];

const PLATFORM_META: Record<
  string,
  { color: string; textColor?: string; abbr: string; name: string }
> = {
  yandex:    { color: "#FFDB4D", textColor: "#664400", abbr: "Я",  name: "Яндекс Директ" },
  vk:        { color: "#0077FF", abbr: "VK", name: "VK Реклама" },
  telegram:  { color: "#0088CC", abbr: "TG", name: "Telegram Ads" },
  mytarget:  { color: "#FF6600", abbr: "MT", name: "myTarget" },
  google:    { color: "#34A853", abbr: "G",  name: "Google Ads" },
  meta:      { color: "#1877F2", abbr: "M",  name: "Meta Ads" },
  tiktok:    { color: "#000000", abbr: "TT", name: "TikTok Ads" },
  instagram: { color: "#E1306C", abbr: "IG", name: "Instagram" },
  youtube:   { color: "#FF0000", abbr: "YT", name: "YouTube" },
};

function fmt(n: number) {
  if (!n || n <= 0) return "—";
  return `₽${n >= 1000 ? Math.round(n / 1000) + "k" : Math.round(n)}`;
}

const STATUS_LABEL: Record<string, string> = {
  active:    "Активна",
  paused:    "Пауза",
  ab_test:   "A/B",
  draft:     "Черновик",
  completed: "Завершена",
};

type TabKey = "info" | "schedule" | "history" | "landing" | "content" | "platforms";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [scheduleModal, setScheduleModal] = useState<any>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Landing tab
  const [landingId, setLandingId] = useState<string | null>(null);
  const [landingUpdating, setLandingUpdating] = useState(false);

  // Content tab
  const [socialPlan, setSocialPlan] = useState<any>(null);
  const [socialPlanLoading, setSocialPlanLoading] = useState(false);
  const [socialPlanError, setSocialPlanError] = useState("");
  const [socialPlanApproved, setSocialPlanApproved] = useState(false);
  const [adsPlan, setAdsPlan] = useState<any>(null);
  const [adsPlanLoading, setAdsPlanLoading] = useState(false);
  const [adsPlanError, setAdsPlanError] = useState("");
  const [adsPlanApproved, setAdsPlanApproved] = useState(false);
  const [activeContentSection, setActiveContentSection] = useState<"social" | "ads">("social");
  const [generatedCreatives, setGeneratedCreatives] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creativeFilter, setCreativeFilter] = useState<string>("all");
  const [publishingNow, setPublishingNow] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [planModal, setPlanModal] = useState<"social" | "ads" | null>(null);
  const [planModalEdit, setPlanModalEdit] = useState<any>(null);
  const [editingPlatforms, setEditingPlatforms] = useState(false);
  const [platformsDraft, setPlatformsDraft] = useState<string[]>([]);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["ad_campaign", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}`);
      return res.ok ? res.json() : null;
    },
  });

  const { data: leadsData } = useQuery({
    queryKey: ["campaign_leads", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/leads`);
      return res.ok ? res.json() : null;
    },
  });

  useEffect(() => {
    if (campaign?.landing_id && !landingId) {
      setLandingId(campaign.landing_id);
    }
  }, [campaign]);

  const { data: creatives = [], refetch: refetchCreatives } = useQuery({
    queryKey: ["ad_creatives_campaign", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/creatives`);
      return res.ok ? res.json() : [];
    },
  });

  const { data: landings = [] } = useQuery({
    queryKey: ["landings_for_campaign"],
    queryFn: async () => {
      const res = await fetch("/api/landings");
      return res.ok ? res.json() : [];
    },
  });

  const { data: adPlatforms = [], refetch: refetchAdPlatforms } = useQuery({
    queryKey: ["ad_platforms_campaign"],
    queryFn: async () => {
      const res = await fetch("/api/ad-platforms");
      return res.ok ? res.json() : [];
    },
  });

  // Restore AI-generated content from DB on page load
  useEffect(() => {
    const saved = creatives as any[];
    const aiItems = saved.filter((c: any) => c.content);
    if (aiItems.length > 0) {
      const mapped = aiItems.map((c: any) => {
        const content = typeof c.content === "string" ? JSON.parse(c.content) : (c.content ?? {});
        return { ...content, id: c.id, platform: c.platform || content.platform, subtype: c.format || content.subtype };
      });
      setGeneratedCreatives(mapped);
      if (mapped.some((c: any) => SOCIAL_KEYS.includes(c.platform))) setSocialPlanApproved(true);
      if (mapped.some((c: any) => AD_KEYS.includes(c.platform))) setAdsPlanApproved(true);
    }
  }, [creatives]);

  const updateCampaign = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Ошибка обновления");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad_campaign", id] }),
  });

  const cloneCampaign = async () => {
    if (!campaign) return;
    setCloning(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${campaign.name} — копия`,
          goal: campaign.goal,
          description: campaign.description,
          platforms: campaign.platforms,
          status: "draft",
          budget: campaign.budget_total,
          project_id: campaign.project_id,
        }),
      });
      const data = await res.json();
      if (data?.id) router.push(`/${locale}/campaigns/${data.id}`);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setCloning(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleModal || !scheduleTime) return;
    setScheduling(true);
    try {
      await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: scheduleModal.id,
          platform: scheduleModal.platform,
          scheduled_at: new Date(scheduleTime).toISOString(),
        }),
      });
      await fetch(`/api/campaigns/${id}/creatives?creativeId=${scheduleModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      qc.invalidateQueries({ queryKey: ["ad_creatives_campaign", id] });
      setScheduleModal(null);
      setScheduleTime("");
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setScheduling(false);
    }
  };

  const selectLanding = async (lid: string | null) => {
    setLandingUpdating(true);
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landing_id: lid }),
      });
      setLandingId(lid);
      qc.invalidateQueries({ queryKey: ["ad_campaign", id] });
    } finally {
      setLandingUpdating(false);
    }
  };

  const generateCreativeContent = async (p: any): Promise<any> => {
    const res = await fetch("/api/ai/generate-creative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error("generation failed");
    return res.json();
  };

  const generateSocialPlan = async () => {
    if (!campaign) return;
    const platforms = (campaign.platforms ?? []).filter((p: string) => SOCIAL_KEYS.includes(p));
    setSocialPlanLoading(true);
    setSocialPlanError("");
    setSocialPlan(null);
    setSocialPlanApproved(false);
    try {
      const res = await fetch("/api/ai/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: (campaign as any).niche ?? "",
          goal: campaign.goal ?? "",
          product: campaign.description ?? "",
          audience: (campaign as any).audience ?? "",
          budget: campaign.budget_total ?? "",
          dateFrom: campaign.starts_at ?? "",
          dateTo: campaign.ends_at ?? "",
          platforms,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сервера");
      setSocialPlan(await res.json());
    } catch (e: any) {
      setSocialPlanError(e.message || "Не удалось создать план");
    } finally {
      setSocialPlanLoading(false);
    }
  };

  const generateAdsPlan = async () => {
    if (!campaign) return;
    const platforms = (campaign.platforms ?? []).filter((p: string) => AD_KEYS.includes(p));
    setAdsPlanLoading(true);
    setAdsPlanError("");
    setAdsPlan(null);
    setAdsPlanApproved(false);
    try {
      const res = await fetch("/api/ai/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: (campaign as any).niche ?? "",
          goal: campaign.goal ?? "",
          product: campaign.description ?? "",
          audience: (campaign as any).audience ?? "",
          budget: campaign.budget_total ?? "",
          dateFrom: campaign.starts_at ?? "",
          dateTo: campaign.ends_at ?? "",
          platforms,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сервера");
      setAdsPlan(await res.json());
    } catch (e: any) {
      setAdsPlanError(e.message || "Не удалось создать план");
    } finally {
      setAdsPlanLoading(false);
    }
  };

  const generateFromSocialPlan = async () => {
    if (!socialPlan || !campaign) return;
    setGenerating(true);
    const tasks: Promise<any>[] = [];
    let vi = 0;
    for (const [platformKey, data] of Object.entries(socialPlan.socialMedia ?? {})) {
      const formats = Object.entries(data as Record<string, any>).filter(
        ([k, v]) => k !== "reasoning" && typeof v === "number"
      );
      for (const [subtype, count] of formats) {
        for (let i = 0; i < (count as number); i++) {
          const currentVi = vi++;
          const localId = `${platformKey}__${subtype}__${currentVi}`;
          tasks.push(
            generateCreativeContent({
              platform: platformKey, subtype,
              product: campaign.description ?? "",
              goal: campaign.goal ?? "",
              audience: (campaign as any).audience ?? "",
              projectName: campaign.name,
              niche: (campaign as any).niche ?? "",
              tone: "", keywords: "",
              budget: campaign.budget_total ?? "",
              variationIndex: currentVi,
            })
              .then((content: any) => ({ id: localId, platform: platformKey, subtype, ...content }))
              .catch(() => null)
          );
        }
      }
    }
    const results = (await Promise.all(tasks)).filter(Boolean);
    try {
      await fetch(`/api/campaigns/${id}/creatives`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "social" }),
      });
      const postRes = await fetch(`/api/campaigns/${id}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatives: results }),
      });
      if (postRes.ok) {
        const saved = await postRes.json();
        const mapped = (saved as any[]).map((c: any) => {
          const content = typeof c.content === "string" ? JSON.parse(c.content) : (c.content ?? {});
          return { ...content, id: c.id, platform: c.platform, subtype: c.format };
        });
        setGeneratedCreatives((prev: any[]) => [
          ...prev.filter((c: any) => !SOCIAL_KEYS.includes(c.platform)),
          ...mapped,
        ]);
        refetchCreatives();
      } else {
        setGeneratedCreatives((prev: any[]) => [
          ...prev.filter((c: any) => !SOCIAL_KEYS.includes(c.platform)),
          ...results,
        ]);
      }
    } catch {
      setGeneratedCreatives((prev: any[]) => [
        ...prev.filter((c: any) => !SOCIAL_KEYS.includes(c.platform)),
        ...results,
      ]);
    }
    setGenerating(false);
  };

  const generateFromAdsPlan = async () => {
    if (!adsPlan || !campaign) return;
    setGenerating(true);
    const tasks: Promise<any>[] = [];
    let vi = 0;
    for (const [platformKey, data] of Object.entries(adsPlan.adPlatforms ?? {})) {
      const formats = Object.entries(data as Record<string, any>).filter(
        ([k, v]) => k !== "reasoning" && typeof v === "number"
      );
      for (const [subtype, count] of formats) {
        for (let i = 0; i < (count as number); i++) {
          const currentVi = vi++;
          const localId = `${platformKey}__${subtype}__${currentVi}`;
          tasks.push(
            generateCreativeContent({
              platform: platformKey, subtype,
              product: campaign.description ?? "",
              goal: campaign.goal ?? "",
              audience: (campaign as any).audience ?? "",
              projectName: campaign.name,
              niche: (campaign as any).niche ?? "",
              tone: "", keywords: "",
              budget: campaign.budget_total ?? "",
              variationIndex: currentVi,
            })
              .then((content: any) => ({ id: localId, platform: platformKey, subtype, ...content }))
              .catch(() => null)
          );
        }
      }
    }
    const results = (await Promise.all(tasks)).filter(Boolean);
    try {
      await fetch(`/api/campaigns/${id}/creatives`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "ads" }),
      });
      const postRes = await fetch(`/api/campaigns/${id}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatives: results }),
      });
      if (postRes.ok) {
        const saved = await postRes.json();
        const mapped = (saved as any[]).map((c: any) => {
          const content = typeof c.content === "string" ? JSON.parse(c.content) : (c.content ?? {});
          return { ...content, id: c.id, platform: c.platform, subtype: c.format };
        });
        setGeneratedCreatives((prev: any[]) => [
          ...prev.filter((c: any) => !AD_KEYS.includes(c.platform)),
          ...mapped,
        ]);
        refetchCreatives();
      } else {
        setGeneratedCreatives((prev: any[]) => [
          ...prev.filter((c: any) => !AD_KEYS.includes(c.platform)),
          ...results,
        ]);
      }
    } catch {
      setGeneratedCreatives((prev: any[]) => [
        ...prev.filter((c: any) => !AD_KEYS.includes(c.platform)),
        ...results,
      ]);
    }
    setGenerating(false);
  };

  const openPlanModal = (section: "social" | "ads") => {
    const p = section === "social" ? socialPlan : adsPlan;
    if (!p) return;
    setPlanModalEdit(JSON.parse(JSON.stringify(p)));
    setPlanModal(section);
  };
  const closePlanModal = () => { setPlanModal(null); setPlanModalEdit(null); };
  const applyPlanEdit = () => {
    if (!planModal || !planModalEdit) return;
    if (planModal === "social") { setSocialPlan(planModalEdit); setSocialPlanApproved(true); }
    else { setAdsPlan(planModalEdit); setAdsPlanApproved(true); }
    setPlanModal(null); setPlanModalEdit(null);
  };

  const inp =
    "w-full px-3 py-2.5 rounded-[8px] border border-line text-[12px] outline-none focus:border-line-strong bg-panel text-tx-1 placeholder:text-tx-3";

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-[32px] mb-3 animate-spin">✦</div>
          <p className="text-[12px] text-tx-3">Загрузка кампании...</p>
        </div>
      </div>
    );

  if (!campaign)
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-[13px] text-tx-2">Кампания не найдена</p>
        <button
          onClick={() => router.back()}
          className="text-[12px] text-accent hover:opacity-80 cursor-pointer"
        >
          ← Назад
        </button>
      </div>
    );

  const spent = campaign.budget_spent ?? 0;
  const total = campaign.budget_total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;

  const campaignPlatforms: string[] = campaign.platforms ?? [];
  const socialPlatforms = campaignPlatforms.filter((p) => SOCIAL_KEYS.includes(p));
  const adsPlatforms = campaignPlatforms.filter((p) => AD_KEYS.includes(p));

  const renderPlanSection = (
    section: "social" | "ads",
    plan: any,
    planLoading: boolean,
    planError: string,
    planApproved: boolean,
    setPlan: (p: any) => void,
    setPlanApproved: (v: boolean) => void,
    doGeneratePlan: () => void,
    doGenerateFromPlan: () => void
  ) => {
    const sectionPlatforms = section === "social" ? socialPlatforms : adsPlatforms;
    const planData = section === "social" ? (plan?.socialMedia ?? {}) : (plan?.adPlatforms ?? {});

    if (sectionPlatforms.length === 0)
      return (
        <div className="ui-surface flex flex-col items-center py-12 text-center">
          <p className="text-[13px] font-medium text-tx-1 mb-1">Нет платформ</p>
          <p className="text-[11px] text-tx-3 max-w-[300px]">
            {section === "social"
              ? "Добавьте соцсети (Instagram, Telegram, TikTok, YouTube) в кампанию"
              : "Добавьте рекламные кабинеты (Meta, Google, Яндекс) в кампанию"}
          </p>
        </div>
      );

    return (
      <div className="space-y-4">
        {/* Platform badges */}
        <div className="flex flex-wrap gap-2">
          {sectionPlatforms.map((p) => {
            const meta = PLATFORM_META[p];
            return meta ? (
              <div
                key={p}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-line text-[11px] text-tx-1"
              >
                <span
                  className="w-4 h-4 rounded-[4px] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                  style={{ background: meta.color }}
                >
                  {meta.abbr}
                </span>
                {meta.name}
              </div>
            ) : null;
          })}
        </div>

        {/* Plan area */}
        <div className="ui-surface p-4">
          {planApproved ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] text-green-500 font-medium">✓ План утверждён</span>
                <button
                  onClick={() => openPlanModal(section)}
                  className="ml-1 text-[11px] text-accent hover:opacity-80 cursor-pointer"
                >
                  👁 Просмотреть
                </button>
                <button
                  onClick={() => { setPlan(null); setPlanApproved(false); }}
                  className="ml-auto text-[11px] text-tx-3 hover:text-neg cursor-pointer"
                >
                  ← Сброс
                </button>
              </div>
              <button
                onClick={doGenerateFromPlan}
                disabled={generating}
                className="w-full py-3 bg-accent text-on-accent text-[12px] font-medium rounded-[8px] hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {generating ? "⟳ Генерирую контент..." : "🎨 Создать контент по плану"}
              </button>
            </div>
          ) : plan ? (
            <div className="space-y-2">
              <button
                onClick={() => openPlanModal(section)}
                className="w-full py-3 border border-dashed border-accent/40 rounded-[8px] text-[12px] text-accent hover:bg-accent/5 cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                📋 Просмотреть и утвердить план
              </button>
              <button
                onClick={() => { setPlan(null); setPlanApproved(false); }}
                className="w-full py-1.5 text-[11px] text-tx-3 hover:text-neg cursor-pointer"
              >
                ✕ Сбросить план
              </button>
            </div>
          ) : (
            <div>
              {planError && <p className="text-[11px] text-red-500 mb-2">{planError}</p>}
              <button
                onClick={doGeneratePlan}
                disabled={planLoading}
                className="w-full py-3 border border-dashed border-accent/40 rounded-[8px] text-[12px] text-accent hover:bg-accent/5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {planLoading ? "⟳ Создаю план..." : "✦ Создать контент-план"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="h-11 border-b border-line px-5 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 bg-panel">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/campaigns`)}
            className="flex items-center gap-1.5 text-[11px] text-tx-3 hover:text-tx-1 cursor-pointer"
          >
            <ChevronLeft size={14} /> Кампании
          </button>
          <span className="text-tx-3 text-[11px]">/</span>
          <span className="text-[11px] text-tx-2 font-medium truncate max-w-[280px]">
            {campaign.name}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cloneCampaign}
            disabled={cloning}
            className="inline-flex items-center gap-1.5 border border-line rounded-[7px] px-3 py-1.5 text-[11px] text-tx-2 hover:bg-hover cursor-pointer disabled:opacity-50"
          >
            <Copy size={12} /> {cloning ? "Клонирую..." : "Клонировать"}
          </button>
          {campaign.status === "active" && (
            <button
              onClick={() => updateCampaign.mutate({ status: "paused" })}
              className="inline-flex items-center gap-1.5 border border-line rounded-[7px] px-3 py-1.5 text-[11px] text-tx-2 hover:bg-hover cursor-pointer"
            >
              ⏸ Пауза
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => updateCampaign.mutate({ status: "active" })}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent rounded-[7px] px-3 py-1.5 text-[11px] font-medium hover:opacity-90 cursor-pointer"
            >
              ▶ Возобновить
            </button>
          )}
        </div>
      </div>

      {/* Title + meta */}
      <div className="px-5 pt-5 pb-3 max-w-[960px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[20px] font-semibold text-tx-1">{campaign.name}</h1>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-chip text-tx-2">
            {STATUS_LABEL[campaign.status] ?? campaign.status}
          </span>
        </div>
        {campaign.goal && (
          <p className="text-[12px] text-tx-3 mb-2">{campaign.goal}</p>
        )}
        <div className="flex gap-1.5 flex-wrap">
          {campaignPlatforms.map((pid: string) => {
            const pm = PLATFORM_META[pid];
            return pm ? (
              <div
                key={pid}
                style={{
                  width: 26, height: 18, borderRadius: 4,
                  background: pm.color, color: pm.textColor ?? "#fff",
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {pm.abbr}
              </div>
            ) : null;
          })}
        </div>
      </div>

      {/* Tracking notice */}
      <div className="px-5 pb-2 max-w-[960px] mx-auto w-full">
        <p className="text-[10px] text-tx-3">mvira отслеживает статистику из подключённых кабинетов — реклама создаётся вручную в рекламном кабинете</p>
      </div>

      {/* KPIs */}
      <div className="px-5 pb-4 grid grid-cols-5 gap-3 max-w-[960px] mx-auto w-full">
        {[
          { l: "Расход", v: fmt(spent) },
          { l: "CTR", v: campaign.ctr > 0 ? `${campaign.ctr.toFixed(1)}%` : "—" },
          { l: "CPL", v: fmt(campaign.cpl) },
          { l: "ROAS", v: campaign.roas > 0 ? `${Math.round(campaign.roas)}%` : "—" },
          { l: "Заявок", v: campaign.leads > 0 ? String(campaign.leads) : "—" },
        ].map((k) => (
          <div key={k.l} className="ui-surface px-4 py-3">
            <p className="ui-label mb-1">{k.l}</p>
            <p className="text-[18px] font-semibold text-tx-1">{k.v}</p>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {total > 0 && (
        <div className="px-5 pb-3 max-w-[960px] mx-auto w-full">
          <div className="ui-surface px-4 py-3">
            <div className="flex justify-between text-[11px] mb-2">
              <span className="font-medium text-tx-1">Бюджет</span>
              <span className="text-tx-3">
                {fmt(spent)} из {fmt(total)} · {pct}%
              </span>
            </div>
            <div className="h-1.5 bg-track rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-5 border-b border-line flex-wrap justify-center">
        {(
          [
            { k: "info",       l: "Инфо" },
            { k: "schedule",   l: "Запланировать" },
            { k: "history",    l: "История" },
            { k: "landing",    l: "Лендинг" },
            { k: "content",    l: "Контент ✦" },
            { k: "platforms",  l: "Платформы" },
          ] as { k: TabKey; l: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setActiveTab(t.k)}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === t.k
                ? "border-accent text-accent"
                : "border-transparent text-tx-3 hover:text-tx-1"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="flex-1 p-5">
        {/* Info */}
        {activeTab === "info" && (
          <div className="grid grid-cols-2 gap-4 max-w-[720px] mx-auto">
            {/* Platforms card — spans 2 cols */}
            <div className="ui-surface p-4 col-span-2">
              <div className="flex items-center justify-between mb-3">
                <p className="ui-label">Платформы</p>
                {!editingPlatforms ? (
                  <button
                    onClick={() => { setPlatformsDraft([...(campaign.platforms ?? [])]); setEditingPlatforms(true); }}
                    className="text-[11px] text-accent hover:opacity-80 cursor-pointer"
                  >
                    + Изменить
                  </button>
                ) : null}
              </div>
              {editingPlatforms ? (
                <div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
                    {[
                      { group: "Соцсети", items: [
                        { id: "instagram", name: "Instagram" },
                        { id: "telegram",  name: "Telegram" },
                        { id: "tiktok",    name: "TikTok" },
                        { id: "youtube",   name: "YouTube" },
                      ]},
                      { group: "Рекл. кабинеты", items: [
                        { id: "meta",    name: "Meta Ads" },
                        { id: "google",  name: "Google Ads" },
                        { id: "yandex",  name: "Яндекс Директ" },
                      ]},
                    ].map(({ group, items }) => (
                      <div key={group}>
                        <p className="text-[10px] text-tx-3 mb-2 uppercase tracking-wider">{group}</p>
                        <div className="space-y-1.5">
                          {items.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={platformsDraft.includes(p.id)}
                                onChange={(e) =>
                                  setPlatformsDraft(e.target.checked
                                    ? [...platformsDraft, p.id]
                                    : platformsDraft.filter((x) => x !== p.id))
                                }
                                className="accent-accent"
                              />
                              <span className="text-[11px] text-tx-1 flex items-center gap-1.5">
                                <span
                                  style={{ width: 12, height: 12, borderRadius: 2, background: PLATFORM_META[p.id]?.color, display: "inline-block", flexShrink: 0 }}
                                />
                                {p.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-line">
                    <button
                      onClick={() => setEditingPlatforms(false)}
                      className="flex-1 py-2 border border-line rounded-[7px] text-[11px] text-tx-2 hover:bg-hover cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={async () => { await updateCampaign.mutateAsync({ platforms: platformsDraft }); setEditingPlatforms(false); }}
                      disabled={updateCampaign.isPending}
                      className="flex-1 py-2 bg-accent text-on-accent text-[11px] font-medium rounded-[7px] hover:opacity-90 cursor-pointer disabled:opacity-50"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {campaignPlatforms.length === 0 ? (
                    <p className="text-[11px] text-tx-3">Нет платформ</p>
                  ) : campaignPlatforms.map((pid: string) => {
                    const pm = PLATFORM_META[pid];
                    return pm ? (
                      <div key={pid} className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] border border-line text-[10px] text-tx-1">
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: pm.color, display: "inline-block", flexShrink: 0 }} />
                        {pm.name}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="ui-surface p-4">
              <p className="ui-label mb-3">Основное</p>
              {[
                ["Название", campaign.name],
                ["Цель", campaign.goal ?? "—"],
                ["Описание", campaign.description ?? "—"],
                ["Статус", STATUS_LABEL[campaign.status] ?? campaign.status],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px] py-1.5 border-b border-line last:border-0">
                  <span className="text-tx-3">{l}</span>
                  <span className="font-medium text-tx-1 text-right max-w-[200px] truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="ui-surface p-4">
              <p className="ui-label mb-3">Показатели</p>
              {[
                ["Показов",  (campaign.impressions ?? 0).toLocaleString("ru")],
                ["Кликов",   (campaign.clicks ?? 0).toLocaleString("ru")],
                ["Заявок",   String(campaign.leads ?? 0)],
                ["Продаж",   String(campaign.sales ?? 0)],
                ["Доход",    fmt(campaign.revenue ?? 0)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px] py-1.5 border-b border-line last:border-0">
                  <span className="text-tx-3">{l}</span>
                  <span className="font-medium text-tx-1">{v}</span>
                </div>
              ))}
            </div>

            {/* Real leads from landing */}
            <div className="ui-surface p-4 col-span-2">
              <p className="ui-label mb-3">Конверсии с лендинга</p>
              {!leadsData || leadsData.landing_id === null ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="text-[12px] font-medium text-tx-1 mb-1">Лендинг не привязан</p>
                  <p className="text-[11px] text-tx-3 mb-3 max-w-[360px]">
                    Привяжите лендинг на вкладке «Лендинг» — mvira начнёт считать реальные заявки из БД
                  </p>
                  <button
                    onClick={() => setActiveTab("landing")}
                    className="px-4 py-1.5 text-[11px] font-medium bg-accent text-on-accent rounded-[7px] hover:opacity-90 cursor-pointer"
                  >
                    Привязать лендинг
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-[28px] font-bold text-tx-1">{leadsData.total}</div>
                    <div>
                      <p className="text-[11px] font-medium text-tx-1">заявок всего</p>
                      <p className="text-[10px] text-tx-3">из формы на лендинге</p>
                    </div>
                  </div>
                  {leadsData.breakdown.length > 0 ? (
                    <div>
                      <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-2">Источники (utm_source)</p>
                      <div className="space-y-1.5">
                        {leadsData.breakdown.map((row: { source: string; count: number }) => {
                          const pct = leadsData.total > 0 ? Math.round((row.count / leadsData.total) * 100) : 0;
                          return (
                            <div key={row.source} className="flex items-center gap-2 text-[11px]">
                              <span className="text-tx-3 w-28 truncate">{row.source}</span>
                              <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-medium text-tx-1 w-6 text-right">{row.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-tx-3">UTM-метки не переданы — все заявки отмечены как «прямой»</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule */}
        {activeTab === "schedule" && (
          <div className="max-w-[480px] mx-auto">
            <p className="text-[12px] text-tx-2 mb-4">Выберите черновик и запланируйте публикацию</p>
            {(creatives as any[]).filter((c: any) => c.status === "draft").length === 0 ? (
              <div className="ui-surface flex flex-col items-center py-10 text-center">
                <p className="text-[11px] text-tx-3">Нет черновиков для планирования</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(creatives as any[]).filter((c: any) => c.status === "draft").map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => setScheduleModal(c)}
                    className="ui-surface px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-line-strong"
                  >
                    <div
                      style={{
                        width: 22, height: 16, borderRadius: 3,
                        background: PLATFORM_META[c.platform]?.color ?? "#333",
                        color: "#fff", fontSize: 8, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {PLATFORM_META[c.platform]?.abbr ?? "?"}
                    </div>
                    <p className="text-[12px] font-medium text-tx-1 flex-1 truncate">{c.title ?? "Без названия"}</p>
                    <span className="text-[11px] text-accent">📅 Запланировать →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === "history" && (
          <div className="max-w-[560px] mx-auto">
            <div className="ui-surface flex flex-col items-center py-14 text-center">
              <Clock size={28} className="text-tx-3 mb-3" strokeWidth={1.2} />
              <p className="text-[13px] font-medium text-tx-1 mb-1">История изменений</p>
              <p className="text-[11px] text-tx-3">Все действия с кампанией будут отображаться здесь</p>
            </div>
          </div>
        )}

        {/* Landing */}
        {activeTab === "landing" && (() => {
          const publishedLandings = (landings as any[]).filter((l: any) => l.published);
          const selectedLanding = (landings as any[]).find((l: any) => l.id === landingId) ?? null;

          return (
            <div className="max-w-[680px] mx-auto">
              {selectedLanding && (
                <div className="ui-surface p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="ui-label">Текущий лендинг</p>
                    <button
                      onClick={() => selectLanding(null)}
                      disabled={landingUpdating}
                      className="text-[11px] text-tx-3 hover:text-neg cursor-pointer disabled:opacity-50"
                    >
                      Отвязать
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[8px] bg-accent/10 border border-accent/20 flex items-center justify-center text-lg">
                      🌐
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-tx-1 truncate">{selectedLanding.title}</p>
                      {selectedLanding.slug && (
                        <p className="text-[10px] text-tx-3">/l/{selectedLanding.slug}</p>
                      )}
                    </div>
                    <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-chip text-green-500 flex-shrink-0">
                      Привязан
                    </span>
                  </div>
                </div>
              )}

              <p className="ui-label mb-3">{selectedLanding ? "Изменить лендинг" : "Выбрать лендинг"}</p>
              {publishedLandings.length === 0 ? (
                <div className="ui-surface flex flex-col items-center py-12 text-center">
                  <p className="text-[13px] font-medium text-tx-1 mb-1">Нет опубликованных лендингов</p>
                  <p className="text-[11px] text-tx-3 mb-4">Создайте и опубликуйте лендинг, чтобы привязать его к кампании</p>
                  <button
                    onClick={() => router.push(`/${locale}/landings/create`)}
                    className="px-4 py-2 bg-accent text-on-accent text-[12px] font-medium rounded-[7px] hover:opacity-90 cursor-pointer"
                  >
                    + Создать лендинг
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {publishedLandings.map((lp: any) => {
                    const isSelected = landingId === lp.id;
                    return (
                      <button
                        key={lp.id}
                        onClick={() => selectLanding(lp.id)}
                        disabled={landingUpdating}
                        className={`flex flex-col gap-2 p-3 border rounded-[10px] text-left transition-colors cursor-pointer disabled:opacity-50 hover:border-line-strong ${
                          isSelected ? "border-accent bg-accent/5" : "border-line bg-panel-2"
                        }`}
                      >
                        <div className="w-full h-16 rounded-[6px] bg-bg flex items-center justify-center text-2xl">
                          🌐
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-tx-1 truncate">{lp.title}</p>
                          {lp.slug && <p className="text-[10px] text-tx-3 truncate">/l/{lp.slug}</p>}
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-medium text-accent">✓ Выбран</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Content ✦ */}
        {activeTab === "content" && (() => {
          const filteredCreatives = generatedCreatives.filter((c: any) =>
            creativeFilter === "all" || c.platform === creativeFilter
          );
          const uniquePlatforms = Array.from(
            new Set(generatedCreatives.map((c: any) => c.platform))
          ) as string[];

          return (
            <div>
              {/* Section tabs */}
              <div className="flex gap-2 mb-5 justify-center">
                {(
                  [
                    { k: "social" as const, l: "Соцсети",             platforms: socialPlatforms, approved: socialPlanApproved },
                    { k: "ads" as const,    l: "Рекламные кабинеты",   platforms: adsPlatforms,   approved: adsPlanApproved },
                  ]
                ).map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setActiveContentSection(s.k)}
                    className={`px-4 py-2 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer ${
                      activeContentSection === s.k
                        ? "bg-accent text-on-accent"
                        : "border border-line text-tx-2 hover:bg-hover"
                    }`}
                  >
                    {s.l}
                    {s.platforms.length > 0 && (
                      <span className="ml-1 text-[10px] opacity-70">({s.platforms.length})</span>
                    )}
                    {activeContentSection !== s.k && s.approved && (
                      <span className="ml-1 text-[9px] text-green-500">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Active section plan area */}
              <div className="max-w-[680px] mx-auto mb-6">
                {activeContentSection === "social"
                  ? renderPlanSection(
                      "social", socialPlan, socialPlanLoading, socialPlanError, socialPlanApproved,
                      setSocialPlan, setSocialPlanApproved, generateSocialPlan, generateFromSocialPlan
                    )
                  : renderPlanSection(
                      "ads", adsPlan, adsPlanLoading, adsPlanError, adsPlanApproved,
                      setAdsPlan, setAdsPlanApproved, generateAdsPlan, generateFromAdsPlan
                    )}
              </div>

              {/* Generated content cards */}
              {generatedCreatives.length > 0 && (
                <div className="max-w-[960px] mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-medium text-tx-2">
                      Сгенерированный контент · {generatedCreatives.length}
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        ["all", "Все"],
                        ...uniquePlatforms.map((p) => [p, PLATFORM_META[p]?.name ?? p]),
                      ].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setCreativeFilter(val as string)}
                          className={`px-2.5 py-1 rounded-[6px] text-[10px] cursor-pointer ${
                            creativeFilter === val
                              ? "bg-accent text-on-accent"
                              : "border border-line text-tx-3 hover:bg-hover"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredCreatives.map((c: any) => {
                      const meta = PLATFORM_META[c.platform];
                      const isSearch = c.platform === "google" || c.platform === "yandex";
                      const isMeta = c.platform === "meta";
                      const isInstagram = c.platform === "instagram";
                      const isTelegram = c.platform === "telegram";
                      const isTikTok = c.platform === "tiktok";
                      const isYoutube = c.platform === "youtube";
                      const title =
                        c.headline ?? c.caption?.slice(0, 80) ??
                        c.hook?.slice(0, 80) ?? c.text?.slice(0, 80) ?? "—";
                      return (
                        <div key={c.id} className="ui-surface flex flex-col overflow-hidden">
                          {/* Colored platform header stripe */}
                          <div
                            className="px-3 py-2 flex items-center gap-2"
                            style={{ background: meta?.color ?? "#444" }}
                          >
                            <span className="text-[10px] font-bold text-white">
                              {meta?.abbr ?? c.platform?.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-white/80 flex-1">{meta?.name ?? c.platform}</span>
                            {c.subtype && (
                              <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                                {c.subtype}
                              </span>
                            )}
                          </div>

                          {/* Platform-specific content */}
                          <div className="p-3 flex flex-col gap-1.5 flex-1">
                            {isSearch && (
                              <>
                                {/* Google: headlines array */}
                                {c.headlines && (c.headlines as string[]).slice(0, 3).map((h: string, i: number) => (
                                  <p key={i} className="text-[11px] font-medium text-blue-500 leading-snug">{h}</p>
                                ))}
                                {/* Yandex: single headline */}
                                {!c.headlines && c.headline && (
                                  <p className="text-[11px] font-medium text-blue-500 leading-snug">{c.headline}</p>
                                )}
                                {c.url && <p className="text-[9px] text-pos truncate">{c.url}</p>}
                                {/* Google: descriptions array */}
                                {c.descriptions && (c.descriptions as string[]).slice(0, 2).map((d: string, i: number) => (
                                  <p key={i} className="text-[10px] text-tx-2 leading-relaxed">{d}</p>
                                ))}
                                {/* Yandex: text field */}
                                {!c.descriptions && c.text && (
                                  <p className="text-[10px] text-tx-2 leading-relaxed">{c.text}</p>
                                )}
                              </>
                            )}
                            {isMeta && (
                              <>
                                {c.headline && <p className="text-[11px] font-semibold text-tx-1">{c.headline}</p>}
                                {(c.body ?? c.caption) && <p className="text-[10px] text-tx-2 leading-relaxed line-clamp-3">{c.body ?? c.caption}</p>}
                                {c.cta && <p className="text-[9px] text-tx-3">CTA: {c.cta}</p>}
                              </>
                            )}
                            {isInstagram && (
                              <>
                                {c.caption && <p className="text-[10px] text-tx-1 leading-relaxed line-clamp-4">{c.caption}</p>}
                                {c.hashtags && <p className="text-[9px] text-accent truncate">{(c.hashtags as string[]).slice(0, 5).join(" ")}</p>}
                              </>
                            )}
                            {isTelegram && (
                              <>
                                {c.text && <p className="text-[10px] text-tx-1 leading-relaxed line-clamp-4">{c.text}</p>}
                                {c.emoji && <p className="text-[14px]">{c.emoji}</p>}
                              </>
                            )}
                            {isTikTok && (
                              <>
                                {c.hook && <p className="text-[11px] font-semibold text-tx-1 leading-snug">{c.hook}</p>}
                                {c.description && <p className="text-[10px] text-tx-2 leading-relaxed line-clamp-3">{c.description}</p>}
                                {c.hashtags && <p className="text-[9px] text-accent truncate">{(c.hashtags as string[]).slice(0, 4).join(" ")}</p>}
                              </>
                            )}
                            {isYoutube && (
                              <>
                                {(c.title ?? c.headline) && <p className="text-[11px] font-semibold text-tx-1 leading-snug">{c.title ?? c.headline}</p>}
                                {c.description && <p className="text-[10px] text-tx-2 leading-relaxed line-clamp-3">{c.description}</p>}
                              </>
                            )}
                            {!isSearch && !isMeta && !isInstagram && !isTelegram && !isTikTok && !isYoutube && (
                              <p className="text-[11px] text-tx-1 leading-relaxed line-clamp-3">{title}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 px-3 pb-3 pt-2 border-t border-line">
                            <button
                              onClick={() => setScheduleModal({ id: c.id, platform: c.platform, title })}
                              className="flex-1 py-1.5 border border-line rounded-[6px] text-[10px] text-tx-2 hover:bg-hover cursor-pointer"
                            >
                              📅 Запланировать
                            </button>
                            <button
                              onClick={async () => {
                                if (!c.id || publishingNow === c.id) return;
                                setPublishingNow(c.id);
                                setPublishResult(null);
                                try {
                                  const res = await fetch(
                                    `/api/campaigns/${id}/creatives/publish`,
                                    {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ creativeId: c.id }),
                                    }
                                  );
                                  const data = await res.json();
                                  if (res.ok) {
                                    setPublishResult({ id: c.id, ok: true, msg: data.via === "make" ? "Отправлено в Make.com" : "Опубликовано!" });
                                    refetchCreatives();
                                  } else {
                                    setPublishResult({ id: c.id, ok: false, msg: data.error ?? "Ошибка публикации" });
                                  }
                                } catch {
                                  setPublishResult({ id: c.id, ok: false, msg: "Ошибка сети" });
                                } finally {
                                  setPublishingNow(null);
                                  setTimeout(() => setPublishResult(null), 5000);
                                }
                              }}
                              disabled={publishingNow === c.id}
                              className="flex-1 py-1.5 bg-accent text-on-accent rounded-[6px] text-[10px] font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
                            >
                              {publishingNow === c.id ? "⟳ Публикую..." : "▶ Опубликовать"}
                            </button>
                            {publishResult?.id === c.id && (
                              <p className={`w-full text-center text-[9px] mt-1 ${publishResult?.ok ? "text-green-500" : "text-red-400"}`}>
                                {publishResult?.ok ? "✓" : "✕"} {publishResult?.msg}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {generatedCreatives.length === 0 && !generating && (() => {
                const activePlan = activeContentSection === "social" ? socialPlan : adsPlan;
                const activePlanApproved = activeContentSection === "social" ? socialPlanApproved : adsPlanApproved;
                const activePlanLoading = activeContentSection === "social" ? socialPlanLoading : adsPlanLoading;
                const doActivePlan = activeContentSection === "social" ? generateSocialPlan : generateAdsPlan;
                const doActiveFromPlan = activeContentSection === "social" ? generateFromSocialPlan : generateFromAdsPlan;
                const step1Done = !!activePlan;
                const step2Done = activePlanApproved;
                const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3;
                const steps = [
                  { n: 1, label: "Создай план", desc: "AI составит список форматов и количество постов под твою кампанию" },
                  { n: 2, label: "Утверди план", desc: "Просмотри что предлагает AI и скорректируй если нужно" },
                  { n: 3, label: "Получи контент", desc: "AI напишет тексты и заголовки для каждой платформы" },
                ];
                return (
                  <div className="max-w-[540px] mx-auto mt-4">
                    {/* Step tracker */}
                    <div className="flex items-center gap-0 mb-8">
                      {steps.map((s, i) => (
                        <div key={s.n} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors"
                              style={{
                                background: s.n < currentStep ? "var(--accent)" : s.n === currentStep ? "var(--accent)" : "var(--line)",
                                color: s.n <= currentStep ? "var(--on-accent)" : "var(--tx-3)",
                                opacity: s.n > currentStep ? 0.5 : 1,
                              }}
                            >
                              {s.n < currentStep ? "✓" : s.n}
                            </div>
                            <span className="text-[10px] font-medium text-center" style={{ color: s.n === currentStep ? "var(--tx-1)" : "var(--tx-3)", whiteSpace: "nowrap" }}>{s.label}</span>
                          </div>
                          {i < steps.length - 1 && (
                            <div className="flex-1 h-[1px] mx-2 mb-5" style={{ background: s.n < currentStep ? "var(--accent)" : "var(--line)" }} />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Active step card */}
                    <div className="ui-surface p-5 text-center">
                      <p className="text-[13px] font-semibold text-tx-1 mb-2">{steps[currentStep - 1].desc}</p>
                      {currentStep === 1 && (
                        <button
                          onClick={doActivePlan}
                          disabled={activePlanLoading}
                          className="mt-3 px-6 py-2.5 bg-accent text-on-accent text-[12px] font-semibold rounded-[8px] hover:opacity-90 cursor-pointer disabled:opacity-50"
                        >
                          {activePlanLoading ? "⟳ Создаю план..." : "✦ Создать план"}
                        </button>
                      )}
                      {currentStep === 2 && (
                        <button
                          onClick={() => openPlanModal(activeContentSection)}
                          className="mt-3 px-6 py-2.5 bg-accent text-on-accent text-[12px] font-semibold rounded-[8px] hover:opacity-90 cursor-pointer"
                        >
                          📋 Просмотреть и утвердить план
                        </button>
                      )}
                      {currentStep === 3 && (
                        <button
                          onClick={doActiveFromPlan}
                          disabled={generating}
                          className="mt-3 px-6 py-2.5 bg-accent text-on-accent text-[12px] font-semibold rounded-[8px] hover:opacity-90 cursor-pointer disabled:opacity-50"
                        >
                          {generating ? "⟳ Генерирую..." : "🎨 Создать контент по плану"}
                        </button>
                      )}
                    </div>

                    {/* Platform preview chips */}
                    {(activeContentSection === "social" ? socialPlatforms : adsPlatforms).length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {(activeContentSection === "social" ? socialPlatforms : adsPlatforms).map((p: string) => (
                          <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border border-line text-tx-2">
                            <span
                              className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[6px] font-bold text-white"
                              style={{ background: PLATFORM_META[p]?.color ?? "#888" }}
                            >{PLATFORM_META[p]?.abbr ?? p.slice(0,2).toUpperCase()}</span>
                            {PLATFORM_META[p]?.name ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Platforms tab */}
        {activeTab === "platforms" && (() => {
          const AD_PLATFORM_DEFS = [
            { key: "meta",     name: "Meta Ads",      color: "#1877F2", abbr: "M",  realOAuth: true },
            { key: "google",   name: "Google Ads",    color: "#34A853", abbr: "G",  realOAuth: true },
            { key: "yandex",   name: "Яндекс Директ", color: "#FFDB4D", textColor: "#664400", abbr: "Я", realOAuth: true },
            { key: "vk",       name: "VK Реклама",    color: "#0077FF", abbr: "VK", realOAuth: false },
            { key: "tiktok",   name: "TikTok Ads",    color: "#010101", abbr: "TT", realOAuth: false },
            { key: "mytarget", name: "myTarget",      color: "#FF6600", abbr: "MT", realOAuth: false },
          ];

          const returnTo = `/${locale}/campaigns/${id}?tab=platforms`;

          const connectMeta = () => {
            const params = new URLSearchParams({
              client_id: process.env.NEXT_PUBLIC_META_APP_ID ?? "",
              redirect_uri: process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? "",
              scope: "ads_read,ads_management,leads_retrieval,business_management",
              response_type: "code",
              state: JSON.stringify({ source: "meta_ads", returnTo }),
            });
            window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
          };

          const connectGoogle = () => {
            const params = new URLSearchParams({
              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
              redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ?? "",
              scope: "https://www.googleapis.com/auth/adwords",
              response_type: "code",
              access_type: "offline",
              prompt: "consent",
              state: JSON.stringify({ returnTo }),
            });
            window.location.href = `https://accounts.google.com/o/oauth2/auth?${params}`;
          };

          const connectYandex = () => {
            const params = new URLSearchParams({
              response_type: "code",
              client_id: process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "",
              redirect_uri: process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI ?? "",
              state: JSON.stringify({ returnTo }),
            });
            window.location.href = `https://oauth.yandex.ru/authorize?${params}`;
          };

          return (
            <div className="max-w-[600px] mx-auto space-y-3">
              <p className="text-[11px] text-tx-3 mb-4">
                Подключите рекламные кабинеты — после подключения вернётесь сюда автоматически.
              </p>
              {AD_PLATFORM_DEFS.map((def) => {
                const connected = (adPlatforms as any[]).find(
                  (p: any) => p.platform_key === def.key && p.is_active
                );
                return (
                  <div
                    key={def.key}
                    className={`flex items-center gap-3 p-4 rounded-[10px] border ${connected ? "border-accent/30 bg-chip/30" : "border-line bg-panel-2"}`}
                  >
                    <div
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                      style={{ background: def.color, color: (def as any).textColor ?? "#fff" }}
                    >
                      {def.abbr}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-tx-1">{def.name}</p>
                      {connected && (
                        <p className="text-[10px] text-tx-3 mt-0.5">
                          {connected.account_id ? `Аккаунт: ${connected.account_id}` : "Подключён"}
                        </p>
                      )}
                    </div>
                    {connected ? (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-chip text-pos font-medium">
                        Подключён ✓
                      </span>
                    ) : def.realOAuth ? (
                      <button
                        onClick={def.key === "meta" ? connectMeta : def.key === "google" ? connectGoogle : connectYandex}
                        className="px-3 py-1.5 bg-accent text-on-accent text-[11px] font-medium rounded-[7px] hover:opacity-90 cursor-pointer"
                      >
                        Подключить
                      </button>
                    ) : (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-panel border border-line text-tx-3">
                        Скоро
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Plan modal */}
      {planModal && planModalEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={closePlanModal} />
          <div className="relative w-full max-w-[520px] bg-panel border border-line rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-line flex-shrink-0">
              <h2 className="text-[14px] font-semibold text-tx-1">
                {planModal === "social" ? "План — Соцсети" : "План — Рекламные кабинеты"}
              </h2>
              <button onClick={closePlanModal} className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-line hover:bg-hover cursor-pointer text-tx-3 text-[14px]">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {planModalEdit.strategy && (
                <div className="p-3 bg-accent/5 border border-accent/15 rounded-[8px]">
                  <p className="text-[10px] font-semibold text-tx-3 uppercase tracking-wider mb-1">Стратегия</p>
                  <p className="text-[11px] text-tx-2 leading-relaxed">{planModalEdit.strategy}</p>
                </div>
              )}
              {Object.entries(
                planModal === "social"
                  ? (planModalEdit.socialMedia ?? {})
                  : (planModalEdit.adPlatforms ?? {})
              ).map(([platform, data]: [string, any]) => (
                <div key={platform} className="ui-surface p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                      style={{ background: PLATFORM_META[platform]?.color ?? "#888" }}
                    >
                      {PLATFORM_META[platform]?.abbr ?? platform.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-[12px] font-medium text-tx-1">{PLATFORM_META[platform]?.name ?? platform}</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(data)
                      .filter(([k, v]) => k !== "reasoning" && typeof v === "number")
                      .map(([subtype, count]) => (
                        <div key={subtype} className="flex items-center justify-between">
                          <span className="text-[11px] text-tx-3">{subtype}</span>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={String(count)}
                            onChange={(e) => {
                              const newVal = Math.max(0, parseInt(e.target.value) || 0);
                              setPlanModalEdit((prev: any) => {
                                const next = JSON.parse(JSON.stringify(prev));
                                const sec = planModal === "social" ? "socialMedia" : "adPlatforms";
                                next[sec][platform][subtype] = newVal;
                                return next;
                              });
                            }}
                            className="w-16 px-2 py-1 text-[11px] text-center rounded-[6px] border border-line bg-bg text-tx-1 outline-none focus:border-accent"
                          />
                        </div>
                      ))}
                  </div>
                  {data.reasoning && (
                    <p className="text-[10px] text-tx-3 mt-2 italic leading-relaxed">{data.reasoning}</p>
                  )}
                </div>
              ))}
              {planModalEdit.postingSchedule && (
                <div>
                  <p className="text-[10px] font-semibold text-tx-3 uppercase tracking-wider mb-1">График</p>
                  <p className="text-[11px] text-tx-2 leading-relaxed">{planModalEdit.postingSchedule}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 p-4 border-t border-line flex-shrink-0">
              <button onClick={closePlanModal} className="flex-1 py-2.5 border border-line rounded-[7px] text-[12px] text-tx-2 hover:bg-hover cursor-pointer">
                Закрыть
              </button>
              <button onClick={applyPlanEdit} className="flex-1 py-2.5 bg-accent text-on-accent text-[12px] font-medium rounded-[7px] hover:opacity-90 cursor-pointer">
                ✓ Применить и утвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
            onClick={() => setScheduleModal(null)}
          />
          <div className="relative w-full max-w-[380px] bg-panel border border-line rounded-[14px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-semibold text-tx-1">Запланировать</h2>
              <button
                onClick={() => setScheduleModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] border border-line hover:bg-hover cursor-pointer text-tx-3 text-[14px]"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-tx-3 mb-4">
              {scheduleModal.title ?? "Без названия"} · {scheduleModal.platform}
            </p>
            <div className="mb-4">
              <label className="block ui-label mb-1">Дата и время</label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className={inp}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setScheduleModal(null)}
                className="flex-1 py-2.5 border border-line rounded-[7px] text-[12px] text-tx-2 hover:bg-hover cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleSchedule}
                disabled={!scheduleTime || scheduling}
                className="flex-1 py-2.5 bg-accent text-on-accent text-[12px] font-medium rounded-[7px] hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {scheduling ? "..." : "📅 Запланировать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
