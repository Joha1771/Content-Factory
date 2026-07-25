"use client";
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ChevronRight, Sparkles, CheckCircle } from "lucide-react";

type Tip = { icon: string; text: string; task?: string };

const PANEL_KEY = "ai_advisor_collapsed";
const CACHE_KEY = "ai_advisor_cache_v2";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

interface CacheEntry {
  pathname: string;
  tips: Tip[];
  contextLabel: string;
  ts: number;
}

function loadCache(pathname: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.pathname !== pathname) return null;
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry;
  } catch { return null; }
}

function saveCache(pathname: string, tips: Tip[], contextLabel: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ pathname, tips, contextLabel, ts: Date.now() }));
  } catch {}
}

export function AiAdvisorPanel({ pathname }: { pathname: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);
  const [contextLabel, setContextLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [addedTasks, setAddedTasks] = useState<Record<number, boolean>>({});
  const [addingTask, setAddingTask] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PANEL_KEY);
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(PANEL_KEY, String(next)); } catch {}
      return next;
    });
  };

  const fetchTips = useCallback(async (path: string, force = false) => {
    if (!force) {
      const cached = loadCache(path);
      if (cached) {
        setTips(cached.tips);
        setContextLabel(cached.contextLabel);
        return;
      }
    }
    setLoading(true);
    setError(false);
    setAddedTasks({});
    try {
      const r = await fetch("/api/ai/page-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: path }),
      });
      const data = await r.json();
      const newTips: Tip[] = data.tips ?? [];
      const label: string = data.context ?? "";
      setTips(newTips);
      setContextLabel(label);
      saveCache(path, newTips, label);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAddedTasks({});
    const cached = loadCache(pathname);
    if (cached) {
      setTips(cached.tips);
      setContextLabel(cached.contextLabel);
    } else {
      setTips([]);
      setContextLabel("");
    }
  }, [pathname]);

  const handleAddTask = async (tip: Tip, idx: number) => {
    if (addedTasks[idx] || addingTask === idx) return;
    setAddingTask(idx);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tip.task ?? tip.text.slice(0, 60),
          description: tip.text,
          priority: "medium",
          status: "todo",
        }),
      });
      setAddedTasks((p) => ({ ...p, [idx]: true }));
    } catch {}
    setAddingTask(null);
  };

  if (collapsed) {
    return (
      <div
        style={{ width: 36, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 8 }}
        className="hidden md:flex"
      >
        <button
          onClick={toggleCollapsed}
          title="Открыть AI-советник"
          style={{ width: 28, height: 28, borderRadius: 8, border: "0.5px solid var(--line)", background: "var(--panel-2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--accent)" }}
        >
          <Sparkles size={13} />
        </button>
        <div style={{ width: 1, flex: 1, background: "var(--line)" }} />
      </div>
    );
  }

  return (
    <div
      style={{ width: 240, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      className="hidden md:flex"
    >
      {/* Header */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ color: "var(--accent)", display: "flex" }}><Sparkles size={13} /></span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-1)", flex: 1 }}>AI-советник</span>
        <button
          onClick={toggleCollapsed}
          style={{ width: 20, height: 20, borderRadius: 5, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--tx-3)" }}
          title="Свернуть"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Context label */}
      {contextLabel && !loading && (
        <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: "var(--tx-3)", lineHeight: 1.4 }}>{contextLabel}</p>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ borderRadius: 8, padding: "10px 12px", background: "var(--panel-2)", border: "0.5px solid var(--line)" }}>
                <div style={{ height: 8, borderRadius: 4, background: "var(--line)", marginBottom: 6, width: "60%" }} />
                <div style={{ height: 7, borderRadius: 4, background: "var(--line)", width: "90%" }} />
                <div style={{ height: 7, borderRadius: 4, background: "var(--line)", width: "75%", marginTop: 4 }} />
              </div>
            ))}
            <p style={{ fontSize: 10, color: "var(--tx-3)", textAlign: "center", marginTop: 2 }}>Анализирую контекст...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 8 }}>Не удалось загрузить советы</p>
            <button
              onClick={() => fetchTips(pathname, true)}
              style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Попробовать снова
            </button>
          </div>
        )}

        {!loading && !error && tips.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 8 }}>Советы ещё не загружены</p>
            <button
              onClick={() => fetchTips(pathname, true)}
              style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Получить советы
            </button>
          </div>
        )}

        {!loading && !error && tips.map((tip, i) => (
          <div key={i} style={{ borderRadius: 8, padding: "10px 12px", background: "var(--panel-2)", border: "0.5px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
              <p style={{ fontSize: 11, color: "var(--tx-2)", lineHeight: 1.55, margin: 0 }}>{tip.text}</p>
            </div>
            <button
              onClick={() => handleAddTask(tip, i)}
              disabled={addedTasks[i] || addingTask === i}
              style={{
                alignSelf: "flex-start",
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 5,
                border: `0.5px solid ${addedTasks[i] ? "var(--accent)" : "var(--line)"}`,
                background: addedTasks[i] ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                color: addedTasks[i] ? "var(--accent)" : "var(--tx-3)",
                fontSize: 10, fontWeight: 500, cursor: addedTasks[i] ? "default" : "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {addedTasks[i]
                ? <><CheckCircle size={10} /> Добавлено</>
                : addingTask === i
                  ? "⟳ Добавляю..."
                  : "+ В задачи"
              }
            </button>
          </div>
        ))}
      </div>

      {/* Footer: refresh */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
        <button
          onClick={() => fetchTips(pathname, true)}
          disabled={loading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 8, border: "0.5px solid var(--line)", background: "var(--panel-2)", color: "var(--tx-2)", fontSize: 11, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={11} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          Обновить советы
        </button>
      </div>
    </div>
  );
}
