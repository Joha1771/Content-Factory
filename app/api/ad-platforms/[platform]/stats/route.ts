import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const PERIOD_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const SOURCE_MAP: Record<string, string> = { meta: "meta_ads", google: "google_ads", yandex: "yandex" };

async function getGoogleStats(rec: any, days: number, leads: number) {
  const customerId = (rec.account_id ?? "").replace(/\D/g, "");
  if (!customerId) throw new Error("no customer id");
  const dateRange = days === 7 ? "LAST_7_DAYS" : days === 90 ? "LAST_90_DAYS" : "LAST_30_DAYS";
  const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rec.access_token}`, "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ query: `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr FROM customer WHERE segments.date DURING ${dateRange}` }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const m = json.results?.[0]?.metrics ?? {};
  const spend = (Number(m.costMicros) || 0) / 1_000_000;
  const clicks = Number(m.clicks) || 0;
  const impressions = Number(m.impressions) || 0;
  return NextResponse.json({ connected: true, isMock: false, spend, impressions, clicks,
    ctr: Number(((Number(m.ctr) || 0) * 100).toFixed(2)), leads, conversion: clicks > 0 ? Number(((leads / clicks) * 100).toFixed(2)) : 0 });
}

async function getMetaStats(rec: any, days: number, leads: number) {
  if (!rec.access_token || !rec.account_id) throw new Error("no token");
  const datePreset = days === 7 ? "last_7_days" : days === 90 ? "last_90_days" : "last_30_days";
  const accountId = rec.account_id.startsWith("act_") ? rec.account_id : `act_${rec.account_id}`;
  const res = await fetch(`https://graph.facebook.com/v18.0/${accountId}/insights?fields=spend,impressions,clicks,ctr&date_preset=${datePreset}&access_token=${rec.access_token}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const d = json.data?.[0] ?? {};
  const clicks = Number(d.clicks) || 0;
  return NextResponse.json({ connected: true, isMock: false, spend: Number(d.spend) || 0,
    impressions: Number(d.impressions) || 0, clicks, ctr: Number(Number(d.ctr || 0).toFixed(2)), leads,
    conversion: clicks > 0 ? Number(((leads / clicks) * 100).toFixed(2)) : 0 });
}

async function getYandexStats(
  rec: any,
  days: number,
  leads: number,
  userId: number | string
): Promise<NextResponse> {
  const today = new Date();
  const dateFrom = new Date(today.getTime() - days * 86_400_000).toISOString().split("T")[0];
  const dateTo = today.toISOString().split("T")[0];

  const reportBody = JSON.stringify({
    params: {
      SelectionCriteria: { DateFrom: dateFrom, DateTo: dateTo },
      FieldNames: ["Impressions", "Clicks", "Cost"],
      ReportName: "mvira-stats",
      ReportType: "CAMPAIGN_PERFORMANCE_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "NO",
      IncludeDiscount: "NO",
    },
  });
  const reportHeaders: Record<string, string> = {
    Authorization: `Bearer ${rec.access_token}`,
    "Content-Type": "application/json; charset=utf-8",
    "Accept-Language": "ru",
    skipReportHeader: "true",
    skipReportSummary: "true",
    returnMoneyInMicros: "false",
  };

  const deadline = Date.now() + 25_000;
  let tsv: string | null = null;
  while (Date.now() < deadline) {
    const res = await fetch("https://api.direct.yandex.com/v5/reports", {
      method: "POST",
      headers: reportHeaders,
      body: reportBody,
    });
    if (res.status === 401) {
      await query(
        "UPDATE ad_platforms SET is_active = false WHERE user_id = $1 AND platform_key = 'yandex'",
        [userId]
      );
      return NextResponse.json({ error: "token_expired", needs_reconnect: true }, { status: 401 });
    }
    if (res.status === 200) { tsv = await res.text(); break; }
    if (res.status === 400) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err?.error?.errorCode ?? "yandex_bad_request");
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  if (!tsv) throw new Error("yandex_report_timeout");

  const lines = tsv.trim().split("\n");
  const colNames = lines[0].split("\t");
  const idx = (name: string) => colNames.indexOf(name);
  let totalImpressions = 0, totalClicks = 0, totalCost = 0;
  for (const line of lines.slice(1).filter(l => l.trim())) {
    const cols = line.split("\t");
    totalImpressions += Number(cols[idx("Impressions")]) || 0;
    totalClicks += Number(cols[idx("Clicks")]) || 0;
    totalCost += Number(cols[idx("Cost")]) || 0;
  }
  const ctr = totalImpressions > 0
    ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
    : 0;
  return NextResponse.json({
    connected: true,
    isMock: false,
    spend: totalCost,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr,
    leads,
    conversion: totalClicks > 0 ? Number(((leads / totalClicks) * 100).toFixed(2)) : 0,
  });
}


export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const period = req.nextUrl.searchParams.get("period") ?? "30d";
  const days = PERIOD_DAYS[period] ?? 30;
  const accountId = req.nextUrl.searchParams.get("id");

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rec = accountId
    ? await queryOne<any>("SELECT * FROM ad_platforms WHERE id = $1 AND user_id = $2 AND is_active = true", [accountId, user.id])
    : await queryOne<any>("SELECT * FROM ad_platforms WHERE user_id = $1 AND platform_key = $2 AND is_active = true ORDER BY created_at LIMIT 1", [user.id, platform]);
  if (!rec) return NextResponse.json({ connected: false });

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const leadsRow = await queryOne<{ count: string }>(
    "SELECT COUNT(*) FROM leads WHERE user_id = $1 AND source = $2 AND created_at >= $3",
    [user.id, SOURCE_MAP[platform] ?? platform, since]
  );
  const leads = Number(leadsRow?.count || 0);

  try {
    if (platform === "google" && rec.access_token && rec.account_id) return await getGoogleStats(rec, days, leads);
    if (platform === "meta" && rec.access_token && rec.account_id) return await getMetaStats(rec, days, leads);
    if (platform === "yandex" && rec.access_token) return await getYandexStats(rec, days, leads, user.id);
  } catch (e: any) {
    return NextResponse.json({ connected: true, no_data: true, spend: 0, impressions: 0, clicks: 0, ctr: 0, leads, conversion: 0, error: String(e?.message ?? "api_error") });
  }

  // Platform connected but no API integration yet (VK, TikTok, myTarget, etc.)
  return NextResponse.json({ connected: true, no_data: true, spend: 0, impressions: 0, clicks: 0, ctr: 0, leads, conversion: 0 });
}
