"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw, AlertCircle, Pencil, Check, X, Trash2 } from "lucide-react";

const PLATFORM_META: Record<
  string,
  { name: string; abbr: string; color: string; textColor?: string }
> = {
  meta: { name: "Meta Ads", abbr: "M", color: "#1877F2" },
  google: { name: "Google Ads", abbr: "G", color: "#34A853" },
  yandex: { name: "Яндекс Директ", abbr: "Я", color: "#FFDB4D", textColor: "#664400" },
};

const OAUTH_URLS: Record<string, () => string> = {
  meta: () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? "",
      scope: "ads_management,ads_read,leads_retrieval",
      response_type: "code",
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  },
  google: () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ?? "",
      scope: "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email",
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  yandex: () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI ?? "",
      response_type: "code",
      scope: "direct:api",
    });
    return `https://oauth.yandex.ru/authorize?${params}`;
  },
};

function fmt(n: number) {
  if (!n) return "0";
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1000)}K` : String(Math.round(n));
}

function fmtRub(n: number) {
  if (!n) return "₽0";
  return `₽${n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? Math.round(n / 1000) + "K" : Math.round(n)}`;
}

function Skeleton({ w, h }: { w?: string; h?: string }) {
  return (
    <div style={{ width: w ?? "100%", height: h ?? "16px", borderRadius: 6, background: "var(--chip)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function MetricCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--tx-3)", fontWeight: 500 }}>{label}</span>
      {loading ? <Skeleton h="28px" w="70%" /> : (
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--tx-1)", lineHeight: 1 }}>{value}</span>
      )}
      {sub && !loading && <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{sub}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: isActive ? "color-mix(in srgb, var(--pos) 15%, transparent)" : "color-mix(in srgb, var(--tx-3) 15%, transparent)", color: isActive ? "var(--pos)" : "var(--tx-3)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? "var(--pos)" : "var(--tx-3)" }} />
      {isActive ? "Активна" : "Пауза"}
    </span>
  );
}

function NotConnectedOverlay({ platform, onConnect }: { platform: string; onConnect: () => void }) {
  const meta = PLATFORM_META[platform];
  return (
    <div style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--bg) 80%, transparent)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: meta?.color ?? "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: meta?.textColor ?? "#fff" }}>
        {meta?.abbr ?? "?"}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>{meta?.name ?? platform} не подключён</p>
        <p style={{ fontSize: 14, color: "var(--tx-2)", marginTop: 8 }}>Подключи кабинет чтобы видеть статистику и управлять кампаниями</p>
      </div>
      <button onClick={onConnect} style={{ padding: "10px 24px", borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
        Подключить {meta?.name ?? platform}
      </button>
    </div>
  );
}

function PlatformDetailPageInner() {
  const { platform } = useParams() as { platform: string };
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id");
  const router = useRouter();
  const locale = useLocale();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");

  const meta = PLATFORM_META[platform];

  const { data: allPlatforms = [] } = useQuery({
    queryKey: ["ad_platforms_real"],
    queryFn: async () => {
      const res = await fetch("/api/ad-platforms");
      return res.ok ? (res.json() as Promise<any[]>) : [];
    },
    staleTime: 60_000,
  });

  const thisAccount = accountId
    ? (allPlatforms as any[]).find((p: any) => p.id === accountId)
    : (allPlatforms as any[]).find((p: any) => p.platform_key === platform);

  const displayName = thisAccount?.label ?? meta?.name ?? platform;

  const renameMutation = useMutation({
    mutationFn: async (label: string) => {
      if (!thisAccount?.id) return;
      await fetch(`/api/ad-platforms/${thisAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad_platforms_real"] });
      setEditingLabel(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!thisAccount?.id) return;
      await fetch(`/api/ad-platforms/${thisAccount.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      router.push(`/${locale}/integrations?tab=ads`);
    },
  });

  const statsUrl = accountId
    ? `/api/ad-platforms/${platform}/stats?period=${period}&id=${accountId}`
    : `/api/ad-platforms/${platform}/stats?period=${period}`;

  const campaignsUrl = accountId
    ? `/api/ad-platforms/${platform}/campaigns?id=${accountId}`
    : `/api/ad-platforms/${platform}/campaigns`;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["ad_platform_stats", platform, period, refreshKey, accountId],
    queryFn: async () => {
      const res = await fetch(statsUrl);
      if (!res.ok) throw new Error("stats error");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["ad_platform_campaigns", platform, refreshKey, accountId],
    queryFn: async () => {
      const res = await fetch(campaignsUrl);
      if (!res.ok) throw new Error("campaigns error");
      return res.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const connected = stats?.connected !== false && campaignsData?.connected !== false;
  const campaigns: any[] = campaignsData?.campaigns ?? [];
  const isMock = stats?.isMock || campaignsData?.isMock;
  const noData = stats?.no_data || campaignsData?.no_data;

  function handleConnect() {
    const urlFn = OAUTH_URLS[platform];
    if (urlFn) window.location.href = urlFn();
  }

  function startRename() {
    setLabelInput(displayName);
    setEditingLabel(true);
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => router.push(`/${locale}/integrations?tab=ads`)}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "transparent", color: "var(--tx-2)", cursor: "pointer", fontSize: 13 }}
        >
          <ChevronLeft size={15} />
          Кабинеты
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: meta?.color ?? "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: meta?.textColor ?? "#fff", flexShrink: 0 }}>
            {meta?.abbr ?? platform[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            {editingLabel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameMutation.mutate(labelInput);
                    if (e.key === "Escape") setEditingLabel(false);
                  }}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid var(--accent)", background: "var(--panel)", color: "var(--tx-1)", fontSize: 18, fontWeight: 700, fontFamily: "inherit", outline: "none", width: 240 }}
                />
                <button onClick={() => renameMutation.mutate(labelInput)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "none", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" }}>
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingLabel(false)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--tx-3)", cursor: "pointer" }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </h1>
                <button onClick={startRename} title="Переименовать" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--tx-3)", cursor: "pointer", flexShrink: 0 }}>
                  <Pencil size={11} />
                </button>
              </div>
            )}
            {stats?.connected && !editingLabel && (
              <span style={{ fontSize: 12, color: "var(--pos)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pos)", display: "inline-block" }} />
                Подключён
                {thisAccount?.account_id && ` · ${thisAccount.account_id}`}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 2, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 3 }}>
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: period === p ? "var(--accent)" : "transparent", color: period === p ? "var(--on-accent)" : "var(--tx-2)", transition: "background 0.15s" }}
              >
                {p === "7d" ? "7 дней" : p === "30d" ? "30 дней" : "90 дней"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Обновить"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid var(--line)", borderRadius: 8, background: "transparent", color: "var(--tx-2)", cursor: "pointer" }}
          >
            <RefreshCw size={14} />
          </button>

          {thisAccount && (
            <button
              onClick={() => {
                if (confirm("Отключить этот рекламный кабинет?")) deleteMutation.mutate();
              }}
              title="Отключить"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "1px solid color-mix(in srgb, var(--neg) 40%, transparent)", borderRadius: 8, background: "transparent", color: "var(--neg)", cursor: "pointer" }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* No-data notice for unsupported platforms */}
      {noData && connected && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "var(--tx-3)" }}>
          Статистика для этой платформы появится позже — интеграция скоро
        </div>
      )}
      {isMock && !noData && connected && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "var(--tx-2)" }}>
          <AlertCircle size={14} style={{ color: "var(--accent)" }} />
          Тестовые данные — реальная API не вернула результаты
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
        <MetricCard label="Расход" value={fmtRub(stats?.spend ?? 0)} loading={statsLoading} />
        <MetricCard label="Показы" value={fmt(stats?.impressions ?? 0)} loading={statsLoading} />
        <MetricCard label="Клики" value={fmt(stats?.clicks ?? 0)} loading={statsLoading} />
        <MetricCard label="Лидов" value={fmt(stats?.leads ?? 0)} loading={statsLoading} />
        <MetricCard label="CTR" value={`${stats?.ctr ?? 0}%`} sub={`Конверсия ${stats?.conversion ?? 0}%`} loading={statsLoading} />
      </div>

      {/* Campaigns table */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>Кампании</span>
          {noData && <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Скоро</span>}
        </div>

        {campaignsLoading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Skeleton w="30%" h="14px" />
                <Skeleton w="10%" h="14px" />
                <Skeleton w="10%" h="14px" />
                <Skeleton w="10%" h="14px" />
                <Skeleton w="10%" h="14px" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--tx-3)", fontSize: 14 }}>Нет кампаний</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Название", "Статус", "Расход", "Показы", "Клики", "CTR", "Лиды"].map((h) => (
                  <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, idx) => (
                <tr key={c.id ?? idx} style={{ borderBottom: idx < campaigns.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-1)", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-2)" }}>{fmtRub(c.spend)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-2)" }}>{fmt(c.impressions)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-2)" }}>{fmt(c.clicks)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-2)" }}>{c.ctr}%</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--tx-2)" }}>{c.leads ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Not connected overlay */}
      {!statsLoading && !campaignsLoading && !connected && (
        <NotConnectedOverlay platform={platform} onConnect={handleConnect} />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default function PlatformDetailPage() {
  return (
    <Suspense fallback={null}>
      <PlatformDetailPageInner />
    </Suspense>
  );
}
