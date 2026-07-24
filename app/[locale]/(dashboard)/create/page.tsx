"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";

// ── Types ──────────────────────────────────────────────────────────────────
type Platform = "telegram" | "instagram" | "all";
type Post = {
  id: string;
  platform: "telegram" | "instagram";
  text: string;
  image_url?: string;
  date: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  reactions?: Record<string, number>;
  url?: string;
  type?: "post" | "reel" | "story" | "video";
};

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн назад`;
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function fmtNum(n?: number): string {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

// ── Post card ──────────────────────────────────────────────────────────────
function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const isTg = post.platform === "telegram";
  const platformColor = isTg ? "#0088CC" : "#E1306C";
  const platformAbbr = isTg ? "TG" : "IG";

  return (
    <div
      onClick={onClick}
      className="ui-surface overflow-hidden cursor-pointer group"
      style={{ transition: "transform 0.12s, box-shadow 0.12s" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Image */}
      {post.image_url && (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            overflow: "hidden",
          }}
        >
          <img
            src={post.image_url}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 24,
              height: 16,
              borderRadius: 4,
              background: platformColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 8,
              fontWeight: 700,
            }}
          >
            {platformAbbr}
          </div>
        </div>
      )}

      <div style={{ padding: "10px 12px" }}>
        {/* Platform badge if no image */}
        {!post.image_url && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 20,
                height: 14,
                borderRadius: 3,
                background: platformColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 7,
                fontWeight: 700,
              }}
            >
              {platformAbbr}
            </div>
            {post.type && (
              <span
                style={{
                  fontSize: 9,
                  color: "var(--tx-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {post.type}
              </span>
            )}
          </div>
        )}

        {/* Text */}
        <p
          style={{
            fontSize: 12,
            color: "var(--tx-1)",
            lineHeight: 1.5,
            marginBottom: 8,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as any,
          }}
        >
          {post.text || "—"}
        </p>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {post.views !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--tx-3)" }}>👁</span>
              <span
                style={{ fontSize: 11, fontWeight: 500, color: "var(--tx-2)" }}
              >
                {fmtNum(post.views)}
              </span>
            </div>
          )}
          {post.likes !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--tx-3)" }}>❤️</span>
              <span
                style={{ fontSize: 11, fontWeight: 500, color: "var(--tx-2)" }}
              >
                {fmtNum(post.likes)}
              </span>
            </div>
          )}
          {post.comments !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--tx-3)" }}>💬</span>
              <span
                style={{ fontSize: 11, fontWeight: 500, color: "var(--tx-2)" }}
              >
                {fmtNum(post.comments)}
              </span>
            </div>
          )}
          {post.shares !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 11, color: "var(--tx-3)" }}>🔄</span>
              <span
                style={{ fontSize: 11, fontWeight: 500, color: "var(--tx-2)" }}
              >
                {fmtNum(post.shares)}
              </span>
            </div>
          )}
          <span
            style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx-3)" }}
          >
            {timeAgo(post.date)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Post detail modal ──────────────────────────────────────────────────────
function PostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const isTg = post.platform === "telegram";
  const platformColor = isTg ? "#0088CC" : "#E1306C";
  const platformName = isTg ? "Telegram" : "Instagram";

  const engagementRate =
    post.views && post.likes
      ? (
          ((post.likes + (post.comments ?? 0) + (post.shares ?? 0)) /
            post.views) *
          100
        ).toFixed(1)
      : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "0.5px solid var(--line)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "0.5px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 20,
                borderRadius: 5,
                background: platformColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {isTg ? "TG" : "IG"}
            </div>
            <div>
              <p
                style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}
              >
                {platformName}
              </p>
              <p style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 1 }}>
                {new Date(post.date).toLocaleDateString("ru", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "0.5px solid var(--line)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--tx-3)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Image */}
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              style={{ width: "100%", maxHeight: 340, objectFit: "cover" }}
            />
          )}

          {/* Text */}
          <div style={{ padding: "16px 20px" }}>
            <p
              style={{
                fontSize: 13,
                color: "var(--tx-1)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                marginBottom: 20,
              }}
            >
              {post.text}
            </p>

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: "Просмотры",
                  value: fmtNum(post.views),
                  icon: "👁",
                  color: "#3B82F6",
                },
                {
                  label: "Лайки",
                  value: fmtNum(post.likes),
                  icon: "❤️",
                  color: "#E1306C",
                },
                {
                  label: "Комментарии",
                  value: fmtNum(post.comments),
                  icon: "💬",
                  color: "#F59E0B",
                },
                {
                  label: "Репосты",
                  value: fmtNum(post.shares),
                  icon: "🔄",
                  color: "#10B981",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "12px",
                    background: "var(--panel-2)",
                    borderRadius: 10,
                    textAlign: "center",
                    border: "0.5px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--tx-1)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{ fontSize: 9, color: "var(--tx-3)", marginTop: 2 }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Extra stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              {post.saves !== undefined && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--panel-2)",
                    borderRadius: 9,
                    border: "0.5px solid var(--line)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--tx-3)",
                      marginBottom: 3,
                    }}
                  >
                    Сохранения
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--tx-1)",
                    }}
                  >
                    {fmtNum(post.saves)}
                  </p>
                </div>
              )}
              {post.reach !== undefined && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--panel-2)",
                    borderRadius: 9,
                    border: "0.5px solid var(--line)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--tx-3)",
                      marginBottom: 3,
                    }}
                  >
                    Охват
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--tx-1)",
                    }}
                  >
                    {fmtNum(post.reach)}
                  </p>
                </div>
              )}
              {engagementRate && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--panel-2)",
                    borderRadius: 9,
                    border: "0.5px solid var(--line)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--tx-3)",
                      marginBottom: 3,
                    }}
                  >
                    Вовлечённость
                  </p>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--pos)",
                    }}
                  >
                    {engagementRate}%
                  </p>
                </div>
              )}
            </div>

            {/* Reactions (Telegram) */}
            {post.reactions && Object.keys(post.reactions).length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: "var(--panel-2)",
                  borderRadius: 9,
                  border: "0.5px solid var(--line)",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--tx-3)",
                    marginBottom: 8,
                  }}
                >
                  Реакции
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.entries(post.reactions).map(([emoji, count]) => (
                    <div
                      key={emoji}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        background: "var(--panel)",
                        borderRadius: 20,
                        border: "0.5px solid var(--line)",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--tx-1)",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "0.5px solid var(--line)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: 8,
                border: "0.5px solid var(--line)",
                background: "transparent",
                color: "var(--tx-2)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              🔗 Открыть оригинал
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "var(--on-accent)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Analysis modal ──────────────────────────────────────────────────────
function AnalysisModal({
  posts,
  project,
  onClose,
  onPlanCreated,
}: {
  posts: Post[];
  project: any;
  onClose: () => void;
  onPlanCreated: (plan: any[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [contentPlan, setContentPlan] = useState<any[]>([]);
  const [step, setStep] = useState<"choose" | "analyzing" | "done">("choose");
  const [period, setPeriod] = useState<"week" | "2weeks" | "month">("week");

  const analyze = async () => {
    setStep("analyzing");
    setLoading(true);

    const postsData = posts.slice(0, 20).map((p) => ({
      platform: p.platform,
      text: p.text?.slice(0, 200),
      views: p.views ?? 0,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      shares: p.shares ?? 0,
      date: p.date,
    }));

    const periodDays = period === "week" ? 7 : period === "2weeks" ? 14 : 30;

    const prompt = `Ты эксперт по контент-маркетингу. Проанализируй эти посты и создай контент-план.

