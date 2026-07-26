"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Plus, Globe, Edit3, Trash2, Copy, Eye, EyeOff,
  FileText, ExternalLink, MessageSquare, Phone, Mail, Clock,
} from "lucide-react";
import LandingDetail from "@/components/landing/LandingDetail";

type LandingPage = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  template_id: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  views: number;
  leads_count: number;
};

type Lead = {
  id: string;
  landing_id: string;
  landing_title?: string;
  landing_slug?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export default function LandingsPage() {
  const qc = useQueryClient();
  const locale = useLocale();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"landings" | "leads">("landings");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      const { user } = await res.json();
      return user as { id: string; email: string; full_name: string };
    },
  });

  const { data: landings = [], isLoading } = useQuery({
    queryKey: ["landing_pages"],
    queryFn: async () => {
      const res = await fetch("/api/landings");
      return res.ok ? (res.json() as Promise<LandingPage[]>) : [];
    },
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["all_leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      return res.ok ? (res.json() as Promise<Lead[]>) : [];
    },
    enabled: tab === "leads",
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const res = await fetch(`/api/landings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      });
      if (!res.ok) throw new Error("Ошибка обновления");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["landing_pages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/landings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
    },
    onSuccess: () => {
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["landing_pages"] });
      qc.invalidateQueries({ queryKey: ["landings_wizard"] });
    },
  });

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/l/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const publishedCount = landings.filter((l) => l.published).length;

  if (selectedId !== null) {
    return (
      <LandingDetail
        id={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div style={{ padding: "32px 32px 64px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>Лендинги</h1>
          <p style={{ fontSize: 14, color: "var(--tx-3)", margin: "4px 0 0" }}>
            Создавайте и публикуйте посадочные страницы для рекламы
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {me && publishedCount > 0 && (
            <a
              href={`/l/u/${me.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--panel)", color: "var(--tx-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}
            >
              <Globe size={15} /> Портфолио
            </a>
          )}
          <button
            onClick={() => router.push(`/${locale}/landings/create`)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={16} /> Создать лендинг
          </button>
        </div>
      </div>

      {/* Stats row */}
      {landings.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Всего лендингов", value: landings.length, icon: "🌐" },
            { label: "Опубликовано", value: publishedCount, icon: "✅" },
            { label: "Черновиков", value: landings.length - publishedCount, icon: "📝" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "14px 16px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--panel-2)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid var(--line)" }}>
        {([
          { key: "landings", label: "Лендинги", icon: <Globe size={14} /> },
          { key: "leads",    label: "Заявки",   icon: <MessageSquare size={14} /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 7, border: "none", background: tab === t.key ? "var(--panel)" : "transparent", color: tab === t.key ? "var(--tx-1)" : "var(--tx-3)", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer", boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Landings tab ───────────────────────────────────────────── */}
      {tab === "landings" && (
        isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ height: 200, background: "var(--panel)", borderRadius: 14, border: "1px solid var(--line)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : landings.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "80px 24px", background: "var(--panel)", borderRadius: 16, border: "1px dashed var(--line)" }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={28} style={{ color: "var(--tx-3)" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--tx-1)", margin: 0 }}>Нет лендингов</p>
              <p style={{ fontSize: 14, color: "var(--tx-3)", margin: "6px 0 0" }}>Создайте первый лендинг с помощью AI</p>
            </div>
            <button onClick={() => router.push(`/${locale}/landings/create`)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <Plus size={16} /> Создать лендинг
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {landings.map((landing) => (
              <div key={landing.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }}
                onClick={() => setSelectedId(landing.id)}
              >
                <div style={{ height: 140, background: "var(--panel-2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  {landing.logo_url ? (
                    <img src={landing.logo_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <FileText size={32} style={{ color: "var(--tx-3)" }} />
                  )}
                  <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: landing.published ? "#dcfce7" : "var(--chip)", color: landing.published ? "#16a34a" : "var(--tx-3)" }}>
                    {landing.published ? "Опубликован" : "Черновик"}
                  </div>
                </div>

                <div style={{ padding: "14px 16px 12px", flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {landing.title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--tx-3)", margin: "4px 0 0" }}>
                    /l/{landing.slug} · {formatDate(landing.updated_at)}
                  </p>
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--tx-3)" }}>
                      <Eye size={12} /> {landing.views}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--tx-3)" }}>
                      <MessageSquare size={12} /> {landing.leads_count}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, padding: "0 12px 12px", borderTop: "1px solid var(--line)", paddingTop: 10 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setSelectedId(landing.id)} title="Открыть карточку" style={iconBtnStyle}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => togglePublishMutation.mutate({ id: landing.id, published: !landing.published })} title={landing.published ? "Снять с публикации" : "Опубликовать"} style={iconBtnStyle}>
                    {landing.published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copyLink(landing.slug, landing.id)} title="Скопировать ссылку"
                    style={{ ...iconBtnStyle, color: copiedId === landing.id ? "#16a34a" : undefined }}>
                    <Copy size={14} />
                  </button>
                  {landing.published && (
                    <a href={`/l/${landing.slug}`} target="_blank" rel="noopener noreferrer" title="Открыть"
                      style={{ ...iconBtnStyle, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={14} />
                    </a>
                  )}

                  <div style={{ flex: 1 }} />

                  {deletingId === landing.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => deleteMutation.mutate(landing.id)} style={{ ...iconBtnStyle, color: "var(--neg)", fontSize: 11, padding: "4px 10px", width: "auto" }}>Удалить</button>
                      <button onClick={() => setDeletingId(null)} style={{ ...iconBtnStyle, fontSize: 11, padding: "4px 10px", width: "auto" }}>Отмена</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(landing.id)} title="Удалить" style={{ ...iconBtnStyle, color: "var(--neg)" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Leads tab ─────────────────────────────────────────────── */}
      {tab === "leads" && (
        <div>
          {leadsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3].map(n => <div key={n} style={{ height: 64, background: "var(--panel)", borderRadius: 10, border: "1px solid var(--line)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
            </div>
          ) : leads.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 24px", background: "var(--panel)", borderRadius: 16, border: "1px dashed var(--line)" }}>
              <MessageSquare size={32} style={{ color: "var(--tx-3)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--tx-1)", margin: 0 }}>Нет заявок</p>
                <p style={{ fontSize: 13, color: "var(--tx-3)", margin: "4px 0 0" }}>Заявки появятся когда клиенты заполнят форму на лендинге</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leads.map((lead) => (
                <div key={lead.id} style={{ padding: "14px 16px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>👤</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)", margin: 0 }}>
                        {lead.name || "Без имени"}
                      </p>
                      {lead.landing_title && (
                        <span style={{ fontSize: 11, color: "var(--tx-3)", background: "var(--chip)", padding: "2px 8px", borderRadius: 6 }}>
                          {lead.landing_title}
                        </span>
                      )}
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: lead.status === "new" ? "#dbeafe" : "var(--chip)", color: lead.status === "new" ? "#1d4ed8" : "var(--tx-3)", fontWeight: 600 }}>
                        {lead.status === "new" ? "Новая" : lead.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {lead.phone && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--tx-2)" }}>
                          <Phone size={12} /> {lead.phone}
                        </span>
                      )}
                      {lead.email && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--tx-2)" }}>
                          <Mail size={12} /> {lead.email}
                        </span>
                      )}
                      {lead.message && (
                        <span style={{ fontSize: 12, color: "var(--tx-3)", fontStyle: "italic", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          "{lead.message}"
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--tx-3)" }}>
                        <Clock size={11} /> {formatTime(lead.created_at)}
                      </span>
                    </div>
                  </div>
                  {lead.landing_slug && (
                    <a href={`/l/${lead.landing_slug}`} target="_blank" rel="noreferrer"
                      style={{ color: "var(--tx-3)", flexShrink: 0 }}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--chip)",
  border: "none",
  borderRadius: 7,
  cursor: "pointer",
  color: "var(--tx-2)",
};
