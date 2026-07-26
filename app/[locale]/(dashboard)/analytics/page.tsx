import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";
import AnalyticsCharts from "@/components/features/AnalyticsCharts";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/ru/auth/login");

  const t = await getTranslations("analytics");
  const locale = await getLocale();
  const { project: projectFilter } = await searchParams;

  const now = new Date();
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 6);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 13);
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 29);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validPid = projectFilter && UUID_REGEX.test(projectFilter) ? projectFilter : null;
  const pidParam = validPid ? `AND project_id = '${validPid}'` : "";

  let projects: any[] = [];
  let totalGenerationsRows: any[] = [], totalScheduledRows: any[] = [], totalPublishedRows: any[] = [], totalFailedRows: any[] = [];
  let genThisWeekRows: any[] = [], genLastWeekRows: any[] = [], pubThisWeekRows: any[] = [], pubLastWeekRows: any[] = [];
  let activityData: any[] = [], platformData: any[] = [], typeData: any[] = [], statusData: any[] = [], recentData: any[] = [], allDates: any[] = [];

  try {
    [
      projects,
      totalGenerationsRows,
      totalScheduledRows,
      totalPublishedRows,
      totalFailedRows,
      genThisWeekRows,
      genLastWeekRows,
      pubThisWeekRows,
      pubLastWeekRows,
      activityData,
      platformData,
      typeData,
      statusData,
      recentData,
      allDates,
    ] = await Promise.all([
      query(`SELECT id, name FROM projects WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`, [user.id]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 ${pidParam}`, [user.id]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'scheduled' ${pidParam}`, [user.id]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published' ${pidParam}`, [user.id]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'failed' ${pidParam}`, [user.id]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND created_at >= $2 ${pidParam}`, [user.id, sevenDaysAgo.toISOString()]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 ${pidParam}`, [user.id, fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published' AND created_at >= $2 ${pidParam}`, [user.id, sevenDaysAgo.toISOString()]),
      query(`SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND status = 'published' AND created_at >= $2 AND created_at < $3 ${pidParam}`, [user.id, fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()]),
      query(`SELECT created_at FROM contents WHERE user_id = $1 AND created_at >= $2 ${pidParam}`, [user.id, sevenDaysAgo.toISOString()]),
      query(`SELECT platform FROM contents WHERE user_id = $1 ${pidParam}`, [user.id]),
      query(`SELECT type FROM contents WHERE user_id = $1 ${pidParam}`, [user.id]),
      query(`SELECT status FROM contents WHERE user_id = $1 ${pidParam}`, [user.id]),
      query(`SELECT created_at FROM contents WHERE user_id = $1 AND created_at >= $2 ${pidParam}`, [user.id, thirtyDaysAgo.toISOString()]),
      query(`SELECT created_at FROM contents WHERE user_id = $1 ${pidParam}`, [user.id]),
    ]);
  } catch (e) {
    console.error("Analytics query error:", e);
  }

  const dateLocale = locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU";

  const totalGenerations = Number((totalGenerationsRows[0] as any)?.count ?? 0);
  const totalScheduled = Number((totalScheduledRows[0] as any)?.count ?? 0);
  const totalPublished = Number((totalPublishedRows[0] as any)?.count ?? 0);
  const totalFailed = Number((totalFailedRows[0] as any)?.count ?? 0);
  const genThisWeek = Number((genThisWeekRows[0] as any)?.count ?? 0);
  const genLastWeek = Number((genLastWeekRows[0] as any)?.count ?? 0);
  const pubThisWeek = Number((pubThisWeekRows[0] as any)?.count ?? 0);
  const pubLastWeek = Number((pubLastWeekRows[0] as any)?.count ?? 0);

  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric" }),
      dateKey: d.toISOString().split("T")[0],
      count: 0,
    };
  });
  (activityData as { created_at: string | Date }[]).forEach((c) => {
    const day = days7.find((d) => d.dateKey === new Date(c.created_at).toISOString().split("T")[0]);
    if (day) day.count++;
  });

  const days30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" }),
      dateKey: d.toISOString().split("T")[0],
      count: 0,
    };
  });
  (recentData as { created_at: string | Date }[]).forEach((c) => {
    const day = days30.find((d) => d.dateKey === new Date(c.created_at).toISOString().split("T")[0]);
    if (day) day.count++;
  });

  const platformCounts: Record<string, number> = {};
  (platformData as { platform: string }[]).forEach((c) => {
    platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1;
  });
  const typeCounts: Record<string, number> = {};
  (typeData as { type: string }[]).forEach((c) => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });
  const statusCounts: Record<string, number> = {};
  (statusData as { status: string }[]).forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  const genDelta = genThisWeek - genLastWeek;
  const pubDelta = pubThisWeek - pubLastWeek;
  const deltaOf = (d: number) =>
    d === 0 ? null : { sign: d > 0 ? "↑" : "↓", value: Math.abs(d), pos: d > 0 };

  const STATS = [
    { label: t("totalGenerations"), value: totalGenerations, delta: deltaOf(genDelta), neg: false },
    { label: t("scheduled"), value: totalScheduled, delta: null, neg: false },
    { label: t("published"), value: totalPublished, delta: deltaOf(pubDelta), neg: false },
    { label: t("errors"), value: totalFailed, delta: null, neg: totalFailed > 0 },
  ];

  const hourCounts: number[] = Array(24).fill(0);
  const dayCounts: number[] = Array(7).fill(0);
  (allDates as { created_at: string }[]).forEach((c) => {
    const d = new Date(c.created_at);
    hourCounts[d.getHours()]++;
    dayCounts[d.getDay()]++;
  });
  const maxHour = Math.max(...hourCounts, 1);
  const maxDay = Math.max(...dayCounts, 1);
  const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const bestHour = hourCounts.indexOf(Math.max(...hourCounts));
  const bestDay = DAYS[dayCounts.indexOf(Math.max(...dayCounts))];

  const selectedProject = (projects as { id: string; name: string }[]).find((p) => p.id === projectFilter);

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="ui-label">Аналитика</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-tx-1 mt-1.5">
            {t("title")}
          </h1>
          <p className="text-[13px] text-tx-2 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Link
              href={`/${locale}/analytics`}
              className="text-[12px] text-tx-3 hover:text-tx-1 transition-colors"
            >
              Все проекты ×
            </Link>
          )}
          <div className="flex gap-1 flex-wrap">
            {(projects as { id: string; name: string }[]).slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/${locale}/analytics?project=${p.id}`}
                className={`text-[12px] px-3 py-1.5 rounded-[9px] border transition-colors ${projectFilter === p.id ? "bg-accent-dim border-accent text-accent font-medium" : "border-line text-tx-2 hover:border-line-strong"}`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Карточки */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {STATS.map((s) => (
          <div key={s.label} className="ui-surface p-4">
            <div className="ui-label mb-3">{s.label}</div>
            <div className={`ui-num text-[26px] font-semibold leading-none ${s.neg ? "text-neg" : "text-tx-1"}`}>
              {s.value}
            </div>
            {s.delta ? (
              <div className={`text-[11px] mt-2 font-medium ${s.delta.pos ? "text-pos" : "text-neg"}`}>
                {s.delta.sign} {s.delta.value} к прошлой неделе
              </div>
            ) : (
              <div className="text-[11px] mt-2 text-tx-3">к прошлой неделе</div>
            )}
          </div>
        ))}
      </div>

      {/* Тепловая карта */}
      {allDates.length > 0 && (
        <div className="ui-surface p-4 mb-6">
          <p className="text-[13px] font-semibold text-tx-1 mb-1">
            Лучшее время для постов
          </p>
          <p className="text-[11px] text-tx-3 mb-3">
            Лучший час:{" "}
            <span className="text-accent font-medium">{bestHour}:00</span> ·
            Лучший день:{" "}
            <span className="text-accent font-medium">{bestDay}</span>
          </p>
          <div className="flex gap-1 mb-3">
            {DAYS.map((day, i) => (
              <div key={day} className="flex-1 text-center">
                <p className="text-[9px] text-tx-3 mb-1">{day}</p>
                <div
                  className="h-6 rounded bg-track"
                  style={{ background: `rgba(var(--accent-rgb), ${dayCounts[i] / maxDay})` }}
                  title={`${dayCounts[i]} постов`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 overflow-x-auto pb-1">
            {hourCounts.map((count, h) => (
              <div key={h} className="flex-shrink-0 w-7 text-center">
                <div
                  className="h-8 rounded-sm mb-1"
                  style={{ background: `rgba(var(--accent-rgb), ${count / maxHour})`, minHeight: "4px" }}
                  title={`${h}:00 — ${count} постов`}
                />
                {h % 6 === 0 && <p className="text-[8px] text-tx-3">{h}:00</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnalyticsCharts
        days7={days7}
        days30={days30}
        platformCounts={platformCounts}
        typeCounts={typeCounts}
        statusCounts={statusCounts}
      />
    </div>
  );
}
