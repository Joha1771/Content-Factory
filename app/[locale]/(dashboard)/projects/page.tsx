"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useLocale } from "next-intl";
import Link from "next/link";
import { LayoutGrid, List, Search, X } from "lucide-react";

type ProjectTab = { id: string; title: string };
const TABS_KEY = "project_tabs_v2";
const ACTIVE_KEY = "project_active_v2";
function loadTabs(): ProjectTab[] {
  try {
    const d = localStorage.getItem(TABS_KEY);
    if (d) {
      const parsed = JSON.parse(d);
      return parsed.filter((t: ProjectTab) => !t.id.startsWith("draft_"));
    }
  } catch {}
  return [{ id: "all", title: "Все проекты" }];
}
function saveTabs(t: ProjectTab[]) {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(t)); } catch {}
}
function loadActiveId() {
  try {
    const id = localStorage.getItem(ACTIVE_KEY) ?? "all";
    if (id.startsWith("draft_")) return "all";
    return id;
  } catch { return "all"; }
}
function saveActiveId(id: string) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
}

const NICHE_TREE = [
  { icon: "☕", label: "Еда и напитки",      subs: ["Кофейня", "Ресторан", "Доставка еды", "Кондитерская", "Бар", "Фастфуд", "Кейтеринг"] },
  { icon: "👗", label: "Одежда и мода",       subs: ["Женская одежда", "Мужская одежда", "Детская одежда", "Обувь", "Аксессуары", "Спортивная одежда"] },
  { icon: "💄", label: "Красота и уход",      subs: ["Салон красоты", "Косметика", "Маникюр", "СПА", "Парфюм", "Уход за кожей"] },
  { icon: "💻", label: "IT / Технологии",     subs: ["SaaS", "Мобильное приложение", "Веб-разработка", "Геймдев", "Кибербезопасность", "AI / ML"] },
  { icon: "📚", label: "Образование",         subs: ["Онлайн-курсы", "Репетиторство", "Языковая школа", "Детское образование", "Бизнес-обучение"] },
  { icon: "🏋️", label: "Спорт и здоровье",  subs: ["Фитнес-клуб", "Йога / Пилатес", "Единоборства", "Спортпит", "Тренажёры", "Медицина"] },
  { icon: "🏗️", label: "Строительство",      subs: ["Ремонт и отделка", "Дизайн интерьера", "Стройматериалы", "Архитектура", "Инженерные системы"] },
  { icon: "🏠", label: "Товары для дома",     subs: ["Мебель", "Декор", "Кухонные товары", "Бытовая техника", "Текстиль"] },
  { icon: "⚙️", label: "Услуги",             subs: ["Юридические", "Финансовые", "Маркетинг и реклама", "Клининг", "Логистика", "HR"] },
  { icon: "✦",  label: "Другое",             subs: [] },
];

const TONE_TREE = [
  {
    value: "friendly", label: "Дружелюбный", desc: "Тёплый, близкий, человечный",
    subs: [
      { label: "Разговорный",  desc: "Как диалог с другом" },
      { label: "Тёплый",       desc: "С заботой и поддержкой" },
      { label: "Неформальный", desc: "Без официоза, просто" },
      { label: "Молодёжный",   desc: "Актуально и по-свежему" },
    ],
  },
  {
    value: "professional", label: "Профессиональный", desc: "Экспертный, вызывающий доверие",
    subs: [
      { label: "Экспертный",      desc: "Опираюсь на знания и опыт" },
      { label: "Деловой",         desc: "Чётко и по делу" },
      { label: "Консультативный", desc: "Помогаю разобраться" },
      { label: "Авторитетный",    desc: "Лидер мнений в нише" },
    ],
  },
  {
    value: "humorous", label: "Юмористический", desc: "Игривый, с долей юмора",
    subs: [
      { label: "Игривый",     desc: "Лёгкий, с улыбкой" },
      { label: "Ироничный",   desc: "Тонкая ирония без обид" },
      { label: "Мемный",      desc: "Интернет-культура и тренды" },
      { label: "Саркастичный",desc: "Острый, но в тему" },
    ],
  },
  {
    value: "formal", label: "Официальный", desc: "Строгий, корпоративный стиль",
    subs: [
      { label: "Строгий",      desc: "Без лишних слов" },
      { label: "Нейтральный",  desc: "Без эмоций, только факты" },
      { label: "Корпоративный",desc: "B2B, официальные коммуникации" },
      { label: "Академический",desc: "Научный, методичный" },
    ],
  },
];
const LANGS = [
  { value: "ru", label: "Русский" },
  { value: "uz", label: "Узбекский" },
  { value: "en", label: "English" },
];
const COLORS = ["#4ABA74", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#0088CC", "#E1306C"];
const colorFor = (id: string) => COLORS[id.charCodeAt(0) % COLORS.length];

// ── Draft / Form types ──────────────────────────────────────────────────────

type FormState = {
  name: string; niche: string; description: string;
  audience: string; tone: string; language: string; logo_url: string;
  country: string; phone: string; website: string; keywords: string;
};
type FormSnapshot = { form: FormState; nicheCategory: string; toneSub: string };
type Draft = { id: string; name: string; snapshot: FormSnapshot; savedAt: string };

const DRAFTS_KEY = "project_drafts_v1";
function loadDrafts(): Draft[] {
  try { const d = localStorage.getItem(DRAFTS_KEY); if (d) return JSON.parse(d); } catch {}
  return [];
}
function saveDraftsStorage(drafts: Draft[]) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch {}
}
const TAB_SNAPSHOTS_KEY = "project_tab_snapshots_v1";
function loadTabSnapshots(): Record<string, FormSnapshot> {
  try { const d = localStorage.getItem(TAB_SNAPSHOTS_KEY); if (d) return JSON.parse(d); } catch {}
  return {};
}
function saveTabSnapshot(tabId: string, snap: FormSnapshot) {
  try {
    const all = loadTabSnapshots();
    all[tabId] = snap;
    localStorage.setItem(TAB_SNAPSHOTS_KEY, JSON.stringify(all));
  } catch {}
}
function deleteTabSnapshot(tabId: string) {
  try {
    const all = loadTabSnapshots();
    delete all[tabId];
    localStorage.setItem(TAB_SNAPSHOTS_KEY, JSON.stringify(all));
  } catch {}
}
function getNicheCategory(niche: string): string {
  if (!niche) return "";
  if (NICHE_TREE.find((n) => n.label === niche)) return niche;
  return NICHE_TREE.find((n) => n.subs.includes(niche))?.label ?? "";
}

