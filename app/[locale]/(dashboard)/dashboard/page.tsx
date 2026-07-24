import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plus, Calendar, Sparkles, Send, Clock, FileText, Bot,
  Lightbulb, TrendingUp, TrendingDown, Minus, CheckCircle2, Circle,
  FolderOpen, Plug, Rocket,
} from "lucide-react";
import HealthWidget from "@/components/features/HealthWidget";

type RecentContent = {
  id: string; title: string | null; platform: string; status: string;
  created_at: string; project_name?: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-chip text-tx-3" },
  generated: { label: "Готово", cls: "bg-pos-dim text-pos" },
  approved: { label: "Одобрено", cls: "bg-pos-dim text-pos" },
  scheduled: { label: "Запланировано", cls: "bg-chip text-c-3" },
  published: { label: "Опубликовано", cls: "bg-pos-dim text-pos" },
  failed: { label: "Ошибка", cls: "bg-chip text-neg" },
};

const PLATFORM_COLOR: Record<string, string> = {
  telegram: "var(--accent)", instagram: "var(--c-2)", tiktok: "var(--c-3)", vk: "var(--c-2)",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();

  if (!user) redirect(`/${locale}/auth/login`);

  const firstName = user.full_name?.split(" ")[0] || "друг";

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 864e5).toISOString();
  const userId = user.id;

  let genTotal = null, scheduled = null, published = null;
  let genThisWeek = null, genLastWeek = null, pubThisWeek = null, pubLastWeek = null;
  let platforms: { platform: string }[] = [];
  let upcomingPosts: any[] = [];
  let recentContents: RecentContent[] = [];
  let projectsCount = 0;
  let integrationsCount = 0;

  try {
    let projectsRow = null, integrationsRow = null;
    [
      genTotal, scheduled, published,
      genThisWeek, genLastWeek, pubThisWeek, pubLastWeek,
      platforms, upcomingPosts, recentContents,
      projectsRow, integrationsRow,
    ] = await Promise.all([
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1", [userId]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'scheduled'", [userId]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published'", [userId]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND created_at >= $2", [userId, oneWeekAgo]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND created_at >= $2 AND created_at < $3", [userId, twoWeeksAgo, oneWeekAgo]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published' AND created_at >= $2", [userId, oneWeekAgo]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published' AND created_at >= $2 AND created_at < $3", [userId, twoWeeksAgo, oneWeekAgo]),
      query<{ platform: string }>("SELECT platform FROM contents WHERE user_id = $1", [userId]),
      query(
        `SELECT sp.id, sp.scheduled_at, c.title, c.platform, c.type
         FROM scheduled_posts sp JOIN contents c ON sp.content_id = c.id
         WHERE c.user_id = $1 AND sp.status = 'pending' AND sp.scheduled_at >= NOW()
         ORDER BY sp.scheduled_at ASC LIMIT 4`,
        [userId]
      ),
      query<RecentContent>(
        `SELECT c.id, c.title, c.platform, c.status, c.created_at, p.name as project_name
         FROM contents c LEFT JOIN projects p ON c.project_id = p.id
         WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 4`,
        [userId]
      ),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM projects WHERE user_id = $1", [userId]),
      queryOne<{ count: string }>("SELECT COUNT(*) as count FROM integrations WHERE user_id = $1 AND is_active = true", [userId]),
    ]);
    projectsCount = parseInt(projectsRow?.count ?? "0");
    integrationsCount = parseInt(integrationsRow?.count ?? "0");
  } catch (e) {
    console.error("Dashboard query error:", e);
    // Render page with empty data rather than crashing
  }

  const generationsCount = parseInt(genTotal?.count ?? "0");
  const scheduledCount = parseInt(scheduled?.count ?? "0");
  const publishedCount = parseInt(published?.count ?? "0");
  const genDelta = parseInt(genThisWeek?.count ?? "0") - parseInt(genLastWeek?.count ?? "0");
  const pubDelta = parseInt(pubThisWeek?.count ?? "0") - parseInt(pubLastWeek?.count ?? "0");

  const platformCounts: Record<string, number> = {};
  platforms.forEach((c) => { if (c.platform) platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1; });

  const successRate = publishedCount > 0 ? Math.round((publishedCount / (generationsCount || 1)) * 100) + "%" : "0%";
  const todayLabel = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  const formatScheduledAt = (dateStr: string) => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `Сегодня, ${time}`;
    const tom = new Date(now); tom.setDate(now.getDate() + 1);
    if (d.toDateString() === tom.toDateString()) return `Завтра, ${time}`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + `, ${time}`;
  };

  const DeltaBadge = ({ delta }: { delta: number }) => {
    if (delta === 0) return <span className="text-[10px] text-tx-3 flex items-center gap-0.5 mt-1"><Minus size={9} /> без изм.</span>;
    if (delta > 0) return <span className="text-[10px] text-pos flex items-center gap-0.5 mt-1"><TrendingUp size={9} /> +{delta} за неделю</span>;
    return <span className="text-[10px] text-neg flex items-center gap-0.5 mt-1"><TrendingDown size={9} /> {delta} за неделю</span>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-11 border-b border-line px-5 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 bg-panel">
        <p className="text-[11px] text-tx-3">Главная / <span className="text-tx-2 font-medium">Обзор</span></p>
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/calendar`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-[7px] text-[11px] text-tx-2 hover:text-tx-1 hover:border-line-strong transition-colors">
            <Calendar size={12} strokeWidth={1.6} /> Запланировать
          </Link>
          <Link href={`/${locale}/create`} className="inline-flex items-center gap-1.5 bg-[#343230] text-on-accent rounded-[7px] px-3 py-1.5 text-[11px] font-medium hover:opacity-90 transition-opacity">
            <Plus size={12} strokeWidth={2.4} /> Создать контент
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-tx-1">Привет, {firstName}</h1>
            <p className="text-[12px] text-tx-2 mt-0.5 capitalize">{todayLabel}</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link href={`/${locale}/ai-workers`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-[7px] text-[11px] text-tx-2 hover:text-tx-1 transition-colors bg-panel">
              <Bot size={13} strokeWidth={1.6} /> AI-план на неделю
            </Link>
            <Link href={`/${locale}/create`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line rounded-[7px] text-[11px] text-tx-2 hover:text-tx-1 transition-colors bg-panel">
              <Sparkles size={13} strokeWidth={1.6} /> Быстрый пост
            </Link>
          </div>
        </div>

        {/* Onboarding checklist — показывается пока не выполнены базовые шаги */}
        {(projectsCount === 0 || integrationsCount === 0 || publishedCount === 0) && (
          <div className="bg-panel border border-line rounded-[12px] overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2.5">
              <Rocket size={14} className="text-accent" strokeWidth={1.6} />
              <p className="text-[13px] font-semibold text-tx-1">Начало работы</p>
              <span className="ml-auto text-[10px] text-tx-3 font-medium">
                {[projectsCount > 0, integrationsCount > 0, publishedCount > 0].filter(Boolean).length} / 3 шага
              </span>
            </div>
            <div className="divide-y divide-line">
              {[
                {
                  done: projectsCount > 0,
                  icon: FolderOpen,
                  label: "Создать проект",
                  sub: "Название, ниша, аудитория вашего бизнеса",
                  href: `/${locale}/projects`,
                  cta: "Создать проект",
                },
                {
                  done: integrationsCount > 0,
                  icon: Plug,
                  label: "Подключить Telegram-канал",
                  sub: "Добавьте бота в ваш канал чтобы публиковать посты",
                  href: `/${locale}/integrations`,
                  cta: "Подключить",
                },
                {
                  done: publishedCount > 0,
                  icon: Send,
                  label: "Опубликовать первый пост",
                  sub: "Создайте пост с помощью AI и отправьте в канал",
                  href: `/${locale}/create`,
                  cta: "Создать пост",
                },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ opacity: step.done ? 0.55 : 1 }}>
                  <div className="flex-shrink-0">
                    {step.done
                      ? <CheckCircle2 size={18} className="text-pos" strokeWidth={1.8} />
                      : <Circle size={18} className="text-tx-3" strokeWidth={1.5} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-tx-1" style={{ textDecoration: step.done ? "line-through" : "none" }}>{step.label}</p>
                    <p className="text-[11px] text-tx-3 mt-0.5">{step.sub}</p>
                  </div>
                  {!step.done && (
                    <Link
                      href={step.href}
                      className="flex-shrink-0 px-3 py-1.5 bg-accent text-on-accent text-[11px] font-medium rounded-[7px] hover:opacity-90 transition-opacity"
                    >
                      {step.cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <HealthWidget
          publishedCount={publishedCount}
          generationsCount={generationsCount}
          scheduledCount={scheduledCount}
          pubDelta={pubDelta}
          genDelta={genDelta}
          platformCounts={platformCounts}
          pubThisWeek={parseInt(pubThisWeek?.count ?? "0")}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="ui-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-tx-1">Последние действия</p>
              <Link href={`/${locale}/history`} className="text-[11px] font-medium hover:opacity-80" style={{ color: "var(--c-2)" }}>История →</Link>
            </div>
            {!recentContents || recentContents.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-tx-3">Пока нет действий</div>
            ) : (
              <div className="divide-y divide-line">
                {recentContents.map((c) => {
                  const st = STATUS_META[c.status] || STATUS_META.draft;
                  const Icon = c.status === "published" ? Send : c.status === "scheduled" ? Clock : FileText;
                  const iconStyle = c.status === "published"
                    ? { background: "var(--accent-dim)", color: "var(--accent)" }
                    : c.status === "scheduled"
                    ? { background: "rgba(154,103,0,0.1)", color: "var(--c-3)" }
                    : c.status === "generated"
                    ? { background: "rgba(130,80,223,0.1)", color: "#8250df" }
                    : { background: "var(--chip)", color: "var(--tx-3)" };
                  return (
                    <Link key={c.id} href={`/${locale}/history`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors">
                      <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0" style={iconStyle}>
                        <Icon size={13} strokeWidth={1.6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-tx-1 truncate">{c.title || "Без названия"}</p>
                        <p className="text-[10px] text-tx-3 mt-0.5 capitalize">{c.platform} · {c.project_name || "—"}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-medium flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="ui-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-tx-1">Ближайшие публикации</p>
              <Link href={`/${locale}/calendar`} className="text-[11px] font-medium hover:opacity-80" style={{ color: "var(--c-2)" }}>Календарь →</Link>
            </div>
            {!upcomingPosts || upcomingPosts.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-center px-4">
                <p className="text-[12px] text-tx-3 mb-2">Нет запланированных постов</p>
                <Link href={`/${locale}/create`} className="text-[12px] font-medium text-accent hover:opacity-80">Запланировать →</Link>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {(upcomingPosts as any[]).map((p: any) => (
                  <Link key={p.id} href={`/${locale}/calendar`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors">
                    <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 bg-panel-2">
                      <FileText size={13} className="text-tx-3" strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-tx-1 truncate">{p.title || "—"}</p>
                      <p className="text-[10px] text-tx-3 mt-0.5">{formatScheduledAt(p.scheduled_at)}</p>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PLATFORM_COLOR[p.platform] || "var(--tx-3)" }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
