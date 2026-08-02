"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Send,
  Image as ImageIcon,
  Music2,
  FileText,
  Film,
  Megaphone,
  Search,
  Globe,
  Copy,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  ChevronUp,
  ChevronDown,
  Plus,
  type LucideIcon,
} from "lucide-react";

const PLATFORM_ICON: Record<string, LucideIcon> = {
  telegram: Send,
  instagram: ImageIcon,
  tiktok: Music2,
  vk: Globe,
  youtube: Film,
  other: FileText,
};

const STATUS_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  draft: { label: "Черновик", dot: "bg-tx-3", badge: "bg-chip text-tx-2" },
  generated: { label: "Готово", dot: "bg-c-3", badge: "bg-chip text-c-3" },
  approved: {
    label: "Одобрено",
    dot: "bg-accent",
    badge: "bg-accent-dim text-accent",
  },
  scheduled: {
    label: "Запланировано",
    dot: "bg-tx-2",
    badge: "bg-chip text-tx-1",
  },
  published: {
    label: "Опубликовано",
    dot: "bg-pos",
    badge: "bg-chip text-pos",
  },
  failed: { label: "Ошибка", dot: "bg-neg", badge: "bg-chip text-neg" },
};

function HistoryPageInner() {
  const queryClient = useQueryClient();
  const t = useTranslations("history");
  const locale = useLocale();
  const searchParams = useSearchParams();

  // State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"created_at" | "title">(
    "created_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const [scheduleDate, setScheduleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");

  // Queries
  const { data: contents = [], isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await fetch("/api/contents");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && contents.length) {
      const item = contents.find((c: any) => c.id === id);
      if (item) setSelected(item);
    }
  }, [searchParams, contents]);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setSelected(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const res = await fetch(`/api/contents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setEditMode(false);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (item: any) => {
      const res = await fetch("/api/contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: item.project_id,
          type: item.type,
          platform: item.platform,
          goal: item.goal,
          title: `${item.title} (копия)`,
          idea: item.idea,
          hook: item.hook,
          script: item.script || [],
          voiceover: item.voiceover || "",
          screen_text: item.screen_text || "",
          caption: item.caption,
          hashtags: item.hashtags || [],
          cta: item.cta,
          source_image_url: item.source_image_url || null,
          status: "draft",
        }),
      });
      if (!res.ok) throw new Error("Duplicate failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const handlePublishNow = async () => {
    if (!selected) return;
    setPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    try {
      const res = await fetch("/api/content/publish-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: selected.id,
          platform: selectedPlatform || selected.platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка публикации");
      setPublishSuccess("Опубликовано!");
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setSelected((p: any) => (p ? { ...p, status: "published" } : p));
    } catch (e: any) {
      setPublishError(e.message);
    }
    setPublishing(false);
  };

  const handleSchedule = async () => {
    if (!selected || !scheduleDate) return;
    setPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    try {
      const scheduledAt = new Date(
        scheduleDate + "T" + scheduleTime,
      ).toISOString();
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: selected.id,
          platform: selectedPlatform || selected.platform,
          scheduled_at: scheduledAt,
        }),
      });
      if (!res.ok) throw new Error("Ошибка планирования");
      setPublishSuccess("Запланировано!");
      queryClient.invalidateQueries({ queryKey: ["history"] });
      setSelected((p: any) => (p ? { ...p, status: "scheduled" } : p));
      setShowSchedule(false);
    } catch (e: any) {
      setPublishError(e.message);
    }
    setPublishing(false);
  };

  const exportCSV = () => {
    if (!contents.length) return;
    const headers = [
      "Дата",
      "Название",
      "Платформа",
      "Тип",
      "Статус",
      "Текст",
      "Хэштеги",
      "Проект",
    ];
    const rows = (contents as any[]).map((c) => [
      new Date(c.created_at).toLocaleDateString("ru-RU"),
      c.title || "",
      c.platform || "",
      c.type || "",
      c.status || "",
      `"${(c.caption || "").replace(/"/g, '""')}"`,
      (c.hashtags || []).join(" "),
      (c.projects as any)?.name || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter + sort
  const filtered = (contents as any[])
    .filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (platformFilter !== "all" && c.platform !== platformFilter)
        return false;
      if (
        search &&
        !`${c.title} ${c.caption}`.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const av =
        sortField === "created_at"
          ? new Date(a.created_at).getTime()
          : a.title || "";
      const bv =
        sortField === "created_at"
          ? new Date(b.created_at).getTime()
          : b.title || "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const toggleSort = (field: "created_at" | "title") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Stats
  const stats = {
    total: contents.length,
    generated: (contents as any[]).filter((c) => c.status === "generated")
      .length,
    scheduled: (contents as any[]).filter((c) => c.status === "scheduled")
      .length,
    published: (contents as any[]).filter((c) => c.status === "published")
      .length,
  };

  const platforms = [
    ...new Set((contents as any[]).map((c) => c.platform).filter(Boolean)),
  ];

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <ChevronUp size={10} className="opacity-20" />;
    return sortDir === "asc" ? (
      <ChevronUp size={10} className="text-accent" />
    ) : (
      <ChevronDown size={10} className="text-accent" />
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <div className="h-11 border-b border-line px-5 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 bg-panel">
        <p className="text-[11px] text-tx-3">
          Контент / <span className="text-tx-2 font-medium">История</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-[7px] text-[11px] text-tx-2 hover:text-tx-1 transition-colors"
          >
            <Download size={12} strokeWidth={1.6} /> Экспорт CSV
          </button>
          <Link
            href={`/${locale}/create`}
            className="inline-flex items-center gap-1.5 bg-accent text-on-accent rounded-[7px] px-3 py-1.5 text-[11px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={12} strokeWidth={2.4} /> Создать
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MAIN TABLE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header + Stats */}
          <div className="px-5 pt-5 pb-0">
            <h1 className="text-[20px] font-semibold text-tx-1">
              История контента
            </h1>
            <p className="text-[12px] text-tx-2 mt-0.5 mb-4">
              Все сгенерированные материалы
            </p>

            {/* Stats */}
            <div className="flex gap-2 mb-4">
              {[
                { val: stats.total, label: "Всего", dot: "bg-tx-2" },
                { val: stats.generated, label: "Готово", dot: "bg-c-3" },
                {
                  val: stats.scheduled,
                  label: "Запланировано",
                  dot: "bg-tx-2",
                },
                { val: stats.published, label: "Опубликовано", dot: "bg-pos" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="ui-surface px-3 py-2 flex items-center gap-2"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`}
                  />
                  <span className="text-[16px] font-semibold text-tx-1 ui-num">
                    {s.val}
                  </span>
                  <span className="text-[10px] text-tx-3">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-3"
                  strokeWidth={1.6}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию..."
                  className="h-8 pl-8 pr-3 border border-line rounded-[7px] bg-panel text-[12px] text-tx-1 outline-none focus:border-line-strong w-56 placeholder:text-tx-3"
                />
              </div>

              <div className="w-px h-5 bg-line" />

              {/* Status filter */}
              {["all", "generated", "scheduled", "published", "draft"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`h-8 px-3 rounded-[7px] text-[11px] font-medium border transition-colors cursor-pointer ${
                      statusFilter === s
                        ? "bg-accent text-on-accent border-accent"
                        : "border-line bg-panel text-tx-2 hover:bg-hover"
                    }`}
                  >
                    {s === "all" ? "Все" : STATUS_META[s]?.label || s}
                  </button>
                ),
              )}

              <div className="w-px h-5 bg-line" />

              {/* Platform filter */}
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setPlatformFilter(platformFilter === p ? "all" : p)
                  }
                  className={`h-8 px-3 rounded-[7px] text-[11px] font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    platformFilter === p
                      ? "bg-accent text-on-accent border-accent"
                      : "border-line bg-panel text-tx-2 hover:bg-hover"
                  }`}
                >
                  {p === "telegram" && <Send size={11} strokeWidth={1.6} />}
                  {p === "instagram" && (
                    <ImageIcon size={11} strokeWidth={1.6} />
                  )}
                  <span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {isLoading ? (
              <div className="space-y-2 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-panel border border-line rounded-[8px] animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="ui-surface mt-2 py-16 flex flex-col items-center text-center">
                <FileText
                  size={28}
                  className="text-tx-3 mb-3"
                  strokeWidth={1.2}
                />
                <p className="text-[13px] font-medium text-tx-1 mb-1">
                  Ничего не найдено
                </p>
                <p className="text-[12px] text-tx-3 mb-4">
                  Попробуй изменить фильтры или создай новый пост
                </p>
                <Link
                  href={`/${locale}/create`}
                  className="inline-flex items-center gap-1.5 bg-accent text-on-accent rounded-[7px] px-4 py-2 text-[12px] font-medium"
                >
                  <Plus size={13} /> Создать контент
                </Link>
              </div>
            ) : (
              <div className="ui-surface overflow-hidden mt-2">
                <table className="w-full border-collapse">
                  <thead>
                    <tr
                      className="border-b border-line"
                      style={{ background: "var(--panel-2)" }}
                    >
                      <th className="px-4 py-2.5 text-left">
                        <button
                          onClick={() => toggleSort("title")}
                          className="flex items-center gap-1 text-[9.5px] font-600 tracking-wider uppercase text-tx-3 hover:text-tx-1 cursor-pointer"
                        >
                          Пост <SortIcon field="title" />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold tracking-wider uppercase text-tx-3">
                        Статус
                      </th>
                      <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold tracking-wider uppercase text-tx-3">
                        Платформа
                      </th>
                      <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold tracking-wider uppercase text-tx-3">
                        Проект
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <button
                          onClick={() => toggleSort("created_at")}
                          className="flex items-center gap-1 text-[9.5px] font-semibold tracking-wider uppercase text-tx-3 hover:text-tx-1 cursor-pointer"
                        >
                          Дата <SortIcon field="created_at" />
                        </button>
                      </th>
                      <th className="px-4 py-2.5 text-left text-[9.5px] font-semibold tracking-wider uppercase text-tx-3">
                        AI балл
                      </th>
                      <th className="px-4 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c: any) => {
                      const st = STATUS_META[c.status] || STATUS_META.draft;
                      const isSelected = selected?.id === c.id;
                      const PlatformIcon =
                        PLATFORM_ICON[c.platform] || FileText;
                      const score: number | null = c.ai_score ?? null;

                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelected(isSelected ? null : c)}
                          className={`border-b border-line cursor-pointer transition-colors group ${
                            isSelected ? "bg-accent-dim" : "hover:bg-hover"
                          }`}
                        >
                          {/* Title */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 ${
                                  c.status === "published"
                                    ? "bg-chip"
                                    : "bg-chip"
                                }`}
                              >
                                {c.status === "published" ? (
                                  <CheckCircle2
                                    size={14}
                                    className="text-pos"
                                    strokeWidth={1.6}
                                  />
                                ) : c.status === "scheduled" ? (
                                  <Clock
                                    size={14}
                                    className="text-tx-3"
                                    strokeWidth={1.6}
                                  />
                                ) : (
                                  <FileText
                                    size={14}
                                    className="text-tx-3"
                                    strokeWidth={1.6}
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-medium text-tx-1 truncate max-w-[240px]">
                                  {c.title || "Без названия"}
                                </p>
                                <p className="text-[10px] text-tx-3 mt-0.5 capitalize">
                                  {c.type}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.badge}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                              />
                              {st.label}
                            </span>
                          </td>
                          {/* Platform */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px] text-tx-2 capitalize">
                              <PlatformIcon
                                size={13}
                                strokeWidth={1.6}
                                className="text-tx-3"
                              />
                              {c.platform}
                            </div>
                          </td>
                          {/* Project */}
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-tx-3">
                              {(c.projects as any)?.name || "—"}
                            </span>
                          </td>
                          {/* Date */}
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-tx-3 whitespace-nowrap">
                              {format(new Date(c.created_at), "d MMM", {
                                locale: locale === "ru" ? ru : undefined,
                              })}
                            </span>
                          </td>
                          {/* Score */}
                          <td className="px-4 py-3">
                            {score !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-1.5 bg-track rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-accent transition-all"
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-tx-3 ui-num">{score}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-tx-3">—</span>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {c.status !== "published" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(c);
                                    setShowSchedule(false);
                                  }}
                                  className="h-6 px-2 rounded-[5px] bg-accent text-on-accent text-[9.5px] font-medium cursor-pointer hover:opacity-90 whitespace-nowrap"
                                >
                                  Опубл.
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateMutation.mutate(c);
                                }}
                                className="w-6 h-6 rounded-[5px] border border-line bg-panel flex items-center justify-center cursor-pointer hover:bg-hover"
                              >
                                <Copy
                                  size={11}
                                  className="text-tx-3"
                                  strokeWidth={1.6}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Удалить?"))
                                    deleteMutation.mutate(c.id);
                                }}
                                className="w-6 h-6 rounded-[5px] border border-line bg-panel flex items-center justify-center cursor-pointer hover:bg-hover"
                              >
                                <Trash2
                                  size={11}
                                  className="text-tx-3"
                                  strokeWidth={1.6}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div className="w-[320px] flex-shrink-0 border-l border-line bg-panel flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-line flex items-center justify-between flex-shrink-0">
              <p className="text-[12px] font-semibold text-tx-1 truncate flex-1 mr-2">
                {selected.title || "Без названия"}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="w-6 h-6 flex items-center justify-center rounded-[5px] hover:bg-hover cursor-pointer flex-shrink-0"
              >
                <X size={14} className="text-tx-3" strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Meta */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_META[selected.status]?.badge || "bg-chip text-tx-2"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_META[selected.status]?.dot}`}
                  />
                  {STATUS_META[selected.status]?.label}
                </span>
                <span className="text-[10px] bg-chip text-tx-2 px-2 py-0.5 rounded-full capitalize">
                  {selected.platform}
                </span>
                <span className="text-[10px] bg-chip text-tx-2 px-2 py-0.5 rounded-full capitalize">
                  {selected.type}
                </span>
              </div>

              {/* Hook */}
              {selected.hook && (
                <div>
                  <p className="ui-label mb-1.5">Зацепка</p>
                  <p className="text-[12px] text-tx-1 leading-relaxed">
                    {selected.hook}
                  </p>
                </div>
              )}

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="ui-label">Текст поста</p>
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      setEditCaption(selected.caption);
                    }}
                    className="text-[10px] text-tx-3 hover:text-tx-1 cursor-pointer"
                  >
                    {editMode ? "Отмена" : "Редактировать"}
                  </button>
                </div>
                {editMode ? (
                  <div>
                    <textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      rows={6}
                      className="w-full text-[12px] text-tx-1 bg-panel-2 border border-line rounded-[7px] p-2.5 outline-none resize-none focus:border-line-strong"
                    />
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: selected.id,
                          caption: editCaption,
                        })
                      }
                      className="mt-2 w-full py-1.5 bg-accent text-on-accent text-[11px] font-medium rounded-[6px] cursor-pointer hover:opacity-90"
                    >
                      Сохранить
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] text-tx-1 leading-relaxed whitespace-pre-wrap">
                    {selected.caption}
                  </p>
                )}
              </div>

              {/* Hashtags */}
              {selected.hashtags?.length > 0 && (
                <div>
                  <p className="ui-label mb-1.5">Хэштеги</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.hashtags.map((h: string, i: number) => (
                      <span
                        key={i}
                        className="text-[10px] bg-accent-dim text-accent px-2 py-0.5 rounded-full"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {selected.cta && (
                <div>
                  <p className="ui-label mb-1.5">Призыв к действию</p>
                  <p className="text-[12px] text-tx-1">{selected.cta}</p>
                </div>
              )}

              {/* Errors */}
              {publishError && (
                <div className="bg-chip border border-line rounded-[7px] px-3 py-2 text-[11px] text-neg">
                  {publishError}
                </div>
              )}
              {publishSuccess && (
                <div className="bg-accent-dim border border-line rounded-[7px] px-3 py-2 text-[11px] text-accent font-medium">
                  {publishSuccess}
                </div>
              )}
            </div>

            {/* Panel actions */}
            <div className="px-4 py-3 border-t border-line space-y-2 flex-shrink-0">
              {/* Platform select */}
              {(integrations as any[]).length > 0 && (
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full h-8 px-2.5 border border-line rounded-[7px] text-[11px] text-tx-1 bg-panel-2 outline-none focus:border-line-strong cursor-pointer"
                >
                  <option value="">— Канал по умолчанию</option>
                  {(integrations as any[])
                    .filter((i) => i.is_active)
                    .map((i: any) => (
                      <option key={i.id} value={i.channel_id}>
                        {i.channel_name} ({i.platform})
                      </option>
                    ))}
                </select>
              )}

              {selected.status !== "published" && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublishNow}
                      disabled={publishing}
                      className="flex-1 py-2 bg-accent text-on-accent text-[12px] font-medium rounded-[7px] cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Send size={12} strokeWidth={1.6} />
                      {publishing ? "..." : "Опубликовать"}
                    </button>
                    <button
                      onClick={() => setShowSchedule((v) => !v)}
                      className="flex-1 py-2 border border-line text-tx-2 text-[12px] rounded-[7px] cursor-pointer hover:bg-hover flex items-center justify-center gap-1.5"
                    >
                      <Calendar size={12} strokeWidth={1.6} />
                      Запланировать
                    </button>
                  </div>

                  {showSchedule && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="h-8 px-2.5 border border-line rounded-[7px] text-[11px] text-tx-1 bg-panel-2 outline-none focus:border-line-strong"
                        />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="h-8 px-2.5 border border-line rounded-[7px] text-[11px] text-tx-1 bg-panel-2 outline-none focus:border-line-strong"
                        />
                      </div>
                      <button
                        onClick={handleSchedule}
                        disabled={publishing}
                        className="w-full py-2 bg-accent text-on-accent text-[12px] font-medium rounded-[7px] cursor-pointer hover:opacity-90 disabled:opacity-50"
                      >
                        {publishing ? "..." : "Подтвердить"}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${selected.caption}\n\n${selected.hashtags?.join(" ")}`,
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 py-1.5 border border-line text-tx-2 text-[11px] rounded-[6px] cursor-pointer hover:bg-hover flex items-center justify-center gap-1.5"
                >
                  <Copy size={11} strokeWidth={1.6} />
                  {copied ? "Скопировано!" : "Копировать"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Удалить?")) deleteMutation.mutate(selected.id);
                  }}
                  className="flex-1 py-1.5 border border-line text-neg text-[11px] rounded-[6px] cursor-pointer hover:bg-hover flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={11} strokeWidth={1.6} />
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 animate-pulse space-y-3">
          <div className="h-7 bg-chip rounded-lg w-48" />
          <div className="h-4 bg-chip rounded w-64" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-chip rounded-[8px]" />
          ))}
        </div>
      }
    >
      <HistoryPageInner />
    </Suspense>
  );
}
