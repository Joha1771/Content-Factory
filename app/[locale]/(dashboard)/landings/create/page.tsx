"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles, Check, ExternalLink, Building2 } from "lucide-react";
import LandingEditor from "@/components/landing/LandingEditor";

// ── Types ──────────────────────────────────────────────────────────────────
type Step1 = {
  businessName: string;
  niche: string;
  city: string;
  offer: string;
  audience: string;
  pain: string;
  advantages: string;
  tone: string;
  brandColor: string;
  oldPrice: string;
  newPrice: string;
  productEmoji: string;
  bgImage: string;
  logoUrl: string;
};

type Project = {
  id: string;
  name: string;
  niche: string | null;
  logo_url: string | null;
};

const EMPTY_STEP1: Step1 = {
  businessName: "",
  niche: "услуги",
  city: "",
  offer: "",
  audience: "",
  pain: "",
  advantages: "",
  tone: "профессиональный",
  brandColor: "#6366f1",
  oldPrice: "",
  newPrice: "",
  productEmoji: "",
  bgImage: "",
  logoUrl: "",
};

const NICHES = [
  "недвижимость", "медицина", "образование", "услуги", "товары",
  "IT / технологии", "красота и уход", "строительство", "питание", "другое",
];

const TONES = ["профессиональный", "дружелюбный", "молодёжный", "экспертный", "вдохновляющий"];

const ANIMATION_PRESETS = [
  { id: "float",  label: "Парение"   },
  { id: "swing",  label: "Качание"   },
  { id: "tilt3d", label: "3D-наклон" },
  { id: "pulse",  label: "Пульс"     },
  { id: "combo",  label: "Комбо"     },
] as const;

type AnimPresetId = typeof ANIMATION_PRESETS[number]["id"];

const STORAGE_KEY = "landing_draft_v1";
const WIZARD_STATE_KEY = "landing_wizard_state_v1";

