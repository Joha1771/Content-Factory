"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import LandingRenderer, {
  Block, HeroBlock, FormBlock, PriceBlock, FeaturesBlock, BenefitsBlock,
} from "@/components/landing/LandingRenderer";
import {
  Type, Palette, FileText, Search, Globe, BarChart2,
  ExternalLink, ChevronLeft, Eye, EyeOff,
  TrendingUp, Users, MousePointer,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type LP = {
  id: string; title: string; slug: string; published: boolean;
  blocks: Block[]; bg_image: string | null;
  settings: {
    brandColor?: string;
    tone?: string;
    autoCloseDays?: number | null;
    routing?: { aiCallback?: boolean; crm?: boolean; payments?: boolean };
    pixels?: { metaPixelId?: string; yandexMetrikaId?: string; gaId?: string };
    seo?: { description?: string; ogImage?: string };
    afterSubmit?: { mode?: string; message?: string; redirectUrl?: string; telegramUrl?: string; whatsappPhone?: string };
  };
  template_id: string; created_at?: string; updated_at?: string;
};
type Lead = { id: string; name: string | null; phone: string | null; status: string; created_at: string };

// ── Constants ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "content",   label: "Контент",   Icon: Type      },
  { id: "design",    label: "Дизайн",    Icon: Palette   },
  { id: "form",      label: "Форма",     Icon: FileText  },
  { id: "seo",       label: "SEO",       Icon: Search    },
  { id: "publish",   label: "Публикация",Icon: Globe     },
  { id: "analytics", label: "Аналитика", Icon: BarChart2 },
];

const TEMPLATE_TYPES = [
  { id: "product",     name: "Товар",   icon: "🛒" },
  { id: "form",        name: "Заявка",  icon: "📋" },
  { id: "appointment", name: "Запись",  icon: "📅" },
  { id: "event",       name: "Событие", icon: "🎉" },
  { id: "menu",        name: "Меню",    icon: "🍽️" },
  { id: "callback",    name: "Звонок",  icon: "📞" },
];

const LIFECYCLE = [
  { value: 1, label: "24 часа" }, { value: 3, label: "3 дня" },
  { value: 7, label: "7 дней" }, { value: 30, label: "30 дней" },
  { value: null, label: "Бессрочно" },
];

