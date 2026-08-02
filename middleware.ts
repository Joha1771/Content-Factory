import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { jwtVerify } from "jose";

const locales = ["ru", "uz", "en"];
const defaultLocale = "ru";
const COOKIE_NAME = "auth_token";

const handleI18n = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

async function verifyEdgeToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "change-me-in-production"
    );
    const { payload } = await jwtVerify(token, secret);
    if (!payload.userId || !payload.email) return null;
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 0. Subdomain landing routing (e.g. my-shop.mvira.uz → /l/my-shop) ───────
  const host = request.headers.get("host") || "";
  const appHost = (process.env.NEXT_PUBLIC_APP_URL || "https://mvira.uz")
    .replace(/^https?:\/\//, "")
    .split(":")[0];
  const subdomain = host.replace(`.${appHost}`, "");
  if (subdomain && subdomain !== host && subdomain !== "www") {
    const url = request.nextUrl.clone();
    url.pathname = `/l/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // ── 1. Пропускаем API, статику и SEO-файлы ──────────────────────────────────
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/og") ||
    pathname.startsWith("/l/") ||
    pathname.startsWith("/l/u/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/site.webmanifest" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|xml|txt|json|webmanifest)$/)
  ) {
    return NextResponse.next();
  }

  // ── 2. Admin маршруты ───────────────────────────────────────────────────────
  const isAdminDashboard = /^\/(ru|uz|en)\/admin\/dashboard/.test(pathname);
  const isAdminLogin = /^\/(ru|uz|en)\/admin$/.test(pathname);

  if (isAdminDashboard) {
    const adminToken = request.cookies.get("admin_token");
    if (adminToken?.value !== process.env.ADMIN_SECRET) {
      const locale = pathname.split("/")[1] || defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
    }
    return handleI18n(request);
  }
  if (isAdminLogin) return handleI18n(request);

  // ── 3. Получаем пользователя из JWT cookie (Edge-совместимо) ────────────────
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyEdgeToken(token) : null;

  const response = handleI18n(request);

  // ── 4. Лендинг ──────────────────────────────────────────────────────────────
  const isLanding = /^\/(ru|uz|en)$/.test(pathname);
  if (isLanding) {
    if (user) {
      const locale = pathname.split("/")[1] || defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
    return response;
  }

  // ── 5. Защищённые маршруты ──────────────────────────────────────────────────
  const protectedPattern =
    /^\/(ru|uz|en)\/(dashboard|summary|projects|create|calendar|campaigns|integrations|history|analytics|team|tasks|pipeline|ai-workers|ab-tests|billing|profile|settings|crm|chat|tickets|referral|landings|infographics|tokens)/;

  if (protectedPattern.test(pathname) && !user) {
    const locale = pathname.split("/")[1] || defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
  }

  // ── 6. Auth страницы — если уже авторизован ─────────────────────────────────
  const authPattern = /^\/(ru|uz|en)\/auth/;
  if (authPattern.test(pathname) && user) {
    const locale = pathname.split("/")[1] || defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