// ── Image resize helper ────────────────────────────────────────────────────
function resizeImage(file: File, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Component ──────────────────────────────────────────────────────────────
function CreateLandingPageInner() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const fromCampaign = searchParams.get("from") === "campaign";
  const campaignId = searchParams.get("campaign_id");

  // step 0 = project selection, 1 = business details, 2 = preview (LandingEditor), 3 = launch settings
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(WIZARD_STATE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if ((d.step === 2 || d.step === 3 || d.step === 4) && !d.created) return 1;
        return d.step ?? 0;
      }
    } catch {}
    return 0;
  });
  const [step1, setStep1] = useState<Step1>(() => {
    const offer = searchParams.get("product") || "";
    const audience = searchParams.get("audience") || "";
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        return { ...d, ...(offer ? { offer } : {}), ...(audience ? { audience } : {}) };
      }
    } catch {}
    return { ...EMPTY_STEP1, offer, audience };
  });
  const [autoCloseDays, setAutoCloseDays] = useState<number | null>(null);
  const [routing, setRouting] = useState({ aiCallback: true, crm: true, payments: false });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(() => {
    try {
      const saved = sessionStorage.getItem(WIZARD_STATE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        return d.created ?? null;
      }
    } catch {}
    return null;
  });
  const [finished, setFinished] = useState(false);
  const [animPreset, setAnimPreset] = useState<AnimPresetId>("float");
  const [productPhoto, setProductPhoto] = useState<string>("");
  const productPhotoInputRef = useRef<HTMLInputElement>(null);

  // Project selection
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fillingFromProject, setFillingFromProject] = useState(false);
  const [filledFromProject, setFilledFromProject] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(step1)); } catch {}
  }, [step1]);

  useEffect(() => {
    try {
      sessionStorage.setItem(WIZARD_STATE_KEY, JSON.stringify({ step, created }));
    } catch {}
  }, [step, created]);

  const set1 = (field: keyof Step1) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setStep1((p) => ({ ...p, [field]: e.target.value }));

  const canNext1 = step1.businessName && step1.offer && step1.audience;

  const handleSelectProject = async (projectId: string) => {
    setFillingFromProject(true);
    try {
      const res = await fetch("/api/landings/from-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setStep1((prev) => ({
        ...prev,
        businessName: data.businessName || prev.businessName,
        niche: data.niche || prev.niche,
        city: data.city || prev.city,
        offer: data.offer || prev.offer,
        audience: data.audience || prev.audience,
        pain: data.pain || prev.pain,
        advantages: data.advantages || prev.advantages,
        tone: data.tone || prev.tone,
      }));
      const proj = projects.find((p) => p.id === projectId);
      setFilledFromProject(proj?.name ?? null);
    } catch {
      const proj = projects.find((p) => p.id === projectId);
      if (proj) {
        setStep1((prev) => ({ ...prev, businessName: proj.name }));
        setFilledFromProject(proj.name);
      }
    } finally {
      setFillingFromProject(false);
      setStep(1);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/landings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...step1, bgImage: step1.bgImage || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка генерации");
      }
      const { id, slug } = await res.json();
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      qc.invalidateQueries({ queryKey: ["landing_pages"] });
      qc.invalidateQueries({ queryKey: ["landings_wizard"] });
      if (fromCampaign) {
        const resumeParams = new URLSearchParams({ tab: "wizard" });
        if (campaignId) resumeParams.set("resume", campaignId);
        resumeParams.set("landing", id);
        router.push(`/${locale}/campaigns?${resumeParams.toString()}`);
      } else {
        setCreated({ id, slug });
        setStep(2);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!created) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/landings/${created.id}`);
      const current = await r.json();
      const existingContent = current.content ?? {};
      const patchedContent = {
        ...existingContent,
        settings: { ...(existingContent.settings ?? {}), routing, autoCloseDays },
      };
      await fetch(`/api/landings/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: patchedContent }),
      });
      setFinished(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step === 0) {
      fromCampaign ? router.back() : router.push(`/${locale}/landings`);
    } else {
      setStep((s) => s - 1);
    }
  };

  const STEPS = ["Проект", "Детали", "Превью", "Анимация", "Запуск"];

  // ── Success screen ─────────────────────────────────────────────────────
  if (finished && created) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, width: "100%", padding: "0 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Check size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--tx-1)", marginBottom: 8 }}>Лендинг готов!</h1>
          <p style={{ fontSize: 14, color: "var(--tx-3)", marginBottom: 28 }}>mvira.uz/l/{created.slug}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(WIZARD_STATE_KEY); sessionStorage.removeItem(STORAGE_KEY); } catch {}
                router.push(`/${locale}/landings`);
              }}
              style={{ padding: "10px 20px", border: "1px solid var(--line)", borderRadius: 9, background: "transparent", color: "var(--tx-2)", fontSize: 13, cursor: "pointer" }}
            >
              ← Все лендинги
            </button>
            <a
              href={`/l/${created.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", border: "none", borderRadius: 9, background: "var(--accent)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              <ExternalLink size={14} /> Открыть
            </a>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(WIZARD_STATE_KEY); sessionStorage.removeItem(STORAGE_KEY); } catch {}
                setFinished(false); setCreated(null); setStep(0); setStep1(EMPTY_STEP1); setFilledFromProject(null); setSelectedProjectId(null);
              }}
              style={{ padding: "10px 20px", border: "1px solid var(--line)", borderRadius: 9, background: "var(--panel)", color: "var(--tx-1)", fontSize: 13, cursor: "pointer" }}
            >
              + Создать ещё
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LandingEditor inline (step 2 = Превью) ────────────────────────────
  if (step === 2 && created) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
        {/* Step indicator strip */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 0, alignItems: "center", maxWidth: 760, margin: "0 auto" }}>
            {STEPS.map((label, i) => {
              const done = step > i;
              const active = step === i;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                    onClick={() => { if (i < step) setStep(i); }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: done || active ? "var(--accent)" : "var(--chip)", color: done || active ? "var(--on-accent)" : "var(--tx-3)", flexShrink: 0, cursor: i < step ? "pointer" : "default" }}>
                      {done ? <Check size={13} /> : i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--tx-1)" : "var(--tx-3)", whiteSpace: "nowrap", cursor: i < step ? "pointer" : "default" }}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: done ? "var(--accent)" : "var(--line)", margin: "0 12px" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Editor fills remaining height */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LandingEditor
            id={created.id}
            onBack={() => setStep(1)}
            onDone={() => setStep(3)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "32px 24px 64px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Back */}
        <button
          onClick={goBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--tx-3)", fontSize: 14, cursor: "pointer", marginBottom: 24, padding: 0 }}
        >
          <ChevronLeft size={16} />
          {step === 0 ? "Все лендинги" : "Назад"}
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--tx-1)", marginBottom: 8 }}>Создать лендинг</h1>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 0, marginBottom: 36, alignItems: "center" }}>
          {STEPS.map((label, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                  onClick={() => { if (i < step) setStep(i); }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: done || active ? "var(--accent)" : "var(--chip)", color: done || active ? "var(--on-accent)" : "var(--tx-3)", flexShrink: 0, cursor: i < step ? "pointer" : "default" }}>
                    {done ? <Check size={13} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "var(--tx-1)" : "var(--tx-3)", whiteSpace: "nowrap", cursor: i < step ? "pointer" : "default" }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? "var(--accent)" : "var(--line)", margin: "0 12px" }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 0 — Project selection ─────────────────────────────── */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: 14, color: "var(--tx-2)", marginBottom: 24 }}>
              Выберите проект — AI автоматически адаптирует данные для лендинга. Или заполните вручную.
            </p>

            {projectsLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--tx-3)", fontSize: 14 }}>
                Загрузка проектов...
              </div>
            ) : projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--chip)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Building2 size={24} color="var(--tx-3)" />
                </div>
                <p style={{ color: "var(--tx-2)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Нет проектов</p>
                <p style={{ color: "var(--tx-3)", fontSize: 13, marginBottom: 20 }}>Создайте проект или заполните данные вручную</p>
                <button onClick={() => setStep(1)} style={nextBtnStyle(false)}>
                  Заполнить вручную <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12, marginBottom: 28 }}>
                  {projects.map((p) => {
                    const selected = selectedProjectId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProjectId(selected ? null : p.id)}
                        style={{
                          border: selected ? "2px solid var(--accent)" : "1px solid var(--line)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          cursor: "pointer",
                          background: selected ? "color-mix(in srgb, var(--accent) 8%, var(--panel))" : "var(--panel)",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        {p.logo_url ? (
                          <img src={p.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--panel-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Building2 size={20} color="var(--tx-3)" />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </div>
                          {p.niche && (
                            <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>{p.niche}</div>
                          )}
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: selected ? "none" : "2px solid var(--line)", background: selected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                          {selected && <Check size={11} color="white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setStep(1)} style={backBtnStyle}>
                    Без проекта
                  </button>
                  <button
                    onClick={() => selectedProjectId && handleSelectProject(selectedProjectId)}
                    disabled={!selectedProjectId || fillingFromProject}
                    style={nextBtnStyle(!selectedProjectId || fillingFromProject)}
                  >
                    {fillingFromProject ? (
                      <><Sparkles size={15} style={{ animation: "spin 1s linear infinite" }} /> AI заполняет поля...</>
                    ) : (
                      <>Использовать проект <ChevronRight size={16} /></>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 1 — Business info ─────────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {filledFromProject && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "color-mix(in srgb, var(--accent) 8%, var(--panel))", border: "1px solid color-mix(in srgb, var(--accent) 25%, var(--line))", borderRadius: 10, fontSize: 13, color: "var(--tx-2)" }}>
                <Sparkles size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                <span>AI заполнил поля по проекту <strong style={{ color: "var(--tx-1)" }}>«{filledFromProject}»</strong>. Проверьте и при необходимости отредактируйте.</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Название бизнеса *">
                <input value={step1.businessName} onChange={set1("businessName")} placeholder="напр. Клиника Здоровье" style={inputStyle} />
              </Field>
              <Field label="Ниша / категория">
                <select value={step1.niche} onChange={set1("niche")} style={inputStyle}>
                  {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Город и страна">
                <input value={step1.city} onChange={set1("city")} placeholder="напр. Ташкент, Узбекистан" style={inputStyle} />
              </Field>
              <Field label="Цвет бренда">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={step1.brandColor} onChange={set1("brandColor")} style={{ width: 40, height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: 2, cursor: "pointer", background: "var(--panel)" }} />
                  <input value={step1.brandColor} onChange={set1("brandColor")} placeholder="#6366f1" style={{ ...inputStyle, flex: 1 }} />
                </div>
              </Field>
            </div>

            <Field label="Логотип / аватарка бизнеса">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 14, border: "1.5px dashed var(--line)", background: "var(--panel-2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
                >
                  {step1.logoUrl ? (
                    <img src={step1.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Building2 size={24} color="var(--tx-3)" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--chip)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "var(--tx-2)", cursor: "pointer" }}
                  >
                    {step1.logoUrl ? "Сменить логотип" : "Загрузить логотип"}
                  </button>
                  {step1.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setStep1(p => ({ ...p, logoUrl: "" }))}
                      style={{ marginTop: 4, background: "none", border: "none", color: "var(--tx-3)", fontSize: 12, cursor: "pointer", padding: 0, display: "block" }}
                    >
                      Удалить
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 4 }}>JPG/PNG, до 5 МБ</p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const dataUrl = await resizeImage(file, 400, 0.8);
                    setStep1(p => ({ ...p, logoUrl: dataUrl }));
                  } catch {}
                  e.target.value = "";
                }}
              />
            </Field>

            <Field label="Главный оффер — что предлагаете *">
              <textarea value={step1.offer} onChange={set1("offer")} placeholder="напр. Лечение зубов без боли за 1 визит" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Целевая аудитория *">
              <textarea value={step1.audience} onChange={set1("audience")} placeholder="напр. Взрослые 25–55 лет, боящиеся стоматологов" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Главная боль клиента">
              <textarea value={step1.pain} onChange={set1("pain")} placeholder="напр. Страх боли и высокой стоимости лечения" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Три преимущества (через запятую)">
              <textarea value={step1.advantages} onChange={set1("advantages")} placeholder="напр. Современное оборудование, Без боли, Гарантия 2 года" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="Тон общения">
              <select value={step1.tone} onChange={set1("tone")} style={inputStyle}>
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {/* ── Background image ─────────────────────────────────────── */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", marginBottom: 4 }}>Изображения (необязательно)</p>
              <p style={{ fontSize: 12, color: "var(--tx-3)", marginBottom: 16 }}>Фоновое фото для лендинга — AI вставит его вместо заглушки</p>
              <label style={{ display: "block", cursor: "pointer" }}>
                <div style={{
                  height: 120, borderRadius: 10, border: "2px dashed var(--line)",
                  background: step1.bgImage ? `url(${step1.bgImage}) center/cover` : "var(--panel)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 6,
                  overflow: "hidden", position: "relative",
                }}>
                  {step1.bgImage ? (
                    <>
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
                      <span style={{ position: "relative", fontSize: 11, color: "#fff", fontWeight: 500 }}>✓ Фон загружен</span>
                      <button
                        onClick={(e) => { e.preventDefault(); setStep1((p) => ({ ...p, bgImage: "" })); }}
                        style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </>
                  ) : (
                    <><span style={{ fontSize: 28 }}>🎨</span><span style={{ fontSize: 11, color: "var(--tx-3)" }}>Нажмите для загрузки</span><span style={{ fontSize: 10, color: "var(--tx-3)" }}>JPG, PNG, WEBP</span></>
                  )}
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      const dataUrl = await resizeImage(f, 1920, 0.7);
                      setStep1(p => ({ ...p, bgImage: dataUrl }));
                    } catch {}
                  }
                  e.target.value = "";
                }} />
              </label>
            </div>

            {/* ── Price fields ─────────────────────────────────────────── */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", marginBottom: 4 }}>🏷️ Цена (необязательно)</p>
              <p style={{ fontSize: 12, color: "var(--tx-3)", marginBottom: 16 }}>Если у вас есть цена — AI автоматически добавит блок с ценой в лендинг</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Старая цена (перечёркнутая)">
                  <input value={step1.oldPrice} onChange={set1("oldPrice")} placeholder="напр. 150 000 сум" style={inputStyle} />
                </Field>
                <Field label="Новая цена (зелёная)">
                  <input value={step1.newPrice} onChange={set1("newPrice")} placeholder="напр. 99 000 сум" style={inputStyle} />
                </Field>
                <Field label="Эмодзи товара">
                  <input value={step1.productEmoji} onChange={set1("productEmoji")} placeholder="напр. 🛍️" style={inputStyle} />
                </Field>
              </div>
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={goBack} style={backBtnStyle}><ChevronLeft size={16} /> Назад</button>
              <button
                onClick={() => created ? setStep(2) : handleGenerate()}
                disabled={!canNext1 || generating}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: (!canNext1 || generating) ? "not-allowed" : "pointer", opacity: (!canNext1 || generating) ? 0.6 : 1 }}
              >
                <Sparkles size={15} style={generating ? { animation: "spin 1s linear infinite" } : undefined} />
                {generating ? "Создаём с AI..." : created ? "Далее →" : "Создать и редактировать"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 — Анимация товара ─────────────────────────────── */}
        {step === 3 && (
          <>
            <style>{`
              @keyframes anim-float {
                0%,100% { transform: translateY(0); }
                50%      { transform: translateY(-14px); }
              }
              @keyframes anim-swing {
                0%,100% { transform: rotate(0deg); }
                25%     { transform: rotate(-9deg); }
                75%     { transform: rotate(9deg); }
              }
              @keyframes anim-tilt3d {
                0%,100% { transform: perspective(500px) rotateY(0deg) rotateX(0deg); }
                25%     { transform: perspective(500px) rotateY(18deg) rotateX(6deg); }
                75%     { transform: perspective(500px) rotateY(-18deg) rotateX(-6deg); }
              }
              @keyframes anim-pulse {
                0%,100% { transform: scale(1); }
                50%     { transform: scale(1.12); }
              }
              @keyframes anim-combo {
                0%,100% { transform: translateY(0) rotate(0deg); }
                50%     { transform: translateY(-12px) rotate(4deg); }
              }
            `}</style>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>

              {/* ── Левая колонка: бесплатная CSS-анимация ────────── */}
              <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-1)", marginBottom: 2 }}>Бесплатно — CSS-анимация</p>
                  <p style={{ fontSize: 12, color: "var(--tx-3)" }}>Загрузите фото товара и выберите эффект</p>
                </div>

                {/* Зона загрузки */}
                <div
                  onClick={() => productPhotoInputRef.current?.click()}
                  style={{ height: 160, borderRadius: 10, border: "2px dashed var(--line)", background: "var(--panel-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", overflow: "hidden", position: "relative", transition: "border-color 0.15s" }}
                >
                  {productPhoto ? (
                    <>
                      <div style={{ pointerEvents: "none", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img
                          src={productPhoto}
                          alt="preview"
                          style={{
                            maxHeight: 140,
                            maxWidth: "100%",
                            objectFit: "contain",
                            animationName: `anim-${animPreset}`,
                            animationDuration: animPreset === "swing" || animPreset === "pulse" ? "2s" : animPreset === "tilt3d" ? "4s" : "3s",
                            animationTimingFunction: "ease-in-out",
                            animationIterationCount: "infinite",
                            transformOrigin: animPreset === "swing" ? "top center" : "center center",
                          }}
                        />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setProductPhoto(""); }}
                        style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 32 }}>🖼️</span>
                      <span style={{ fontSize: 12, color: "var(--tx-3)", fontWeight: 500 }}>Нажмите или перетащите фото</span>
                      <span style={{ fontSize: 11, color: "var(--tx-3)" }}>JPG, PNG, WEBP</span>
                    </>
                  )}
                </div>
                <input
                  ref={productPhotoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const dataUrl = await resizeImage(f, 800, 0.85);
                      setProductPhoto(dataUrl);
                    } catch {}
                    e.target.value = "";
                  }}
                />

                {/* Выбор пресета */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-2)", marginBottom: 8 }}>Эффект анимации</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ANIMATION_PRESETS.map((p) => {
                      const active = animPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setAnimPreset(p.id)}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1.5px solid ${active ? "var(--accent)" : "var(--line)"}`, background: active ? "color-mix(in srgb, var(--accent) 12%, var(--panel))" : "var(--panel)", color: active ? "var(--accent)" : "var(--tx-2)", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!productPhoto && (
                  <p style={{ fontSize: 11, color: "var(--tx-3)", textAlign: "center" }}>
                    Загрузите фото чтобы увидеть анимацию
                  </p>
                )}
              </div>

              {/* ── Правая колонка: 3D-анимация (заглушка) ────────── */}
              <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-1)", margin: 0 }}>3D-анимация (Pro)</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "color-mix(in srgb, var(--accent) 15%, var(--panel-2))", color: "var(--accent)" }}>$0.40</span>
                </div>

                {/* Видео-заглушка */}
                <div style={{ borderRadius: 10, overflow: "hidden", background: "var(--panel-2)", border: "1px solid var(--line)" }}>
                  <video
                    src=""
                    controls
                    style={{ width: "100%", display: "block", maxHeight: 180, background: "#000" }}
                  />
                  <p style={{ fontSize: 11, color: "var(--tx-3)", textAlign: "center", padding: "8px 0" }}>
                    Пример 3D-анимации
                  </p>
                </div>

                <p style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.6, margin: 0 }}>
                  Загрузите фото товара → получите вращающуюся 3D-модель товара, готовую для рекламы.
                </p>

                <div style={{ marginTop: "auto" }}>
                  <button
                    disabled
                    style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "1px solid var(--line)", background: "var(--chip)", color: "var(--tx-3)", fontSize: 14, fontWeight: 600, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    Создать 3D за $0.40
                  </button>
                  <p style={{ fontSize: 11, color: "var(--tx-3)", textAlign: "center", marginTop: 6 }}>Скоро</p>
                </div>
              </div>
            </div>

            {/* Навигация */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button onClick={goBack} style={backBtnStyle}><ChevronLeft size={16} /> Назад</button>
              <button onClick={() => setStep(4)} style={nextBtnStyle(false)}>
                Далее <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* ── Step 4 — Launch settings ───────────────────────────────────── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 14, color: "var(--tx-2)", marginBottom: 4 }}>
              Настройте жизненный цикл и маршрутизацию заявок.
            </p>

            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", marginBottom: 14 }}>
                ⚡ Жизненный цикл
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-2)" }}>Авто-закрытие</label>
                <select
                  value={autoCloseDays === null ? "null" : String(autoCloseDays)}
                  onChange={e => setAutoCloseDays(e.target.value === "null" ? null : Number(e.target.value))}
                  style={{ padding: "9px 12px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, color: "var(--tx-1)", outline: "none", cursor: "pointer" }}
                >
                  <option value="null">Бессрочно</option>
                  <option value="1">24 часа</option>
                  <option value="3">3 дня</option>
                  <option value="7">7 дней</option>
                  <option value="30">30 дней</option>
                </select>
                <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>Лендинг автоматически закроется через указанный срок</p>
              </div>
            </div>

            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", marginBottom: 14 }}>
                🔀 Куда идут заявки
              </p>
              {[
                { key: "aiCallback" as const, label: "AI-оператор обрабатывает", desc: "Звонок + WhatsApp за 1 минуту", icon: "🤖" },
                { key: "crm"        as const, label: "Запись в CRM",             desc: "Автоматически в воронку",     icon: "📊" },
                { key: "payments"   as const, label: "Payme / Click оплата",      desc: "Прямо в форме",               icon: "💳" },
              ].map(item => (
                <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-1)", margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: "var(--tx-3)", margin: 0 }}>{item.desc}</p>
                    </div>
                  </div>
                  <div
                    onClick={() => setRouting(p => ({ ...p, [item.key]: !p[item.key] }))}
                    style={{ width: 38, height: 22, borderRadius: 11, background: routing[item.key] ? "var(--accent)" : "var(--line)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                  >
                    <div style={{ position: "absolute", top: 3, left: routing[item.key] ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={goBack} style={backBtnStyle}><ChevronLeft size={16} /> Назад</button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                <Check size={16} />
                {saving ? "Сохраняем..." : "Применить и завершить"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateLandingPage() {
  return (
    <Suspense fallback={null}>
      <CreateLandingPageInner />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-2)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--tx-1)",
  outline: "none",
  boxSizing: "border-box",
};

const nextBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "var(--accent)",
  color: "var(--on-accent)",
  border: "none",
  borderRadius: 10,
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

const backBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "var(--chip)",
  color: "var(--tx-2)",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};