// ── ProjectForm ─────────────────────────────────────────────────────────────

function ProjectForm({
  tabId,
  onSaved,
  onNameChange,
  onDirtyChange,
  onFormChange,
  initialSnapshot,
  projectId,
}: {
  tabId: string;
  onSaved?: () => void;
  onNameChange?: (n: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onFormChange?: (snap: FormSnapshot) => void;
  initialSnapshot?: FormSnapshot;
  projectId?: string;
}) {

  const qc = useQueryClient();

  const defaultForm: FormState = {
    name: "", niche: "", description: "", audience: "",
    tone: "friendly", language: "ru", logo_url: "",
    country: "", phone: "", website: "", keywords: "",
  };

  const [form, setForm] = useState<FormState>(
    initialSnapshot ? initialSnapshot.form : defaultForm,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialSnapshot?.form.logo_url || null,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [nicheCategory, setNicheCategory] = useState(
    initialSnapshot ? initialSnapshot.nicheCategory : "",
  );
  const [toneSub, setToneSub] = useState(
    initialSnapshot ? initialSnapshot.toneSub : "",
  );
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const onFormChangeRef = useRef(onFormChange);
  useEffect(() => { onFormChangeRef.current = onFormChange; });
  useEffect(() => {
    onFormChangeRef.current?.({ form, nicheCategory, toneSub });
  }, [form, nicheCategory, toneSub]);

  const { data: existingNames = [] } = useQuery({
    queryKey: ["project_names", projectId],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) return [];
      const data = await res.json();
      return (data ?? [])
        .filter((p: any) => p.id !== projectId)
        .map((p: any) => p.name.toLowerCase().trim());
    },
  });

  const onNameChangeRef = useRef(onNameChange);
  useEffect(() => { onNameChangeRef.current = onNameChange; });
  useEffect(() => { onNameChangeRef.current?.(form.name); }, [form.name]);

  const handleNameChange = (val: string) => {
    setForm((p) => ({ ...p, name: val }));
    onDirtyChange?.(true);
    setNameError(
      existingNames.includes(val.toLowerCase().trim())
        ? "Проект с таким именем уже существует"
        : "",
    );
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    onDirtyChange?.(true);
    const r = new FileReader();
    r.onload = (ev) => setLogoPreview(ev.target?.result as string);
    r.readAsDataURL(file);
  };

  const handleAiGenerate = async () => {
    if (!form.name.trim()) return;
    setAiGenerating(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/suggest-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, niche: form.niche, keywords: form.keywords }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Ошибка сервера ${res.status}`);
      }
      const data = await res.json();
      if (data.description) f("description", data.description);
      if (data.audience) f("audience", data.audience);
      if (data.keywords) f("keywords", data.keywords);
    } catch (e: any) {
      setAiError(e.message || "Не удалось сгенерировать. Попробуйте ещё раз.");
    } finally {
      setAiGenerating(false);
    }
  };

  const resizeLogo = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      if (!dataUrl.startsWith("data:")) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width; let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handleAiFromImage = async () => {
    if (!logoPreview) return;
    setAiGenerating(true);
    setAiError("");
    try {
      const resized = await resizeLogo(logoPreview);
      const mimeMatch = resized.match(/^data:([^;]+);/);
      const logoMime = mimeMatch?.[1] || "image/jpeg";
      const res = await fetch("/api/ai/suggest-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name || undefined, logoBase64: resized, logoMime }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Ошибка сервера ${res.status}`);
      }
      const data = await res.json();
      if (data.name && !form.name.trim()) f("name", data.name);
      if (data.description) f("description", data.description);
      if (data.audience) f("audience", data.audience);
      if (data.keywords) f("keywords", data.keywords);
      if (data.tone) f("tone", data.tone);
      if (data.language) f("language", data.language);
      if (data.niche) {
        f("niche", data.niche);
        const match = NICHE_TREE.find((n) => n.label === data.niche || data.niche.includes(n.label));
        if (match) setNicheCategory(match.label);
      }
    } catch (e: any) {
      setAiError(e.message || "Не удалось проанализировать логотип.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || nameError) return;
    setSaving(true);
    try {
      let logo_url = form.logo_url;
      if (logoFile) {
        const raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
        const base64 = await resizeLogo(raw);
        const upRes = await fetch("/api/upload/logo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, name: logoFile.name }),
        });
        if (!upRes.ok) {
          const errData = await upRes.json().catch(() => ({}));
          alert("Ошибка загрузки логотипа: " + (errData.error || upRes.status));
          setSaving(false);
          return;
        }
        const { url } = await upRes.json();
        logo_url = url;
      }

      const payload = {
        name: form.name.trim(),
        niche: form.niche || null,
        description: form.description || null,
        audience: form.audience || null,
        tone: form.tone,
        language: form.language,
        logo_url: logo_url || null,
        country: form.country || null,
        phone: form.phone || null,
        website: form.website || null,
        keywords: form.keywords || null,
      };

      const res = projectId
        ? await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setNameError(d.error || "Проект с таким названием уже существует");
          return;
        }
        throw new Error(d.error || "Ошибка сохранения");
      }

      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_names"] });
      qc.invalidateQueries({ queryKey: ["projects_selector"] });
      onDirtyChange?.(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved?.(); }, 1500);
    } catch (e: any) {
      alert("Ошибка: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp =
    "w-full px-3 py-2.5 rounded-[8px] border border-line text-[12px] outline-none focus:border-line-strong bg-panel text-tx-1 placeholder:text-tx-3";
  const f = (key: keyof FormState, val: string) => {
    setForm((p) => ({ ...p, [key]: val }));
    onDirtyChange?.(true);
  };

  return (
    <>
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Логотип */}
        <div>
          <label className="block ui-label mb-2">Логотип</label>
          <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoFile} style={{ display: "none" }} />
          {logoPreview ? (
            <div className="flex items-center gap-3 p-3 bg-panel-2 border border-line rounded-[9px]">
              <img
                src={logoPreview}
                alt=""
                onClick={() => setLogoModalOpen(true)}
                style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0, cursor: "zoom-in" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-tx-1 mb-1.5">Логотип загружен</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => { setLogoFile(null); setLogoPreview(null); setForm((p) => ({ ...p, logo_url: "" })); }}
                    className="text-[11px] text-neg cursor-pointer"
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    Удалить
                  </button>
                  <button
                    onClick={handleAiFromImage}
                    disabled={aiGenerating}
                    className="flex items-center gap-1 text-[11px] font-medium cursor-pointer disabled:opacity-60 transition-opacity"
                    style={{ background: "none", border: "none", padding: 0, color: "var(--accent)" }}
                  >
                    <span>✦</span>
                    <span>{aiGenerating ? "Анализирую..." : "AI заполнить всё по логотипу"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => logoRef.current?.click()}
              className="w-full py-5 border border-dashed border-line hover:border-line-strong rounded-[9px] flex flex-col items-center gap-2 cursor-pointer hover:bg-hover transition-colors"
            >
              <span style={{ fontSize: 24 }}>📷</span>
              <span className="text-[11px] text-tx-3">Загрузить логотип</span>
            </button>
          )}
        </div>

        {/* Название */}
        <div>
          <label className="block ui-label mb-1">Название *</label>
          <input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Например: Пятый Элемент"
            className={`${inp} ${nameError ? "border-neg" : ""}`}
          />
          {nameError && <p className="text-[10px] text-neg mt-1">{nameError}</p>}
        </div>

        {/* Ниша */}
        <div>
          <label className="block ui-label mb-2">Ниша</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {NICHE_TREE.map((n) => {
              const isActive = nicheCategory === n.label;
              return (
                <button
                  key={n.label}
                  onClick={() => {
                    if (isActive) { setNicheCategory(""); f("niche", ""); }
                    else { setNicheCategory(n.label); f("niche", n.subs.length === 0 ? n.label : ""); }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] border cursor-pointer transition-colors ${
                    isActive ? "bg-accent text-on-accent border-accent" : "border-line text-tx-2 hover:bg-hover"
                  }`}
                >
                  <span>{n.icon}</span><span>{n.label}</span>
                </button>
              );
            })}
          </div>
          {nicheCategory && (() => {
            const parent = NICHE_TREE.find((n) => n.label === nicheCategory);
            if (!parent) return null;
            if (parent.subs.length === 0) {
              const customVal = form.niche === nicheCategory ? "" : form.niche;
              return (
                <div className="pl-2 border-l-2 border-accent/30 ml-1">
                  <p className="text-[10px] text-tx-3 mb-1.5">
                    Введи свою нишу · <span className="text-accent">{nicheCategory}</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customVal}
                      onChange={(e) => f("niche", e.target.value || nicheCategory)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      placeholder="Например: Ювелирные украшения, Рыбалка..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-[7px] border border-line bg-panel-2 text-[12px] text-tx-1 outline-none focus:border-accent"
                    />
                    {customVal && (
                      <button
                        onClick={() => {}}
                        style={{ padding: "4px 10px", borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, fontWeight: 600, border: "none", cursor: "default" }}
                      >
                        ✓ {customVal}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="pl-2 border-l-2 border-accent/30 ml-1">
                <p className="text-[10px] text-tx-3 mb-1.5">
                  Уточни подкатегорию · <span className="text-accent">{nicheCategory}</span>
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {parent.subs.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => f("niche", form.niche === sub ? "" : sub)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] border cursor-pointer transition-colors ${
                        form.niche === sub ? "bg-accent text-on-accent border-accent" : "border-line text-tx-2 hover:bg-hover"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Тон */}
        <div>
          <label className="block ui-label mb-2">Тон коммуникации</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {TONE_TREE.map((t) => {
              const isActive = form.tone === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => { f("tone", t.value); setToneSub(""); }}
                  className={`flex flex-col items-start px-3 py-2 rounded-[8px] border cursor-pointer transition-colors text-left ${
                    isActive ? "bg-accent text-on-accent border-accent" : "border-line hover:bg-hover"
                  }`}
                >
                  <span className={`text-[12px] font-medium ${isActive ? "text-on-accent" : "text-tx-1"}`}>{t.label}</span>
                  <span className={`text-[10px] mt-0.5 ${isActive ? "text-on-accent/70" : "text-tx-3"}`}>{t.desc}</span>
                </button>
              );
            })}
          </div>
          {form.tone && (() => {
            const parent = TONE_TREE.find((t) => t.value === form.tone);
            if (!parent) return null;
            return (
              <div className="pl-2 border-l-2 border-accent/30 ml-1">
                <p className="text-[10px] text-tx-3 mb-1.5">
                  Уточни стиль · <span className="text-accent">{parent.label}</span>
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {parent.subs.map((sub) => (
                    <button
                      key={sub.label}
                      onClick={() => setToneSub(toneSub === sub.label ? "" : sub.label)}
                      title={sub.desc}
                      className={`flex flex-col px-2.5 py-1.5 rounded-[7px] border cursor-pointer transition-colors text-left ${
                        toneSub === sub.label ? "bg-accent/10 border-accent text-accent" : "border-line text-tx-2 hover:bg-hover"
                      }`}
                    >
                      <span className="text-[11px] font-medium">{sub.label}</span>
                      <span className="text-[9px] text-tx-3 mt-0.5">{sub.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Язык */}
        <div>
          <label className="block ui-label mb-2">Язык</label>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.value}
                onClick={() => f("language", l.value)}
                className={`px-4 py-1.5 rounded-[7px] text-[11px] border cursor-pointer transition-colors ${
                  form.language === l.value ? "bg-accent text-on-accent border-accent" : "border-line text-tx-2 hover:bg-hover"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block ui-label mb-1">Описание бренда</label>
          <textarea
            value={form.description}
            onChange={(e) => f("description", e.target.value)}
            placeholder="Чем занимается компания, что продаёт, какие ценности..."
            className={`${inp} resize-none h-24`}
          />
        </div>
        <div>
          <label className="block ui-label mb-1">Целевая аудитория</label>
          <textarea
            value={form.audience}
            onChange={(e) => f("audience", e.target.value)}
            placeholder="Возраст, интересы, география, боли и желания..."
            className={`${inp} resize-none h-16`}
          />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <label className="block ui-label">Ключевые слова</label>
            <button
              onClick={handleAiGenerate}
              disabled={!form.name.trim() || aiGenerating}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: !form.name.trim() || aiGenerating ? 0.5 : 1 }}
            >
              {aiGenerating ? "⟳ Генерирую..." : "✦ AI заполнить"}
            </button>
          </div>
          <input
            value={form.keywords}
            onChange={(e) => f("keywords", e.target.value)}
            placeholder="пицца, доставка, Ташкент, быстро..."
            className={inp}
          />
          {aiError && (
            <p style={{ fontSize: 10, color: "var(--neg)", marginTop: 4 }}>⚠ {aiError}</p>
          )}
          <p style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 3 }}>Введи ключевые слова и нажми «AI заполнить» — описание и аудитория заполнятся автоматически</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="block ui-label mb-1">Страна</label>
            <input
              value={form.country}
              onChange={(e) => f("country", e.target.value)}
              placeholder="Узбекистан"
              className={inp}
            />
          </div>
          <div>
            <label className="block ui-label mb-1">Телефон</label>
            <input
              value={form.phone}
              onChange={(e) => f("phone", e.target.value)}
              placeholder="+998 90 000 00 00"
              className={inp}
            />
          </div>
        </div>
        <div>
          <label className="block ui-label mb-1">Сайт</label>
          <input
            value={form.website}
            onChange={(e) => f("website", e.target.value)}
            placeholder="https://example.com"
            className={inp}
          />
        </div>
        <div className="p-3 bg-chip/30 rounded-[10px] border border-line">
          <div className="flex items-start gap-2">
            <span style={{ fontSize: 14 }}>✦</span>
            <div>
              <p className="text-[11px] font-semibold text-tx-1 mb-0.5">Чем больше заполнишь — тем лучше AI</p>
              <p className="text-[10px] text-tx-3 leading-relaxed">
                Описание и аудитория используются при генерации контента и рекомендаций
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!form.name.trim() || !!nameError || saving}
          className="w-full py-3 bg-accent text-on-accent text-[13px] font-semibold rounded-[9px] cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "⟳ Сохранение..." : saved ? "✓ Сохранено!" : projectId ? "✏️ Сохранить изменения" : "📁 Создать проект"}
        </button>
      </div>
    </div>

    {/* Logo lightbox */}
    {logoModalOpen && logoPreview && (
      <div
        onClick={() => setLogoModalOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <button
          onClick={() => setLogoModalOpen(false)}
          style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}
        >
          ✕
        </button>
        <img
          src={logoPreview}
          alt=""
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "80vw", maxHeight: "80vh", borderRadius: 16, objectFit: "contain", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
        />
      </div>
    )}
    </>
  );
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const snapRef = useRef<FormSnapshot | null>(null);

  const initialSnapshot: FormSnapshot = {
    form: {
      name: project.name ?? "",
      niche: project.niche ?? "",
      description: project.description ?? "",
      audience: project.audience ?? "",
      tone: project.tone ?? "friendly",
      language: project.language ?? "ru",
      logo_url: project.logo_url ?? "",
      country: project.country ?? "",
      phone: project.phone ?? "",
      website: project.website ?? "",
      keywords: project.keywords ?? "",
    },
    nicheCategory: getNicheCategory(project.niche ?? ""),
    toneSub: "",
  };

  const handleClose = () => {
    if (dirty) setShowConfirm(true);
    else onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 301,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px", pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "var(--bg)", border: "0.5px solid var(--line)",
            borderRadius: 16, width: "100%", maxWidth: 820,
            maxHeight: "90vh", display: "flex", flexDirection: "column",
            boxShadow: "0 32px 80px rgba(0,0,0,0.3)", pointerEvents: "all",
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderBottom: "0.5px solid var(--line)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {project.logo_url ? (
                <img src={project.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: colorFor(project.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                  }}
                >
                  {project.name?.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)" }}>
                  Редактирование проекта
                </p>
                <p style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 1 }}>{project.name}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--line)",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--tx-3)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--hover)";
                (e.currentTarget as HTMLElement).style.color = "var(--tx-1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--tx-3)";
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Modal body — scrollable */}
          <div style={{ overflowY: "auto", padding: "24px", flex: 1 }}>
            <ProjectForm
              tabId={`edit_${project.id}`}
              projectId={project.id}
              initialSnapshot={initialSnapshot}
              onDirtyChange={setDirty}
              onFormChange={(snap) => { snapRef.current = snap; }}
              onSaved={() => { onSaved(); onClose(); }}
            />
          </div>
        </div>
      </div>

      {/* Confirm close dialog */}
      {showConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--panel)", border: "0.5px solid var(--line)",
              borderRadius: 16, width: "100%", maxWidth: 360, padding: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)", textAlign: "center", marginBottom: 6 }}>
              Несохранённые изменения
            </p>
            <p style={{ fontSize: 12, color: "var(--tx-3)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              Вы изменили данные проекта, но не сохранили. Что сделать?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: "var(--accent)", color: "var(--on-accent)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ← Продолжить редактирование
              </button>
              <button
                onClick={() => { setShowConfirm(false); onClose(); }}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  border: "0.5px solid var(--line)", background: "transparent",
                  color: "var(--neg)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                🗑 Закрыть без сохранения
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function ProjectsPageInner() {
  const qc = useQueryClient();
  const locale = useLocale();

  const [tabs, setTabs] = useState<ProjectTab[]>(() => {
    if (typeof window === "undefined") return [{ id: "all", title: "Все проекты" }];
    const loaded = loadTabs();
    if (!loaded.find((t) => t.id === "all")) return [{ id: "all", title: "Все проекты" }, ...loaded];
    return loaded;
  });
  const [activeId, setActiveId] = useState(() =>
    typeof window !== "undefined" ? loadActiveId() : "all",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [closeConfirm, setCloseConfirm] = useState<{ id: string; title: string } | null>(null);
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [draftTabIds, setDraftTabIds] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const tabFormDataRef = useRef<Record<string, FormSnapshot>>({});
  const savedSnapshotsRef = useRef<Record<string, FormSnapshot>>(
    typeof window !== "undefined" ? loadTabSnapshots() : {}
  );

  useEffect(() => { setDrafts(loadDrafts()); }, []);
  useEffect(() => { saveTabs(tabs); }, [tabs]);
  useEffect(() => { saveActiveId(activeId); }, [activeId]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: projectStats = {} } = useQuery({
    queryKey: ["project_stats"],
    queryFn: async () => {
      const res = await fetch("/api/projects/stats");
      if (!res.ok) return {};
      return res.json();
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Ошибка удаления");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_names"] });
      qc.invalidateQueries({ queryKey: ["projects_selector"] });
    },
    onError: (e: any) => alert("Ошибка: " + e.message),
  });

  const addTab = () => {
    const id = String(Date.now());
    setTabs((prev) => [...prev, { id, title: "Новый проект" }]);
    setActiveId(id);
  };

  const openDraftTab = (draft: Draft) => {
    const tabId = `draft_${draft.id}`;
    if (!tabs.find((t) => t.id === tabId)) {
      setTabs((prev) => [...prev, { id: tabId, title: draft.name || "Черновик" }]);
      setDraftTabIds((prev) => ({ ...prev, [tabId]: draft.id }));
    }
    setActiveId(tabId);
    saveActiveId(tabId);
  };

  const handleSaveDraft = (tabId: string) => {
    const snap = tabFormDataRef.current[tabId];
    if (!snap) return;
    const draft: Draft = {
      id: String(Date.now()),
      name: snap.form.name || "Черновик",
      snapshot: snap,
      savedAt: new Date().toISOString(),
    };
    setDrafts((prev) => {
      const updated = [...prev, draft];
      saveDraftsStorage(updated);
      return updated;
    });
  };

  const deleteDraft = (draftId: string) => {
    setDrafts((prev) => {
      const updated = prev.filter((d) => d.id !== draftId);
      saveDraftsStorage(updated);
      return updated;
    });
  };

  const forceCloseTab = (id: string) => {
    if (id === "all") return;
    deleteTabSnapshot(id);
    delete savedSnapshotsRef.current[id];
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) { setActiveId("all"); saveActiveId("all"); }
      return next;
    });
    setDirtyTabs((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setDraftTabIds((prev) => { const next = { ...prev }; delete next[id]; return next; });
    delete tabFormDataRef.current[id];
  };

  const tryCloseTab = (id: string) => {
    if (id === "all") return;
    const tab = tabs.find((t) => t.id === id);
    if (tab && dirtyTabs.has(id)) setCloseConfirm({ id, title: tab.title });
    else forceCloseTab(id);
  };

  const updateTitle = (id: string, title: string) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title: title || "Новый проект" } : t)));

  const getDraftForTab = (tabId: string): Draft | undefined => {
    const draftId = draftTabIds[tabId];
    return draftId ? drafts.find((d) => d.id === draftId) : undefined;
  };

  const filtered = projects.filter(
    (p: any) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.niche ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", height: 44,
          borderBottom: "0.5px solid var(--line)", background: "var(--panel)", flexShrink: 0,
        }}
      >
        <p style={{ fontSize: 11, color: "var(--tx-3)" }}>
          Маркетинг / <span style={{ color: "var(--tx-2)", fontWeight: 500 }}>Проекты</span>
        </p>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {activeId === "all" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "0.5px solid var(--line)", borderRadius: 8, background: "var(--panel)" }}>
                <Search size={13} style={{ color: "var(--tx-3)", flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск проектов..."
                  style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--tx-1)", width: 160, fontFamily: "inherit" }}
                />
              </div>
              <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--panel-2)", border: "0.5px solid var(--line)", borderRadius: 8 }}>
                {(["grid", "list"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: viewMode === m ? "var(--panel)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: viewMode === m ? "var(--tx-1)" : "var(--tx-3)" }}
                  >
                    {m === "grid" ? <LayoutGrid size={14} /> : <List size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            onClick={addTab}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Новый проект
          </button>
        </div>
      </div>

      {/* Browser tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 14px 0", borderBottom: "0.5px solid var(--line)", background: "var(--panel)", overflowX: "auto", flexShrink: 0 }}>
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const isDraft = tab.id.startsWith("draft_");
          return (
            <div
              key={tab.id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 7px", borderRadius: "8px 8px 0 0", background: active ? "var(--bg)" : "var(--panel-2)", border: `0.5px solid ${active ? "var(--line)" : "transparent"}`, borderBottom: active ? "1px solid var(--bg)" : "none", cursor: "pointer", flexShrink: 0, marginBottom: active ? -1 : 0 }}
              onClick={() => { setActiveId(tab.id); saveActiveId(tab.id); }}
            >
              <span style={{ fontSize: 10 }}>{tab.id === "all" ? "📁" : isDraft ? "📝" : "✦"}</span>
              <span style={{ fontSize: 11, fontWeight: active ? 500 : 400, color: active ? "var(--tx-1)" : "var(--tx-3)", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                {tab.title}
              </span>
              {tab.id !== "all" && (
                <button
                  onClick={(e) => { e.stopPropagation(); tryCloseTab(tab.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx-3)", fontSize: 13, padding: "0 2px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--tx-1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--tx-3)")}
                >✕</button>
              )}
            </div>
          );
        })}
        <button
          onClick={addTab}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--tx-3)", fontSize: 16, flexShrink: 0, marginLeft: 2 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover)"; (e.currentTarget as HTMLElement).style.color = "var(--tx-1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--tx-3)"; }}
        >+</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>

        {/* All projects tab */}
        {activeId === "all" && (
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Всего проектов", v: projects.length, icon: "📁" },
                { l: "Активных кампаний", v: Object.values(projectStats as any).reduce((s: number, st: any) => s + (st.campaigns ?? 0), 0), icon: "📡" },
                { l: "Контент материалов", v: Object.values(projectStats as any).reduce((s: number, st: any) => s + (st.contents ?? 0), 0), icon: "📝" },
                { l: "AI-агентов", v: Object.values(projectStats as any).reduce((s: number, st: any) => s + (st.agents ?? 0), 0), icon: "🤖" },
              ].map((k) => (
                <div key={k.l} className="ui-surface px-4 py-3">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                    <p className="ui-label">{k.l}</p>
                  </div>
                  <p className="text-[22px] font-semibold text-tx-1">{k.v}</p>
                </div>
              ))}
            </div>

            {/* Drafts section */}
            {drafts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14 }}>📝</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>Черновики</p>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#d97706" }}>
                    {drafts.length}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {drafts.map((draft) => (
                    <div key={draft.id} className="ui-surface p-3" style={{ borderStyle: "dashed" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          📝
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {draft.name || "Без названия"}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 2 }}>
                            {new Date(draft.savedAt).toLocaleDateString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      {draft.snapshot.form.niche && (
                        <p style={{ fontSize: 10, color: "var(--tx-3)", marginBottom: 8 }}>{draft.snapshot.form.niche}</p>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openDraftTab(draft)}
                          style={{ flex: 1, padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          ✏️ Продолжить
                        </button>
                        <button
                          onClick={() => { if (confirm("Удалить черновик?")) deleteDraft(draft.id); }}
                          style={{ padding: "6px 8px", borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", color: "var(--neg)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && <div style={{ textAlign: "center", padding: 40, color: "var(--tx-3)", fontSize: 12 }}>Загрузка...</div>}

            {!isLoading && filtered.length === 0 && search && (
              <div className="ui-surface flex flex-col items-center py-10 text-center">
                <p className="text-[13px] text-tx-2">Нет проектов по запросу «{search}»</p>
              </div>
            )}

            {!isLoading && projects.length === 0 && (
              <div className="ui-surface flex flex-col items-center py-16 text-center">
                <div style={{ fontSize: 48, marginBottom: 14 }}>📁</div>
                <p className="text-[16px] font-semibold text-tx-1 mb-2">Нет проектов</p>
                <p className="text-[12px] text-tx-3 mb-5 max-w-[280px] leading-relaxed">
                  Создайте первый проект — он станет основой для кампаний и контента
                </p>
                <button onClick={addTab} style={{ padding: "10px 24px", borderRadius: 9, background: "var(--accent)", color: "var(--on-accent)", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  + Создать проект
                </button>
              </div>
            )}

            {/* Grid view */}
            {viewMode === "grid" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {filtered.map((p: any) => {
                  const stats = (projectStats as any)[p.id] ?? { campaigns: 0, contents: 0, agents: 0 };
                  return (
                    <div key={p.id} className="ui-surface p-4">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        {p.logo_url ? (
                          <img src={p.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: colorFor(p.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p className="text-[14px] font-semibold text-tx-1 truncate">{p.name}</p>
                            {(!p.niche || !p.description || !p.audience || (stats?.contents ?? 0) === 0) && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#d97706", whiteSpace: "nowrap", flexShrink: 0 }}>
                                ⏳ В процессе
                              </span>
                            )}
                          </div>
                          {p.niche && <p className="text-[11px] text-tx-3 mt-0.5">{p.niche}</p>}
                        </div>
                      </div>
                      {p.description && <p className="text-[11px] text-tx-2 leading-relaxed mb-3 line-clamp-2">{p.description}</p>}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
                        {[{ l: "Кампаний", v: stats.campaigns, icon: "📡" }, { l: "Материалов", v: stats.contents, icon: "📝" }, { l: "Агентов", v: stats.agents, icon: "🤖" }].map((s) => (
                          <div key={s.l} style={{ padding: "6px 8px", background: "var(--panel-2)", borderRadius: 7, textAlign: "center" }}>
                            <p style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)" }}>{s.v}</p>
                            <p style={{ fontSize: 9, color: "var(--tx-3)" }}>{s.l}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/${locale}/projects/${p.id}`} style={{ flex: 1, padding: "7px", borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          Открыть
                        </Link>
                        <button
                          onClick={() => setEditingProject(p)}
                          style={{ flex: 1, padding: "7px", borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.color = "var(--tx-2)"; }}
                        >
                          ✏️ Изменить
                        </button>
                        <button
                          onClick={() => { if (confirm(`Удалить «${p.name}»?`)) deleteProject.mutate(p.id); }}
                          style={{ padding: "7px 10px", borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", color: "var(--neg)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div onClick={addTab} className="border border-dashed border-line rounded-[10px] flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[200px]" onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}>
                  <span style={{ fontSize: 28, color: "var(--tx-3)", marginBottom: 8 }}>+</span>
                  <p className="text-[11px] text-tx-3">Новый проект</p>
                </div>
              </div>
            )}

            {/* List view */}
            {viewMode === "list" && filtered.length > 0 && (
              <div className="ui-surface overflow-hidden">
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 160px", gap: 0, padding: "8px 16px", borderBottom: "0.5px solid var(--line)", background: "var(--panel-2)" }}>
                  {["Проект", "Кампаний", "Материалов", "Агентов", "Ниша", ""].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tx-3)" }}>{h}</span>
                  ))}
                </div>
                {filtered.map((p: any, i: number) => {
                  const stats = (projectStats as any)[p.id] ?? { campaigns: 0, contents: 0, agents: 0 };
                  return (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 160px", gap: 0, padding: "12px 16px", borderBottom: i < filtered.length - 1 ? "0.5px solid var(--line)" : "none", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {p.logo_url ? (
                          <img src={p.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: colorFor(p.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-1)" }}>{p.name}</p>
                          {(!p.niche || !p.description || !p.audience || (stats?.contents ?? 0) === 0) && (
                            <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#d97706", whiteSpace: "nowrap" }}>⏳ В процессе</span>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--tx-2)" }}>{stats.campaigns}</p>
                      <p style={{ fontSize: 13, color: "var(--tx-2)" }}>{stats.contents}</p>
                      <p style={{ fontSize: 13, color: "var(--tx-2)" }}>{stats.agents}</p>
                      <p style={{ fontSize: 11, color: "var(--tx-3)" }}>{p.niche ?? "—"}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/${locale}/projects/${p.id}`} style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 11, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                          Открыть
                        </Link>
                        <button
                          onClick={() => setEditingProject(p)}
                          style={{ padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.color = "var(--tx-2)"; }}
                        >✏️</button>
                        <button
                          onClick={() => { if (confirm(`Удалить «${p.name}»?`)) deleteProject.mutate(p.id); }}
                          style={{ padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--line)", background: "transparent", color: "var(--neg)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                        >🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create / Draft tabs */}
        {activeId !== "all" && (
          <div>
            {tabs.filter((t) => t.id !== "all" && t.id === activeId).map((tab) => {
              const isDraft = tab.id.startsWith("draft_");
              const draft = getDraftForTab(tab.id);
              return (
                <div key={tab.id}>
                  {isDraft && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 16, borderBottom: "0.5px solid var(--line)" }}>
                      <span style={{ fontSize: 16 }}>📝</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)" }}>Черновик</p>
                        <p style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>Продолжите заполнение и создайте проект</p>
                      </div>
                    </div>
                  )}
                  <ProjectForm
                    key={tab.id}
                    tabId={tab.id}
                    initialSnapshot={isDraft && draft ? draft.snapshot : savedSnapshotsRef.current[tab.id]}
                    onNameChange={(n) => updateTitle(tab.id, n)}
                    onDirtyChange={(dirty) =>
                      setDirtyTabs((prev) => {
                        const next = new Set(prev);
                        if (dirty) next.add(tab.id); else next.delete(tab.id);
                        return next;
                      })
                    }
                    onFormChange={(snap) => {
                      tabFormDataRef.current[tab.id] = snap;
                      if (!isDraft) saveTabSnapshot(tab.id, snap);
                    }}
                    onSaved={() => {
                      deleteTabSnapshot(tab.id);
                      delete savedSnapshotsRef.current[tab.id];
                      if (isDraft && draft) deleteDraft(draft.id);
                      setActiveId("all");
                      saveActiveId("all");
                      forceCloseTab(tab.id);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Close confirm for create/draft tabs */}
      {closeConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)", textAlign: "center", marginBottom: 6 }}>Несохранённые изменения</p>
            <p style={{ fontSize: 12, color: "var(--tx-3)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              «{closeConfirm.title}» содержит незаполненные данные. Что сделать?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => setCloseConfirm(null)}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                ← Продолжить редактирование
              </button>
              <button
                onClick={() => {
                  handleSaveDraft(closeConfirm.id);
                  setCloseConfirm(null);
                  forceCloseTab(closeConfirm.id);
                }}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "0.5px solid var(--line)", background: "var(--panel-2)", color: "var(--tx-1)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                📝 Добавить в черновик
              </button>
              <button
                onClick={() => { setCloseConfirm(null); forceCloseTab(closeConfirm.id); }}
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: "0.5px solid var(--line)", background: "transparent", color: "var(--neg)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
              >
                🗑 Удалить без сохранения
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={() => {
            setEditingProject(null);
            qc.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageInner />
    </Suspense>
  );
}