const C = {
  bg:      "#F8FAFC",
  surface: "#FFFFFF",
  border:  "#E2E8F0",
  text:    "#0F172A",
  muted:   "#64748B",
  accent:  "var(--accent)",
  success: "#10B981",
  indigo:  "#4F46E5",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface LandingEditorProps {
  id: string;
  onBack: () => void;
  onDone?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingEditor({ id, onBack, onDone }: LandingEditorProps) {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState("content");
  const [blocks, setBlocks]               = useState<Block[]>([]);
  const [templateType, setTemplateType]   = useState("product");
  const [brandColor, setBrandColor]       = useState("#4F46E5");
  const [autoCloseDays, setAutoCloseDays] = useState<number | null>(null);
  const [routing, setRouting]             = useState({ aiCallback: true, crm: true, payments: false });
  const [pixels, setPixels]               = useState({ metaPixelId: "", yandexMetrikaId: "", gaId: "" });
  const [seoDesc, setSeoDesc]             = useState("");
  const [afterSubmit, setAfterSubmit]     = useState({ mode: "message", message: "", redirectUrl: "", telegramUrl: "", whatsappPhone: "" });
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: landing, isLoading } = useQuery({
    queryKey: ["landing", id],
    queryFn: async () => {
      const r = await fetch(`/api/landings/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json() as Promise<LP>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["landing_stats", id],
    queryFn: async () => {
      const [lr, vr] = await Promise.all([
        fetch(`/api/leads?landing_id=${id}`),
        fetch(`/api/landings/${id}/stats`),
      ]);
      const leads: Lead[] = lr.ok ? await lr.json() : [];
      const { views = 0 } = vr.ok ? await vr.json() : {};
      return { leads, views };
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!landing) return;
    setBlocks(landing.blocks ?? []);
    setTemplateType(landing.template_id || "product");
    setBrandColor(landing.settings?.brandColor || "#4F46E5");
    setAutoCloseDays(landing.settings?.autoCloseDays ?? null);
    setRouting({
      aiCallback: landing.settings?.routing?.aiCallback ?? true,
      crm:        landing.settings?.routing?.crm ?? true,
      payments:   landing.settings?.routing?.payments ?? false,
    });
    setPixels({
      metaPixelId:      landing.settings?.pixels?.metaPixelId      ?? "",
      yandexMetrikaId:  landing.settings?.pixels?.yandexMetrikaId  ?? "",
      gaId:             landing.settings?.pixels?.gaId             ?? "",
    });
    setSeoDesc(landing.settings?.seo?.description ?? "");
    setAfterSubmit({
      mode:          landing.settings?.afterSubmit?.mode          ?? "message",
      message:       landing.settings?.afterSubmit?.message       ?? "",
      redirectUrl:   landing.settings?.afterSubmit?.redirectUrl   ?? "",
      telegramUrl:   landing.settings?.afterSubmit?.telegramUrl   ?? "",
      whatsappPhone: landing.settings?.afterSubmit?.whatsappPhone ?? "",
    });
  }, [landing]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (publish?: boolean) => {
      setSaving(true);
      const body: Record<string, unknown> = {
        content: {
          blocks, template_id: templateType,
          bg_image: landing?.bg_image ?? null,
          settings: {
            brandColor,
            tone: landing?.settings?.tone,
            autoCloseDays,
            routing,
            pixels: {
              metaPixelId:     pixels.metaPixelId     || undefined,
              yandexMetrikaId: pixels.yandexMetrikaId || undefined,
              gaId:            pixels.gaId            || undefined,
            },
            seo: { description: seoDesc || undefined },
            afterSubmit,
          },
        },
      };
      if (publish !== undefined) body.published = publish;
      const r = await fetch(`/api/landings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Ошибка");
    },
    onSuccess: () => {
      setSaving(false); setSaved(true);
      qc.invalidateQueries({ queryKey: ["landing", id] });
      qc.invalidateQueries({ queryKey: ["landing_pages"] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setSaving(false),
  });

  const effectiveBlocks: Block[] = blocks.length > 0 ? blocks : (landing?.blocks ?? []);

  const hero        = effectiveBlocks.find(b => b.type === "hero")                              as HeroBlock     | undefined;
  const formBlk     = effectiveBlocks.find(b => b.type === "form")                              as FormBlock     | undefined;
  const priceBlk    = effectiveBlocks.find(b => b.type === "price")                             as PriceBlock    | undefined;
  const featBlk     = effectiveBlocks.find(b => b.type === "features" || b.type === "benefits") as (FeaturesBlock | BenefitsBlock) | undefined;
  const benefitsType = featBlk?.type ?? "benefits";

  const patchBlock = (type: string, patch: Record<string, unknown>) =>
    setBlocks(prev => prev.map(b => b.type === type ? { ...b, ...patch } as Block : b));

  const touch = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMutation.mutate(undefined), 2000);
  };

  const patchAndTouch = (type: string, patch: Record<string, unknown>) => {
    patchBlock(type, patch); touch();
  };

  if (isLoading) return <Loader />;
  if (!landing)  return <Loader label="Не найдено" />;

  const leads     = stats?.leads ?? [];
  const views     = stats?.views ?? 0;
  const leadCount = leads.length;
  const cvr       = views > 0 ? ((leadCount / views) * 100).toFixed(1) + "%" : "—";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, color: C.text, overflow: "hidden" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{ height: 52, borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", flexShrink: 0, zIndex: 10 }}>
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={14} /> Назад
        </button>

        <div style={{ width: 1, height: 20, background: C.border }} />

        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {landing.title}
        </span>

        <button onClick={() => saveMutation.mutate(undefined)} disabled={saving}
          style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: saved ? C.success : C.muted, fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "color 0.2s" }}>
          {saved ? "✓ Сохранено" : saving ? "..." : "Сохранить"}
        </button>

        <button onClick={() => saveMutation.mutate(!landing.published)} disabled={saving}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 7, border: "none", background: landing.published ? "#FEE2E2" : C.indigo, color: landing.published ? "#DC2626" : "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {landing.published ? <><EyeOff size={13} /> Снять</> : <><Eye size={13} /> Опубликовать</>}
        </button>

        {landing.published && (
          <a href={`/l/${landing.slug}`} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 13, textDecoration: "none" }}>
            <ExternalLink size={13} />
          </a>
        )}

        {onDone && (
          <button
            onClick={onDone}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 7, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Далее →
          </button>
        )}
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left: phone preview ──────────────────────────────────────── */}
        <div style={{ width: 290, background: "#F1F5F9", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 12px", gap: 12, flexShrink: 0, overflowY: "auto" }}>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.muted, width: "100%", overflow: "hidden", boxSizing: "border-box" as const }}>
            <span style={{ color: "#10B981", fontSize: 12 }}>🔒</span>
            <span style={{ fontWeight: 700, color: C.text, flexShrink: 0 }}>mvira.uz/l/</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{landing.slug}</span>
          </div>

          {effectiveBlocks.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 10, textAlign: "center", padding: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📄</div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Контент пустой</p>
            </div>
          ) : (
            <>
              <div style={{ background: "#1A1A18", borderRadius: 30, padding: "8px 8px 12px", boxShadow: "0 20px 40px -12px rgba(0,0,0,.25)", width: 252, flexShrink: 0 }}>
                <div style={{ background: "#fff", borderRadius: 23, overflow: "hidden", height: "calc(100vh - 210px)" }}>
                  <div style={{ padding: "9px 14px 4px", display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 600, color: "#1A1A18" }}>
                    <span>9:41</span><span>📶 🔋</span>
                  </div>
                  <div style={{ padding: "4px 14px 6px", background: "#F2F1ED", display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#5B5B57", margin: "0 8px", borderRadius: 6 }}>
                    <span style={{ color: "#0A6E3A" }}>🔒</span>
                    <span style={{ fontWeight: 700, color: "#1A1A18" }}>mvira.uz/l/</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{landing.slug}</span>
                  </div>
                  <div style={{ overflowY: "auto", height: "calc(100% - 42px)" }}>
                    <LandingRenderer blocks={effectiveBlocks} bgImage={landing.bg_image || undefined} brandColor={brandColor} preview />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: landing.published ? C.success : C.muted }} />
                <span style={{ color: landing.published ? C.success : C.muted, fontWeight: 500 }}>
                  {landing.published ? "Опубликован" : "Черновик"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Right: settings panel ────────────────────────────────────── */}
        <div style={{ flex: 1, background: C.surface, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div style={{ borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 8px", background: C.surface, flexShrink: 0, overflowX: "auto" }}>
            {NAV.filter(n => n.id !== "analytics" || landing.published).map(({ id: nid, label, Icon }) => {
              const active = activeSection === nid;
              return (
                <button key={nid} onClick={() => setActiveSection(nid)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 14px", fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.indigo : C.muted, background: "none", border: "none", borderBottom: active ? `2px solid ${C.indigo}` : "2px solid transparent", cursor: "pointer", marginBottom: -1, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* ─ Контент ─ */}
            {activeSection === "content" && (
              <Panel title="Контент">
                <Section label="Hero блок">
                  <F label="Акционная метка / бейдж">
                    <input value={(hero as any)?.badge || (hero as any)?.eyebrow || ""} onChange={e => patchAndTouch("hero", { badge: e.target.value })} style={inp} placeholder="напр. Скидка 30% до конца июля" />
                  </F>
                  <F label="Главный заголовок *">
                    <textarea value={(hero as any)?.headline || ""} onChange={e => patchAndTouch("hero", { headline: e.target.value })} rows={2} style={{ ...inp, resize: "vertical" }} />
                  </F>
                  <F label="Подзаголовок">
                    <textarea value={(hero as any)?.subheadline || ""} onChange={e => patchAndTouch("hero", { subheadline: e.target.value })} rows={2} style={{ ...inp, resize: "vertical" }} />
                  </F>
                  <F label="Кнопка (CTA)">
                    <input value={(hero as any)?.cta || ""} onChange={e => patchAndTouch("hero", { cta: e.target.value })} style={inp} placeholder="напр. Получить предложение" />
                  </F>
                  <F label="Визуальный эмодзи (правая сторона)">
                    <input value={(hero as any)?.visual || (hero as any)?.emoji || ""} onChange={e => patchAndTouch("hero", { visual: e.target.value, emoji: e.target.value })} style={inp} placeholder="🛒" />
                  </F>
                </Section>
                {priceBlk && (
                  <Section label="Блок цены">
                    <F label="Бейдж акции">
                      <input value={(priceBlk as any).badge || ""} onChange={e => patchAndTouch("price", { badge: e.target.value })} style={inp} placeholder="Выгода 30%" />
                    </F>
                    <F label="Старая цена">
                      <input value={priceBlk.oldPrice || ""} onChange={e => patchAndTouch("price", { oldPrice: e.target.value })} style={inp} placeholder="150 000 сум" />
                    </F>
                    <F label="Новая цена *">
                      <input value={priceBlk.newPrice || ""} onChange={e => patchAndTouch("price", { newPrice: e.target.value })} style={inp} placeholder="99 000 сум" />
                    </F>
                    <F label="Кнопка">
                      <input value={priceBlk.cta || ""} onChange={e => patchAndTouch("price", { cta: e.target.value })} style={inp} placeholder="Заказать сейчас" />
                    </F>
                  </Section>
                )}
                {featBlk && (
                  <Section label="Преимущества / Услуги">
                    <F label="Заголовок раздела">
                      <input value={featBlk.title || ""} onChange={e => patchAndTouch(benefitsType, { title: e.target.value })} style={inp} />
                    </F>
                    {(featBlk.items || []).map((item, fi) => (
                      <div key={fi} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 6 }}>
                        <p style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>Пункт {fi + 1}</p>
                        <input value={item.icon || ""} onChange={e => {
                          const items = [...(featBlk.items || [])];
                          items[fi] = { ...items[fi], icon: e.target.value };
                          patchAndTouch(benefitsType, { items });
                        }} style={{ ...inp, marginBottom: 5 }} placeholder="Иконка (эмодзи)" />
                        <input value={item.title} onChange={e => {
                          const items = [...(featBlk.items || [])];
                          items[fi] = { ...items[fi], title: e.target.value };
                          patchAndTouch(benefitsType, { items });
                        }} style={{ ...inp, marginBottom: 5 }} placeholder="Заголовок пункта" />
                        <input value={item.desc || ""} onChange={e => {
                          const items = [...(featBlk.items || [])];
                          items[fi] = { ...items[fi], desc: e.target.value };
                          patchAndTouch(benefitsType, { items });
                        }} style={inp} placeholder="Описание" />
                      </div>
                    ))}
                  </Section>
                )}
              </Panel>
            )}

            {/* ─ Дизайн ─ */}
            {activeSection === "design" && (
              <Panel title="Дизайн">
                <Section label="Цвет бренда">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="color" value={brandColor} onChange={e => { setBrandColor(e.target.value); touch(); }}
                      style={{ width: 42, height: 38, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, cursor: "pointer", flexShrink: 0 }} />
                    <input value={brandColor} onChange={e => { setBrandColor(e.target.value); touch(); }}
                      style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: 13 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {["#4F46E5","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#1E293B"].map(c => (
                      <div key={c} onClick={() => { setBrandColor(c); touch(); }}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: brandColor === c ? `2px solid ${C.text}` : "2px solid transparent", transition: "border 0.15s" }} />
                    ))}
                  </div>
                </Section>
                <Section label="Тип лендинга">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {TEMPLATE_TYPES.map(t => {
                      const active = templateType === t.id;
                      return (
                        <button key={t.id} onClick={() => { setTemplateType(t.id); touch(); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", borderRadius: 8, border: `1.5px solid ${active ? C.indigo : C.border}`, background: active ? `${C.indigo}10` : "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                          <span style={{ fontSize: 18 }}>{t.icon}</span>
                          <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.indigo : C.muted }}>{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              </Panel>
            )}

            {/* ─ Форма ─ */}
            {activeSection === "form" && (
              <Panel title="Форма захвата лидов">
                <Section label="Текст формы">
                  <F label="Заголовок">
                    <input value={formBlk?.title || ""} onChange={e => patchAndTouch("form", { title: e.target.value })} style={inp} />
                  </F>
                  <F label="Подзаголовок">
                    <input value={formBlk?.subtitle || ""} onChange={e => patchAndTouch("form", { subtitle: e.target.value })} style={inp} />
                  </F>
                  <F label="Кнопка отправки">
                    <input value={formBlk?.button || ""} onChange={e => patchAndTouch("form", { button: e.target.value })} style={inp} placeholder="Отправить заявку" />
                  </F>
                  <F label="Подпись под кнопкой">
                    <input value={formBlk?.note || ""} onChange={e => patchAndTouch("form", { note: e.target.value })} style={inp} placeholder="AI перезвонит за 1 минуту" />
                  </F>
                </Section>
                <Section label="Стиль">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Тёмный фон</p>
                      <p style={{ fontSize: 11, color: C.muted }}>Форма на чёрном фоне</p>
                    </div>
                    <Toggle on={!!(formBlk as any)?.dark} onChange={v => patchAndTouch("form", { dark: v })} />
                  </div>
                </Section>
                <Section label="После отправки">
                  <F label="Действие">
                    <select
                      value={afterSubmit.mode}
                      onChange={e => { setAfterSubmit(p => ({ ...p, mode: e.target.value })); touch(); }}
                      style={{ ...inp, cursor: "pointer" }}
                    >
                      <option value="message">Показать сообщение</option>
                      <option value="redirect">Перенаправить на URL</option>
                      <option value="telegram">Открыть Telegram</option>
                      <option value="whatsapp">Открыть WhatsApp</option>
                    </select>
                  </F>
                  {afterSubmit.mode === "message" && (
                    <F label="Текст сообщения">
                      <input
                        value={afterSubmit.message}
                        onChange={e => { setAfterSubmit(p => ({ ...p, message: e.target.value })); touch(); }}
                        style={inp}
                        placeholder="Спасибо! Мы свяжемся с вами скоро."
                      />
                    </F>
                  )}
                  {afterSubmit.mode === "redirect" && (
                    <F label="URL для перенаправления">
                      <input
                        value={afterSubmit.redirectUrl}
                        onChange={e => { setAfterSubmit(p => ({ ...p, redirectUrl: e.target.value })); touch(); }}
                        style={inp}
                        placeholder="https://example.com/thank-you"
                      />
                    </F>
                  )}
                  {afterSubmit.mode === "telegram" && (
                    <F label="Ссылка Telegram">
                      <input
                        value={afterSubmit.telegramUrl}
                        onChange={e => { setAfterSubmit(p => ({ ...p, telegramUrl: e.target.value })); touch(); }}
                        style={inp}
                        placeholder="https://t.me/yourusername"
                      />
                    </F>
                  )}
                  {afterSubmit.mode === "whatsapp" && (
                    <F label="Номер WhatsApp">
                      <input
                        value={afterSubmit.whatsappPhone}
                        onChange={e => { setAfterSubmit(p => ({ ...p, whatsappPhone: e.target.value })); touch(); }}
                        style={inp}
                        placeholder="+998901234567"
                      />
                    </F>
                  )}
                </Section>
              </Panel>
            )}

            {/* ─ SEO ─ */}
            {activeSection === "seo" && (
              <Panel title="SEO">
                <Section label="Метаданные">
                  <F label="Заголовок страницы">
                    <input value={landing.title || ""} readOnly style={{ ...inp, background: C.bg }} />
                  </F>
                  <F label="URL страницы">
                    <input value={`mvira.uz/l/${landing.slug}`} readOnly style={{ ...inp, background: C.bg, fontFamily: "monospace", fontSize: 12 }} />
                  </F>
                  <F label="Описание (OG/SEO)">
                    <textarea
                      value={seoDesc}
                      onChange={e => { setSeoDesc(e.target.value); touch(); }}
                      rows={3}
                      style={{ ...inp, resize: "vertical" }}
                      placeholder="Краткое описание страницы для соцсетей и поисковиков"
                    />
                  </F>
                </Section>
                <Section label="Пиксели аналитики">
                  <F label="Meta Pixel ID">
                    <input
                      value={pixels.metaPixelId}
                      onChange={e => { setPixels(p => ({ ...p, metaPixelId: e.target.value })); touch(); }}
                      style={inp}
                      placeholder="123456789012345"
                    />
                  </F>
                  <F label="Яндекс Метрика ID">
                    <input
                      value={pixels.yandexMetrikaId}
                      onChange={e => { setPixels(p => ({ ...p, yandexMetrikaId: e.target.value })); touch(); }}
                      style={inp}
                      placeholder="12345678"
                    />
                  </F>
                  <F label="Google Analytics ID">
                    <input
                      value={pixels.gaId}
                      onChange={e => { setPixels(p => ({ ...p, gaId: e.target.value })); touch(); }}
                      style={inp}
                      placeholder="G-XXXXXXXXXX"
                    />
                  </F>
                </Section>
              </Panel>
            )}

            {/* ─ Публикация ─ */}
            {activeSection === "publish" && (
              <Panel title="Публикация">
                <Section label="Статус">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: landing.published ? "#F0FDF4" : C.bg, borderRadius: 10, border: `1px solid ${landing.published ? "#BBF7D0" : C.border}` }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: landing.published ? C.success : C.text }}>
                        {landing.published ? "Опубликован" : "Черновик"}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {landing.published ? `mvira.uz/l/${landing.slug}` : "Не виден для посетителей"}
                      </p>
                    </div>
                    <button onClick={() => saveMutation.mutate(!landing.published)}
                      style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: landing.published ? "#FEE2E2" : C.indigo, color: landing.published ? "#DC2626" : "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {landing.published ? "Снять" : "Опубликовать"}
                    </button>
                  </div>
                </Section>
                <Section label="Жизненный цикл">
                  <F label="Авто-закрытие">
                    <select value={autoCloseDays === null ? "null" : String(autoCloseDays)} onChange={e => { setAutoCloseDays(e.target.value === "null" ? null : Number(e.target.value)); touch(); }}
                      style={{ ...inp, cursor: "pointer" }}>
                      {LIFECYCLE.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                    </select>
                  </F>
                </Section>
                <Section label="Куда идут лиды">
                  {[
                    { key: "aiCallback" as const, label: "AI-менеджер перезванивает", desc: "Автоматический звонок", icon: "🤖" },
                    { key: "crm"        as const, label: "Сохранить в CRM",           desc: "Раздел Заявки",       icon: "📊" },
                    { key: "payments"   as const, label: "PayMall платёжи",            desc: "Подключить оплату",   icon: "💳" },
                  ].map(item => (
                    <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{item.label}</p>
                          <p style={{ fontSize: 11, color: C.muted }}>{item.desc}</p>
                        </div>
                      </div>
                      <Toggle on={routing[item.key]} onChange={v => { setRouting(p => ({ ...p, [item.key]: v })); touch(); }} />
                    </div>
                  ))}
                </Section>
              </Panel>
            )}

            {/* ─ Аналитика ─ */}
            {activeSection === "analytics" && landing.published && (
              <Panel title="Аналитика">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
                  <StatCard icon={<MousePointer size={14} />} label="Просмотры" value={views} color={C.indigo} />
                  <StatCard icon={<Users size={14} />} label="Заявки" value={leadCount} color={C.success} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <StatCard icon={<TrendingUp size={14} />} label="Конверсия" value={cvr} color="#F59E0B" />
                  <StatCard icon={<BarChart2 size={14} />} label="Статус" value={landing.published ? "Live" : "Draft"} color={landing.published ? C.success : C.muted} />
                </div>

                {leadCount > 0 && (
                  <Section label="Заявки за 7 дней">
                    <MiniChart leads={leads} />
                  </Section>
                )}

                {leads.length > 0 && (
                  <Section label={`Последние заявки (${leads.length})`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {leads.slice(0, 6).map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: C.bg, borderRadius: 9, border: `1px solid ${C.border}` }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{l.name || "—"}</p>
                            <p style={{ fontSize: 11, color: C.muted }}>{l.phone || "—"}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 10, color: C.muted }}>{new Date(l.created_at).toLocaleDateString("ru")}</p>
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.success, background: "#F0FDF4", padding: "2px 7px", borderRadius: 10 }}>
                              {l.status === "new" ? "Новый" : l.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {leadCount === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 20px", color: C.muted }}>
                    <BarChart2 size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>Пока нет заявок</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Появятся после первых визитов</p>
                  </div>
                )}
              </Panel>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────
function Loader({ label = "Загрузка..." }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: C.muted, fontSize: 14, fontFamily: "Inter, sans-serif" }}>
      {label}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {children}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{ width: 38, height: 22, borderRadius: 11, background: on ? C.indigo : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: "14px 12px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: color, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>{value}</p>
    </div>
  );
}

function MiniChart({ leads }: { leads: { created_at: string }[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const counts = days.map(day =>
    leads.filter(l => new Date(l.created_at).toDateString() === day.toDateString()).length
  );
  const max = Math.max(...counts, 1);
  return (
    <svg width="100%" height={72} viewBox="0 0 260 72" style={{ display: "block" }}>
      {counts.map((n, i) => {
        const barH = Math.max((n / max) * 48, n > 0 ? 4 : 2);
        const x = i * 38;
        return (
          <g key={i}>
            <rect x={x + 2} y={52 - barH} width={30} height={barH} rx={4}
              fill={n > 0 ? C.indigo : C.border} opacity={n > 0 ? 0.85 : 1} />
            <text x={x + 17} y={68} textAnchor="middle" fontSize={9} fill={C.muted}>
              {days[i].getDate()}
            </text>
            {n > 0 && <text x={x + 17} y={52 - barH - 4} textAnchor="middle" fontSize={9} fill={C.indigo} fontWeight="600">{n}</text>}
          </g>
        );
      })}
    </svg>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "8px 11px", border: `1px solid ${C.border}`,
  borderRadius: 7, fontSize: 13, color: C.text, outline: "none",
  boxSizing: "border-box", fontFamily: "Inter, sans-serif", background: "#fff",
  transition: "border-color 0.15s",
};