Проект: ${project?.name ?? "неизвестен"}
Ниша: ${project?.niche ?? "не указана"}
Описание: ${project?.description ?? "не указано"}
Аудитория: ${project?.audience ?? "не указана"}
Период планирования: ${periodDays} дней

Последние посты (статистика):
${JSON.stringify(postsData, null, 2)}

Задача:
1. Проанализируй что работает лучше всего (по просмотрам и вовлечённости)
2. Определи лучшее время публикации
3. Создай конкретный контент-план на ${periodDays} дней

Ответь ТОЛЬКО в JSON без markdown:
{
  "analysis": "краткий анализ что работает лучше всего (2-3 предложения)",
  "best_time": "лучшее время публикации",
  "best_format": "лучший формат контента",
  "plan": [
    {
      "day": 1,
      "date": "дата публикации",
      "platform": "telegram или instagram",
      "type": "пост/видео/reels/stories",
      "topic": "тема поста",
      "hook": "первое предложение-хук",
      "time": "время публикации"
    }
  ]
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text =
        data.content?.find((c: any) => c.type === "text")?.text ?? "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed.analysis ?? "");
      setContentPlan(parsed.plan ?? []);
      onPlanCreated(parsed.plan ?? []);
      setStep("done");
    } catch (e) {
      setResult("Ошибка анализа. Попробуйте ещё раз.");
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "0.5px solid var(--line)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "0.5px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--tx-1)" }}>
              ✦ AI Аналитика и планирование
            </p>
            <p style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>
              {project?.name ?? "Проект"} · {posts.length} постов
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "0.5px solid var(--line)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--tx-3)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {step === "choose" && (
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--tx-2)",
                  marginBottom: 20,
                  lineHeight: 1.6,
                }}
              >
                AI проанализирует твои посты, определит что работает лучше всего
                и создаст контент-план с темами, хуками и временем публикации.
              </p>
              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--tx-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 10,
                  }}
                >
                  Период планирования
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 10,
                  }}
                >
                  {[
                    { v: "week", l: "Неделя", d: "7 постов" },
                    { v: "2weeks", l: "2 недели", d: "14 постов" },
                    { v: "month", l: "Месяц", d: "~20 постов" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setPeriod(opt.v as any)}
                      style={{
                        padding: "14px",
                        borderRadius: 10,
                        border: `0.5px solid ${period === opt.v ? "var(--accent)" : "var(--line)"}`,
                        background:
                          period === opt.v
                            ? "var(--accent-dim)"
                            : "var(--panel)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all 0.12s",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            period === opt.v ? "var(--accent)" : "var(--tx-1)",
                        }}
                      >
                        {opt.l}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: "var(--tx-3)",
                          marginTop: 3,
                        }}
                      >
                        {opt.d}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--panel-2)",
                  borderRadius: 9,
                  border: "0.5px solid var(--line)",
                  marginBottom: 20,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--tx-2)",
                    lineHeight: 1.6,
                  }}
                >
                  ✦ AI изучит твои <strong>{posts.length} постов</strong>,
                  найдёт паттерны успешного контента и предложит конкретные темы
                  и хуки для новых публикаций
                </p>
              </div>
              <button
                onClick={analyze}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ✦ Начать анализ
              </button>
            </div>
          )}

          {step === "analyzing" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  fontSize: 48,
                  marginBottom: 16,
                  animation: "spin 2s linear infinite",
                }}
              >
                ✦
              </div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--tx-1)",
                  marginBottom: 8,
                }}
              >
                AI анализирует контент...
              </p>
              <p
                style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6 }}
              >
                Изучаю статистику постов,
                <br />
                определяю что работает лучше,
                <br />
                составляю контент-план
              </p>
              <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
            </div>
          )}

          {step === "done" && (
            <div>
              {result && (
                <div
                  style={{
                    padding: "14px",
                    background: "var(--accent-dim)",
                    borderRadius: 10,
                    border: "0.5px solid var(--accent)",
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent)",
                      marginBottom: 6,
                    }}
                  >
                    ✦ Вывод AI
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--tx-1)",
                      lineHeight: 1.6,
                    }}
                  >
                    {result}
                  </p>
                </div>
              )}

              {contentPlan.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--tx-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 12,
                    }}
                  >
                    Контент-план · {contentPlan.length} публикаций
                  </p>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {contentPlan.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "12px 14px",
                          background: "var(--panel-2)",
                          borderRadius: 10,
                          border: "0.5px solid var(--line)",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: "var(--accent)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--on-accent)",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {item.day}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--tx-1)",
                              }}
                            >
                              {item.topic}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 10,
                                background:
                                  item.platform === "telegram"
                                    ? "rgba(0,136,204,0.15)"
                                    : "rgba(225,48,108,0.15)",
                                color:
                                  item.platform === "telegram"
                                    ? "#0088CC"
                                    : "#E1306C",
                                fontWeight: 600,
                              }}
                            >
                              {item.platform === "telegram" ? "TG" : "IG"}
                            </span>
                            <span style={{ fontSize: 9, color: "var(--tx-3)" }}>
                              {item.type}
                            </span>
                          </div>
                          {item.hook && (
                            <p
                              style={{
                                fontSize: 11,
                                color: "var(--tx-2)",
                                fontStyle: "italic",
                                marginBottom: 3,
                              }}
                            >
                              «{item.hook}»
                            </p>
                          )}
                          <div style={{ display: "flex", gap: 10 }}>
                            {item.date && (
                              <span
                                style={{ fontSize: 10, color: "var(--tx-3)" }}
                              >
                                📅 {item.date}
                              </span>
                            )}
                            {item.time && (
                              <span
                                style={{ fontSize: 10, color: "var(--tx-3)" }}
                              >
                                🕐 {item.time}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {step === "done" && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "0.5px solid var(--line)",
              display: "flex",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setStep("choose")}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: "0.5px solid var(--line)",
                background: "transparent",
                color: "var(--tx-2)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↺ Перепланировать
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ✓ Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Niche field config for CreatePostModal ────────────────────────────────
function detectNicheClient(niche: string): string {
  const n = (niche ?? "").toLowerCase();
  if (/ресторан|кафе|еда|food|питание|блюд|кулинар|фастфуд|доставк/.test(n)) return "food";
  if (/одежд|мода|fashion|магазин|retail/.test(n)) return "retail";
  if (/красот|салон|барбер|ноготь|маникюр|beauty|spa/.test(n)) return "beauty";
  if (/фитнес|спорт|gym|здоровь|тренер|йога/.test(n)) return "fitness";
  if (/недвижим|квартир|дом|строительств/.test(n)) return "realestate";
  if (/образован|курс|школ|репетитор|обучен/.test(n)) return "education";
  if (/авто|автомобил|машин|dealer/.test(n)) return "auto";
  if (/отель|гостиниц|туризм|тур|путешеств/.test(n)) return "travel";
  if (/клиник|стоматолог|медицин|врач/.test(n)) return "medical";
  return "default";
}

type PostField = { key: string; label: string; placeholder: string; multiline?: boolean };
type PostTypeName = "product" | "promo" | "announcement";

const POST_FIELDS: Record<string, Record<PostTypeName, PostField[]>> = {
  food: {
    product: [
      { key: "name", label: "Название блюда", placeholder: "Плов с бараниной" },
      { key: "details", label: "Состав / особенность", placeholder: "Баранина от местных фермеров, рис девзира, жёлтая морковь...", multiline: true },
      { key: "price", label: "Цена", placeholder: "45 000 сум" },
      { key: "extra", label: "Дополнительно (необязательно)", placeholder: "Порция на 2, подаётся с лепёшкой" },
    ],
    promo: [
      { key: "offer", label: "Что предлагаем", placeholder: "Скидка 20% на все блюда с 12:00 до 15:00" },
      { key: "condition", label: "Условие / для кого (необязательно)", placeholder: "При заказе от 2 блюд" },
      { key: "until", label: "До когда", placeholder: "До 31 июля" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Открываем новый зал на 2 этаже" },
      { key: "when", label: "Когда", placeholder: "В эту субботу, 26 июля" },
      { key: "details", label: "Детали (необязательно)", placeholder: "Живая музыка, специальное меню..." },
    ],
  },
  retail: {
    product: [
      { key: "name", label: "Название товара", placeholder: "Летнее платье из льна" },
      { key: "details", label: "Материал / особенность", placeholder: "100% лён, не мнётся, дышит", multiline: true },
      { key: "sizes", label: "Размеры / варианты (необязательно)", placeholder: "XS, S, M, L, XL — в 4 цветах" },
      { key: "price", label: "Цена", placeholder: "280 000 сум" },
    ],
    promo: [
      { key: "offer", label: "Что предлагаем", placeholder: "Скидка 30% на летнюю коллекцию" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При покупке от 2 вещей" },
      { key: "until", label: "До когда", placeholder: "Только эти выходные" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новая коллекция осень-зима уже в магазине" },
      { key: "when", label: "Когда", placeholder: "С 25 июля" },
      { key: "details", label: "Что нового (необязательно)", placeholder: "60+ моделей, размеры 42-58..." },
    ],
  },
  beauty: {
    product: [
      { key: "name", label: "Услуга", placeholder: "Ламинирование ресниц" },
      { key: "details", label: "Что включает", placeholder: "Состав, укладка, ботокс", multiline: true },
      { key: "duration", label: "Длительность (необязательно)", placeholder: "1.5 часа" },
      { key: "price", label: "Цена", placeholder: "180 000 сум" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Стрижка + укладка за 120 000" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При записи онлайн" },
      { key: "until", label: "До когда", placeholder: "В июле" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новый мастер — Малика, специалист по окрашиванию" },
      { key: "when", label: "Когда", placeholder: "Принимает с 28 июля" },
      { key: "details", label: "Детали (необязательно)", placeholder: "Опыт 7 лет, сертификат L'Oreal..." },
    ],
  },
  fitness: {
    product: [
      { key: "name", label: "Услуга / программа", placeholder: "Персональные тренировки" },
      { key: "details", label: "Для кого / что даёт", placeholder: "Для тех кто хочет похудеть за 3 месяца", multiline: true },
      { key: "duration", label: "Формат (необязательно)", placeholder: "3 раза в неделю по 60 мин" },
      { key: "price", label: "Цена", placeholder: "500 000 сум / месяц" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Первая тренировка бесплатно" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При покупке абонемента на 3 месяца" },
      { key: "until", label: "До когда", placeholder: "До конца июля" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Открываем новый зал с бассейном" },
      { key: "when", label: "Когда", placeholder: "1 августа" },
      { key: "details", label: "Детали (необязательно)", placeholder: "25-метровый бассейн, 6 дорожек..." },
    ],
  },
  realestate: {
    product: [
      { key: "name", label: "Объект", placeholder: "3-комнатная квартира в ЖК Новый город" },
      { key: "details", label: "Характеристики", placeholder: "85 м², 12 этаж из 16, евроремонт", multiline: true },
      { key: "location", label: "Район / адрес (необязательно)", placeholder: "Юнусабад, 5 минут от метро" },
      { key: "price", label: "Цена", placeholder: "320 000 $ или в ипотеку от 2.8 млн/мес" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Паркинг в подарок при покупке до 31 июля" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "100% оплата или ипотека" },
      { key: "until", label: "Срок / ограничение", placeholder: "Осталось 5 квартир" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Старт продаж 2-й очереди ЖК Садовый" },
      { key: "when", label: "Когда", placeholder: "28 июля" },
      { key: "details", label: "Детали (необязательно)", placeholder: "120 квартир, сдача Q2 2026..." },
    ],
  },
  education: {
    product: [
      { key: "name", label: "Курс / программа", placeholder: "Курс английского с нуля до B2" },
      { key: "details", label: "Что даёт / для кого", placeholder: "За 6 месяцев — разговорный уровень для работы", multiline: true },
      { key: "format", label: "Формат (необязательно)", placeholder: "2 раза в неделю, онлайн или офлайн" },
      { key: "price", label: "Цена", placeholder: "350 000 сум / месяц" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Первый месяц за полцены" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При записи в июле" },
      { key: "until", label: "До когда", placeholder: "Набор до 1 августа" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новый набор на курс Python" },
      { key: "when", label: "Когда", placeholder: "Старт 5 августа" },
      { key: "details", label: "Детали (необязательно)", placeholder: "Группа до 8 человек, преподаватель из Google..." },
    ],
  },
  auto: {
    product: [
      { key: "name", label: "Авто / услуга", placeholder: "Chevrolet Tracker 2024" },
      { key: "details", label: "Характеристики", placeholder: "1.5 турбо, автомат, полный привод", multiline: true },
      { key: "color", label: "Цвета / комплектация (необязательно)", placeholder: "4 цвета, базовая и премиум" },
      { key: "price", label: "Цена", placeholder: "от 38 000 $ или рассрочка" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Trade-in: сдай старую, доплати разницу" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "Авто не старше 2018 года" },
      { key: "until", label: "До когда", placeholder: "Акция в августе" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новая модель Kia EV6 поступила в салон" },
      { key: "when", label: "Когда", placeholder: "Уже доступна для тест-драйва" },
      { key: "details", label: "Детали (необязательно)", placeholder: "Запас хода 490 км, зарядка 30 мин..." },
    ],
  },
  travel: {
    product: [
      { key: "name", label: "Тур / направление", placeholder: "Стамбул на 5 дней" },
      { key: "details", label: "Что включено", placeholder: "Перелёт, отель 4*, завтраки, экскурсии", multiline: true },
      { key: "dates", label: "Даты (необязательно)", placeholder: "15-20 августа" },
      { key: "price", label: "Цена", placeholder: "от 1 200 $ на человека" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Раннее бронирование -15%" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При оплате до 1 августа" },
      { key: "until", label: "До когда / ограничение", placeholder: "Осталось 4 места" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новое направление — Батуми от нас" },
      { key: "when", label: "Когда", placeholder: "Туры каждые 2 недели с августа" },
      { key: "details", label: "Детали (необязательно)", placeholder: "4 дня / 3 ночи, отели у моря..." },
    ],
  },
  medical: {
    product: [
      { key: "name", label: "Услуга", placeholder: "Имплантация зуба под ключ" },
      { key: "details", label: "Что включает", placeholder: "Имплант, коронка, установка — всё в одном", multiline: true },
      { key: "duration", label: "Длительность / этапы (необязательно)", placeholder: "2 визита, 3-4 месяца до финального результата" },
      { key: "price", label: "Цена", placeholder: "от 1 500 $ за имплант" },
    ],
    promo: [
      { key: "offer", label: "Акция", placeholder: "Консультация + снимок бесплатно" },
      { key: "condition", label: "Условие (необязательно)", placeholder: "При записи онлайн" },
      { key: "until", label: "До когда", placeholder: "В июле" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Новый аппарат КТ — диагностика за 15 минут" },
      { key: "when", label: "Когда", placeholder: "Уже принимаем" },
      { key: "details", label: "Детали (необязательно)", placeholder: "3D-снимок всей челюсти, точность 0.1мм..." },
    ],
  },
  default: {
    product: [
      { key: "name", label: "Товар / услуга", placeholder: "Название" },
      { key: "details", label: "Описание / особенность", placeholder: "Что это, чем отличается...", multiline: true },
      { key: "price", label: "Цена (необязательно)", placeholder: "Цена или диапазон" },
    ],
    promo: [
      { key: "offer", label: "Что предлагаем", placeholder: "Акция / оффер" },
      { key: "condition", label: "Условие / для кого (необязательно)", placeholder: "При каком условии" },
      { key: "until", label: "До когда", placeholder: "Срок акции" },
    ],
    announcement: [
      { key: "what", label: "Что происходит", placeholder: "Событие / новость" },
      { key: "when", label: "Когда", placeholder: "Дата / время" },
      { key: "details", label: "Детали (необязательно)", placeholder: "Подробности" },
    ],
  },
};

const POST_TYPE_META: { id: PostTypeName; icon: string; title: string; subtitle: string }[] = [
  { id: "product", icon: "📦", title: "Описание", subtitle: "Товар, блюдо, услуга — с конкретными деталями" },
  { id: "promo", icon: "🎯", title: "Акция / Оффер", subtitle: "Скидка, спецпредложение, ограниченный оффер" },
  { id: "announcement", icon: "📢", title: "Объявление", subtitle: "Новость, событие, открытие, анонс" },
];

const NICHE_LABELS: Record<string, string> = {
  food: "Еда / Ресторан", retail: "Магазин", beauty: "Красота",
  fitness: "Фитнес", realestate: "Недвижимость", education: "Образование",
  auto: "Авто", travel: "Туризм", medical: "Медицина", default: "Бизнес",
};

// ── Create post modal ─────────────────────────────────────────────────────
function CreatePostModal({
  projectId,
  projects,
  integrations,
  onClose,
  onPublished,
  initialType = "product",
  initialStep = "type",
}: {
  projectId: string;
  projects: any[];
  integrations: any[];
  onClose: () => void;
  onPublished: () => void;
  initialType?: PostTypeName;
  initialStep?: "type" | "form" | "preview";
}) {
  type Step = "type" | "form" | "preview";

  const [step, setStep] = useState<Step>(initialStep);
  const [postType, setPostType] = useState<PostTypeName>(initialType);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [tgSel, setTgSel] = useState(true);
  const [igSel, setIgSel] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandingField, setExpandingField] = useState<string | null>(null);
  const [editedTg, setEditedTg] = useState("");
  const [editedIg, setEditedIg] = useState("");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleTime, setScheduleTime] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const activeProject = projects.find((p: any) => p.id === projectId) as any;
  const nicheCategory = detectNicheClient(activeProject?.niche ?? "");
  const currentFields: PostField[] = POST_FIELDS[nicheCategory]?.[postType] ?? POST_FIELDS.default[postType];
  const hasTg = integrations.some((i: any) => i.platform === "telegram" && i.is_active);
  const hasIg = integrations.some((i: any) => i.platform === "instagram" && i.is_active);

  useEffect(() => {
    setTgSel(hasTg);
    setIgSel(hasIg && !hasTg);
  }, [hasTg, hasIg]);

  const apiPlatform = tgSel && igSel ? "both" : igSel ? "instagram" : "telegram";

  const handleExpandField = async (fieldKey: string, value: string) => {
    if (!value?.trim() || expandingField) return;
    setExpandingField(fieldKey);
    try {
      const field = currentFields.find((f) => f.key === fieldKey);
      const res = await fetch("/api/ai/expand-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, fieldLabel: field?.label ?? fieldKey, postType, projectId: projectId || null }),
      });
      const data = await res.json();
      if (res.ok && data.expanded) setFieldValues((p) => ({ ...p, [fieldKey]: data.expanded }));
    } catch {}
    setExpandingField(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/ai/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postType, platform: apiPlatform, projectId: projectId || null, fields: fieldValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      setEditedTg(data.telegram ?? "");
      setEditedIg(data.instagram ?? "");
      setStep("preview");
    } catch (e: any) {
      setErrMsg(e.message);
    }
    setGenerating(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setErrMsg("");
    const targets = (["telegram", "instagram"] as const).filter((p) =>
      p === "telegram" ? tgSel && hasTg : igSel && hasIg
    );
    try {
      for (const p of targets) {
        const text = p === "telegram" ? editedTg : editedIg;
        if (!text?.trim()) continue;
        const title = Object.values(fieldValues)[0]?.slice(0, 50) ?? text.slice(0, 50);
        const saveRes = await fetch("/api/contents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId || null, platform: p, body: text, caption: text,
            title, content_type: "post",
            status: publishMode === "now" ? "published" : "scheduled", language: "ru",
            source_image_url: imageUrl || null,
          }),
        });
        let content: any;
        try { content = await saveRes.json(); } catch { throw new Error("Ошибка сохранения"); }
        if (!saveRes.ok || !content?.id) throw new Error(content?.error ?? "Ошибка сохранения");
        if (publishMode === "now") {
          const pubRes = await fetch("/api/content/publish-now", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentId: content.id, platform: p }),
          });
          if (!pubRes.ok) {
            let msg = "Ошибка публикации";
            try { msg = (await pubRes.json()).error ?? msg; } catch {}
            throw new Error(msg);
          }
        } else if (publishMode === "schedule" && scheduleTime) {
          await fetch("/api/scheduled-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content_id: content.id, platform: p, scheduled_at: new Date(scheduleTime).toISOString() }),
          });
        }
      }
      onPublished();
    } catch (e: any) {
      setErrMsg(e.message);
    }
    setPublishing(false);
  };

  const inp = "w-full px-3 py-2.5 rounded-[8px] border border-line text-[12px] outline-none focus:border-line-strong bg-panel text-tx-1 placeholder:text-tx-3 transition-colors";

  const plBadge = (color: string) => ({
    display: "inline-flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    width: 22, height: 16, borderRadius: 4, background: color,
    color: "#fff", fontSize: 8, fontWeight: 700, flexShrink: 0 as const,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--panel)", border: "0.5px solid var(--line)", borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid var(--line)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step !== "type" && (
              <button onClick={() => { setStep(step === "preview" ? "form" : "type"); setErrMsg(""); }}
                style={{ width: 26, height: 26, borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--tx-2)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            )}
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-1)" }}>
              {step === "type" ? "Создать пост" : step === "form" ? (POST_TYPE_META.find((t) => t.id === postType)?.title ?? "Детали") : "Предпросмотр"}
            </p>
            {step !== "type" && (
              <span style={{ fontSize: 10, color: "var(--tx-3)", background: "var(--chip)", borderRadius: 5, padding: "2px 7px" }}>
                {NICHE_LABELS[nicheCategory] ?? "Бизнес"}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, border: "0.5px solid var(--line)", background: "transparent", cursor: "pointer", color: "var(--tx-3)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 3, padding: "8px 18px 0", flexShrink: 0 }}>
          {(["type", "form", "preview"] as Step[]).map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, transition: "background 0.2s", background: (["type", "form", "preview"] as Step[]).indexOf(step) >= i ? "var(--accent)" : "var(--line)" }} />
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Step 1: choose type */}
          {step === "type" && (
            <>
              <p style={{ fontSize: 12, color: "var(--tx-2)", marginBottom: 4 }}>Что публикуем?</p>
              {POST_TYPE_META.map((pt) => (
                <button key={pt.id}
                  onClick={() => { setPostType(pt.id); setFieldValues({}); setStep("form"); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 15px", borderRadius: 10, border: "0.5px solid var(--line)", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", transition: "border-color 0.15s, background 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{pt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>{pt.title}</p>
                    <p style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>{pt.subtitle}</p>
                  </div>
                  <span style={{ color: "var(--tx-3)", fontSize: 15 }}>›</span>
                </button>
              ))}
              <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 8, background: "var(--hover)", border: "0.5px solid var(--line)" }}>
                <p style={{ fontSize: 11, color: "var(--tx-3)" }}>
                  Для рекламных кампаний (Google Ads, Meta, Яндекс) → раздел <strong>Кампании</strong>
                </p>
              </div>
            </>
          )}

          {/* Step 2: fill fields + choose platform */}
          {step === "form" && (
            <>
              {currentFields.map((field) => {
                const isExpanding = expandingField === field.key;
                const hasValue = !!(fieldValues[field.key]?.trim());
                return (
                  <div key={field.key}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label className="ui-label">{field.label}</label>
                      {hasValue && (
                        <button
                          onClick={() => handleExpandField(field.key, fieldValues[field.key])}
                          disabled={!!expandingField}
                          style={{
                            display: "flex", alignItems: "center", gap: 3,
                            fontSize: 10, fontWeight: 600,
                            color: isExpanding ? "var(--tx-3)" : "var(--accent)",
                            background: "none", border: "none",
                            cursor: expandingField ? "default" : "pointer",
                            padding: 0, fontFamily: "inherit", opacity: expandingField && !isExpanding ? 0.4 : 1,
                          }}
                        >
                          {isExpanding ? "⟳ пишу..." : "✦ AI заполнит"}
                        </button>
                      )}
                    </div>
                    {field.multiline ? (
                      <textarea value={fieldValues[field.key] ?? ""} onChange={(e) => setFieldValues((p) => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.placeholder} className={`${inp} resize-none`}
                        style={{ height: 76, fontFamily: "inherit", lineHeight: 1.5, opacity: isExpanding ? 0.5 : 1, transition: "opacity 0.15s" }} />
                    ) : (
                      <input value={fieldValues[field.key] ?? ""} onChange={(e) => setFieldValues((p) => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.placeholder} className={inp}
                        style={{ opacity: isExpanding ? 0.5 : 1, transition: "opacity 0.15s" }} />
                    )}
                  </div>
                );
              })}

              {/* Image upload */}
              <div style={{ marginTop: 4 }}>
                <label className="block ui-label mb-2">Фото (необязательно)</label>
                {imageUrl ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img src={imageUrl} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "0.5px solid var(--line)" }} />
                    <button
                      onClick={() => setImageUrl("")}
                      style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, border: "0.5px dashed var(--line)", cursor: uploading ? "default" : "pointer", background: "var(--hover)", transition: "border-color 0.15s" }}
                    onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("folder", "posts");
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        const data = await res.json();
                        if (res.ok && data.url) setImageUrl(data.url);
                        else setErrMsg(data.error ?? "Ошибка загрузки фото");
                      } catch { setErrMsg("Ошибка загрузки фото"); }
                      setUploading(false);
                    }} />
                    <span style={{ fontSize: 20 }}>{uploading ? "⟳" : "🖼"}</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--tx-2)" }}>{uploading ? "Загружаю..." : "Добавить фото"}</p>
                      <p style={{ fontSize: 10, color: "var(--tx-3)" }}>PNG, JPG — для Instagram обязательно</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Platform selector */}
              <div style={{ marginTop: 4 }}>
                <label className="block ui-label mb-2">Куда публикуем</label>
                {!hasTg && !hasIg ? (
                  <p style={{ fontSize: 11, color: "var(--tx-3)" }}>Нет подключённых платформ. Зайди в <strong>Интеграции</strong>.</p>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    {hasTg && (
                      <button onClick={() => setTgSel((v) => v && igSel ? true : !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `0.5px solid ${tgSel ? "var(--accent)" : "var(--line)"}`, background: tgSel ? "var(--accent-dim)" : "transparent", color: tgSel ? "var(--accent)" : "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={plBadge("#0088CC")}>TG</span> Telegram
                      </button>
                    )}
                    {hasIg && (
                      <button onClick={() => setIgSel((v) => v && tgSel ? true : !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `0.5px solid ${igSel ? "#E1306C" : "var(--line)"}`, background: igSel ? "rgba(225,48,108,0.08)" : "transparent", color: igSel ? "#E1306C" : "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={plBadge("#E1306C")}>IG</span> Instagram
                      </button>
                    )}
                  </div>
                )}
              </div>

              {errMsg && <p style={{ fontSize: 11, color: "var(--neg)" }}>{errMsg}</p>}
            </>
          )}

          {/* Step 3: preview + edit */}
          {step === "preview" && (
            <>
              {tgSel && editedTg && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={plBadge("#0088CC")}>TG</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Telegram</span>
                    <span style={{ fontSize: 10, color: "var(--tx-3)", marginLeft: "auto" }}>{editedTg.length} симв.</span>
                  </div>
                  <textarea value={editedTg} onChange={(e) => setEditedTg(e.target.value)}
                    className={`${inp} resize-none`} style={{ height: 150, fontFamily: "inherit", lineHeight: 1.6 }} />
                </div>
              )}
              {igSel && editedIg && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={plBadge("#E1306C")}>IG</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tx-2)" }}>Instagram</span>
                    <span style={{ fontSize: 10, color: "var(--tx-3)", marginLeft: "auto" }}>{editedIg.length} симв.</span>
                  </div>
                  <textarea value={editedIg} onChange={(e) => setEditedIg(e.target.value)}
                    className={`${inp} resize-none`} style={{ height: 150, fontFamily: "inherit", lineHeight: 1.6 }} />
                </div>
              )}
              {tgSel && !editedTg && igSel && !editedIg && (
                <p style={{ fontSize: 12, color: "var(--tx-3)", textAlign: "center", padding: "20px 0" }}>Нет сгенерированного текста. Вернись и попробуй снова.</p>
              )}

              {/* Publish mode */}
              <div style={{ marginTop: 4 }}>
                <label className="block ui-label mb-2">Публикация</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setPublishMode("now")}
                    style={{ flex: 1, padding: "9px", borderRadius: 8, border: `0.5px solid ${publishMode === "now" ? "var(--accent)" : "var(--line)"}`, background: publishMode === "now" ? "var(--accent-dim)" : "transparent", color: publishMode === "now" ? "var(--accent)" : "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Опубликовать сейчас
                  </button>
                  <button onClick={() => setPublishMode("schedule")}
                    style={{ flex: 1, padding: "9px", borderRadius: 8, border: `0.5px solid ${publishMode === "schedule" ? "var(--accent)" : "var(--line)"}`, background: publishMode === "schedule" ? "var(--accent-dim)" : "transparent", color: publishMode === "schedule" ? "var(--accent)" : "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    Запланировать
                  </button>
                </div>
                {publishMode === "schedule" && (
                  <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={inp} style={{ marginTop: 8 }} />
                )}
              </div>

              {errMsg && <p style={{ fontSize: 11, color: "var(--neg)" }}>{errMsg}</p>}
            </>
          )}
        </div>

        {/* Footer: only for form and preview steps */}
        {step === "form" && (
          <div style={{ padding: "12px 18px", borderTop: "0.5px solid var(--line)", flexShrink: 0, display: "flex", gap: 8 }}>
            <button onClick={() => { setStep("type"); setErrMsg(""); }}
              style={{ padding: "10px 16px", borderRadius: 8, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              ← Назад
            </button>
            <button onClick={handleGenerate} disabled={generating || (!hasTg && !hasIg) || (!tgSel && !igSel)}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: generating || (!tgSel && !igSel) ? 0.6 : 1 }}>
              {generating ? "✦ AI пишет..." : "✦ Сгенерировать"}
            </button>
          </div>
        )}

        {step === "preview" && (
          <div style={{ padding: "12px 18px", borderTop: "0.5px solid var(--line)", flexShrink: 0, display: "flex", gap: 8 }}>
            <button onClick={handleGenerate} disabled={generating}
              style={{ padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--line)", background: "transparent", color: "var(--tx-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: generating ? 0.6 : 1 }}>
              {generating ? "⟳" : "⟳ Ещё раз"}
            </button>
            <button onClick={handlePublish} disabled={publishing || (publishMode === "schedule" && !scheduleTime) || (!editedTg && !editedIg)}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: publishing ? 0.6 : 1 }}>
              {publishing ? "⟳ Публикую..." : publishMode === "now" ? "Опубликовать" : "Запланировать"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
function CreateContentPageInner() {
  const locale = useLocale();

  const [platform, setPlatform] = useState<Platform>("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [createPostType, setCreatePostType] = useState<PostTypeName | null>(null);
  const [contentPlan, setContentPlan] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string>("");

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      return res.ok ? res.json() : [];
    },
  });

  // Fetch integrations
  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      return res.ok ? res.json() : [];
    },
  });

  const activeProject = projects.find((p: any) => p.id === projectId) as any;
  const tgChannels = integrations.filter((i: any) => i.platform === "telegram");
  const igChannels = integrations.filter(
    (i: any) => i.platform === "instagram",
  );

  useEffect(() => {
    if (projects.length > 0 && !projectId)
      setProjectId((projects[0] as any).id);
  }, [projects]);

  // Load posts from connected platforms
  const loadPosts = async () => {
    setLoadingPosts(true);
    setError("");
    const allPosts: Post[] = [];

    // Telegram — our new route that reads from publish_logs + real stats
    if (tgChannels.length > 0) {
      try {
        const res = await fetch(`/api/telegram/posts?limit=30`);
        if (res.ok) {
          const data = await res.json();
          const mapped: Post[] = (data.messages ?? []).map((m: any) => ({
            id: `tg_${m.id}`,
            platform: "telegram" as const,
            text: m.text ?? "",
            image_url: m.image_url ?? null,
            date: m.date,
            views: m.views ?? 0,
            shares: m.shares ?? 0,
            reactions: m.reactions ?? {},
            url: m.url ?? null,
            type: "post" as const,
          }));
          allPosts.push(...mapped);
        }
      } catch (e) {
        console.error("Telegram posts error:", e);
      }
    }

    // Instagram — our new route that reads from Instagram Graph API
    if (igChannels.length > 0) {
      try {
        const res = await fetch(`/api/instagram/posts?limit=30`);
        if (res.ok) {
          const data = await res.json();
          const mapped: Post[] = (data.data ?? []).map((m: any) => ({
            id: `ig_${m.id}`,
            platform: "instagram" as const,
            text: m.text ?? "",
            image_url: m.image_url ?? null,
            date: m.date,
            likes: m.likes ?? 0,
            comments: m.comments ?? 0,
            saves: m.saves ?? 0,
            reach: m.reach ?? 0,
            type: (m.type ?? "post") as any,
            url: m.url ?? null,
          }));
          allPosts.push(...mapped);
        }
      } catch (e) {
        console.error("Instagram posts error:", e);
      }
    }

    // Sort by date newest first
    allPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setPosts(allPosts);
    setLoadingPosts(false);
  };

  useEffect(() => {
    if (integrations.length > 0) loadPosts();
  }, [integrations]);

  const filteredPosts = posts.filter(
    (p) => platform === "all" || p.platform === platform,
  );
  const hasConnected = tgChannels.length > 0 || igChannels.length > 0;

  // Stats summary
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);
  const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

  const COLORS = ["#4ABA74", "#3B82F6", "#8B5CF6", "#F59E0B"];
  const colorFor = (id: string) => COLORS[id.charCodeAt(0) % COLORS.length];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 44,
          borderBottom: "0.5px solid var(--line)",
          background: "var(--panel)",
          flexShrink: 0,
        }}
      >
        <p style={{ fontSize: 11, color: "var(--tx-3)" }}>
          Маркетинг /{" "}
          <span style={{ color: "var(--tx-2)", fontWeight: 500 }}>
            Создать контент
          </span>
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasConnected && (
            <button
              onClick={() => { setCreatePostType(null); setShowCreatePost(true); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "0.5px solid var(--line)",
                background: "var(--panel)",
                color: "var(--tx-2)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ✏️ Создать пост
            </button>
          )}
          {hasConnected && posts.length > 0 && (
            <button
              onClick={() => setShowAnalysis(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ✦ AI Анализ и план
            </button>
          )}
          <button
            onClick={loadPosts}
            disabled={loadingPosts}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "0.5px solid var(--line)",
              background: "transparent",
              color: "var(--tx-2)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: loadingPosts ? 0.6 : 1,
            }}
          >
            {loadingPosts ? "⟳" : "↻"} Обновить
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* Project selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500 }}>
            Проект:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {projects.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setProjectId(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `0.5px solid ${projectId === p.id ? "var(--accent)" : "var(--line)"}`,
                  background:
                    projectId === p.id ? "var(--accent-dim)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: projectId === p.id ? 600 : 400,
                  color: projectId === p.id ? "var(--accent)" : "var(--tx-2)",
                }}
              >
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt=""
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: colorFor(p.id),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        {posts.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {[
              { l: "Всего постов", v: posts.length, icon: "📝" },
              { l: "Средние просмотры", v: fmtNum(avgViews), icon: "👁" },
              { l: "Суммарные лайки", v: fmtNum(totalLikes), icon: "❤️" },
              { l: "Комментарии", v: fmtNum(totalComments), icon: "💬" },
            ].map((k) => (
              <div
                key={k.l}
                className="ui-surface"
                style={{ padding: "14px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{k.icon}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--tx-3)",
                      fontWeight: 500,
                    }}
                  >
                    {k.l}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--tx-1)",
                  }}
                >
                  {k.v}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Content plan if generated */}
        {contentPlan.length > 0 && (
          <div
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              background: "var(--accent-dim)",
              borderRadius: 12,
              border: "0.5px solid var(--accent)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                ✦ Контент-план · {contentPlan.length} публикаций
              </p>
              <button
                onClick={() => setContentPlan([])}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--tx-3)",
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
              }}
            >
              {contentPlan.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    background: "var(--panel)",
                    borderRadius: 9,
                    border: "0.5px solid var(--line)",
                    minWidth: 160,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 5,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--on-accent)",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      Д{item.day}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 5px",
                        borderRadius: 8,
                        background:
                          item.platform === "telegram"
                            ? "rgba(0,136,204,0.15)"
                            : "rgba(225,48,108,0.15)",
                        color:
                          item.platform === "telegram" ? "#0088CC" : "#E1306C",
                        fontWeight: 600,
                      }}
                    >
                      {item.platform === "telegram" ? "TG" : "IG"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--tx-1)",
                      marginBottom: 3,
                    }}
                  >
                    {item.topic}
                  </p>
                  {item.time && (
                    <p style={{ fontSize: 10, color: "var(--tx-3)" }}>
                      🕐 {item.time}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform filter */}
        {hasConnected && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[
              { v: "all", l: "Все платформы", count: posts.length },
              ...(tgChannels.length > 0
                ? [
                    {
                      v: "telegram",
                      l: "Telegram",
                      count: posts.filter((p) => p.platform === "telegram")
                        .length,
                    },
                  ]
                : []),
              ...(igChannels.length > 0
                ? [
                    {
                      v: "instagram",
                      l: "Instagram",
                      count: posts.filter((p) => p.platform === "instagram")
                        .length,
                    },
                  ]
                : []),
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setPlatform(opt.v as Platform)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `0.5px solid ${platform === opt.v ? "var(--accent)" : "var(--line)"}`,
                  background:
                    platform === opt.v ? "var(--accent-dim)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11,
                  fontWeight: platform === opt.v ? 600 : 400,
                  color: platform === opt.v ? "var(--accent)" : "var(--tx-2)",
                }}
              >
                {opt.v === "telegram" && (
                  <span style={{ fontSize: 10 }}>✈️</span>
                )}
                {opt.v === "instagram" && (
                  <span style={{ fontSize: 10 }}>📸</span>
                )}
                {opt.l} · {opt.count}
              </button>
            ))}
          </div>
        )}

        {/* No platforms connected */}
        {!hasConnected && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🔌</div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--tx-1)",
                marginBottom: 8,
              }}
            >
              Нет подключённых платформ
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--tx-3)",
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Подключите Telegram или Instagram чтобы видеть посты и аналитику
            </p>
            <a
              href={`/${locale}/integrations`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 24px",
                borderRadius: 9,
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              → Перейти в Подключения
            </a>
          </div>
        )}

        {/* Loading */}
        {loadingPosts && (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <div
              style={{ fontSize: 40, animation: "spin 1.5s linear infinite" }}
            >
              ✦
            </div>
            <p style={{ fontSize: 13, color: "var(--tx-3)", marginTop: 16 }}>
              Загрузка постов...
            </p>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loadingPosts && (
          <div style={{ padding: "10px 14px", background: "rgba(193,18,31,0.07)", border: "0.5px solid var(--neg)", borderRadius: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "var(--neg)" }}>⚠ {error}</p>
          </div>
        )}

        {/* Posts grid */}
        {!loadingPosts && filteredPosts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => setSelectedPost(post)} />
            ))}
          </div>
        )}

        {/* Empty state — beautiful quick-start */}
        {!loadingPosts && filteredPosts.length === 0 && !error && (
          <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 24 }}>
            {/* Hero text */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--tx-1)", marginBottom: 8 }}>
                Создай первый пост
              </p>
              <p style={{ fontSize: 13, color: "var(--tx-3)", lineHeight: 1.6 }}>
                Выбери тип — AI напишет текст под твою нишу за 5 секунд
              </p>
            </div>

            {/* 3 quick-start cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              {POST_TYPE_META.map((pt) => (
                <button key={pt.id}
                  onClick={() => { setCreatePostType(pt.id); setShowCreatePost(true); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 12px", borderRadius: 12, border: "0.5px solid var(--line)", background: "var(--panel)", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s, transform 0.12s, box-shadow 0.12s", textAlign: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                  <span style={{ fontSize: 28 }}>{pt.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)", marginBottom: 4 }}>{pt.title}</p>
                    <p style={{ fontSize: 10, color: "var(--tx-3)", lineHeight: 1.4 }}>{pt.subtitle}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>Создать →</span>
                </button>
              ))}
            </div>

            {/* Hint: connect platforms */}
            {!hasConnected && (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--hover)", border: "0.5px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🔌</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)", marginBottom: 2 }}>Подключи платформы</p>
                  <p style={{ fontSize: 11, color: "var(--tx-3)" }}>Подключи Telegram или Instagram чтобы публиковать напрямую</p>
                </div>
                <a href={`/${locale}/integrations`}
                  style={{ padding: "7px 14px", borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" as const }}>
                  Подключить
                </a>
              </div>
            )}

            {hasConnected && (
              <p style={{ textAlign: "center", fontSize: 11, color: "var(--tx-3)" }}>
                После публикации посты появятся здесь с аналитикой
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
      {showCreatePost && (
        <CreatePostModal
          projectId={projectId}
          projects={projects}
          integrations={integrations}
          onClose={() => setShowCreatePost(false)}
          onPublished={() => { setShowCreatePost(false); loadPosts(); }}
          initialType={createPostType ?? "product"}
          initialStep={createPostType ? "form" : "type"}
        />
      )}
      {showAnalysis && (
        <AnalysisModal
          posts={posts}
          project={activeProject}
          onClose={() => setShowAnalysis(false)}
          onPlanCreated={(plan) => {
            setContentPlan(plan);
            setShowAnalysis(false);
          }}
        />
      )}
    </div>
  );
}

export default function CreateContentPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--tx-3)",
            fontSize: 12,
          }}
        >
          ...
        </div>
      }
    >
      <CreateContentPageInner />
    </Suspense>
  );
}
