"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useUser, clearUserCache } from "@/lib/hooks/useUser";
import {
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Проекты", href: "/projects" },
  // { label: "Кампании", href: "/campaigns" },           // MVP: hidden
  // { label: "Инфографика", href: "/infographics" },     // MVP: hidden
  // { label: "Отчёты", href: "/campaigns?tab=reports" }, // MVP: hidden
  { label: "Подключения", href: "/integrations" },
  // { label: "Сотрудники", href: "/ai-workers" },        // MVP: hidden
];

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function TokenWidget() {
  const locale = useLocale();
  const router = useRouter();
  const [tokens, setTokens] = useState<{
    plan: string;
    tokens_total: number;
    tokens_used: number;
    tokens_remaining: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/tokens/balance")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json) return;
        setTokens({
          plan: json.plan ?? "free",
          tokens_total: Number(json.tokens_total) || 0,
          tokens_used: Number(json.tokens_used) || 0,
          tokens_remaining: Number(json.tokens_remaining) || 0,
        });
      });
  }, []);

  if (!tokens) return null;

  const total = tokens.tokens_total ?? 0;
  const used = tokens.tokens_used ?? 0;
  const remaining = tokens.tokens_remaining ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const low = remaining <= total * 0.15;

  return (
    <button
      onClick={() => router.push(`/${locale}/tokens`)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 8,
        background: "var(--panel-2)",
        border: "0.5px solid var(--line)",
        cursor: "pointer",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--panel-2)";
      }}
    >
      <span style={{ fontSize: 12 }}>⚡</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 110 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: 10, color: "var(--tx-3)" }}>Токены:</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: low ? "var(--neg)" : "var(--tx-1)" }}>
              {remaining.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: "var(--tx-3)" }}>
              / {total.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "var(--tx-3)", background: "var(--chip)", padding: "1px 5px", borderRadius: 4 }}>
            {PLAN_LABELS[tokens.plan] ?? tokens.plan}
          </span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 2,
              background: low ? "var(--neg)" : "var(--accent)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    </button>
  );
}

export function TopNavbar() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications] = useState(3);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUserCache();
    router.push(`/${locale}/auth/login`);
  };

  const isActive = (href: string) => {
    if (href === "/campaigns?tab=reports") {
      return pathname === `/${locale}/campaigns` && (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") === "reports" : false);
    }
    if (href === "/campaigns") {
      return (
        pathname === `/${locale}/campaigns` &&
        (typeof window === "undefined" || new URLSearchParams(window.location.search).get("tab") !== "reports")
      ) || pathname.startsWith(`/${locale}/campaigns/`);
    }
    const full = `/${locale}${href}`;
    return pathname === full || pathname.startsWith(full + "/");
  };

  return (
    <div
      className="flex items-center px-4 flex-shrink-0"
      style={{
        height: 44,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        gap: 4,
      }}
    >
      {/* Left: nav links */}
      <div className="flex items-center gap-0.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
        {NAV_LINKS.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={`/${locale}${link.href}`}
              className="px-3 py-1.5 text-[12px] transition-colors"
              style={{
                background: active ? "rgba(45,27,78,0.07)" : "transparent",
                color: active ? "#2d1b4e" : "rgba(45,27,78,0.45)",
                textDecoration: "none",
                borderRadius: 4,
                fontWeight: active ? 500 : 400,
                letterSpacing: active ? "0.01em" : "normal",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "#2d1b4e";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(45,27,78,0.45)";
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Center: token balance */}
      <div className="flex-1 flex items-center justify-center">
        <TokenWidget />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div ref={searchRef} style={{ position: "relative" }}>
          {searchOpen ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
              style={{
                background: "var(--panel-2)",
                border: "0.5px solid var(--line)",
              }}
            >
              <Search
                size={13}
                style={{ color: "var(--tx-3)", flexShrink: 0 }}
              />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                placeholder="Поиск..."
                style={{
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  color: "var(--tx-1)",
                  width: 160,
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
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
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-[8px] cursor-pointer transition-colors"
              style={{
                background: "none",
                border: "none",
                color: "var(--tx-3)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <Search size={15} strokeWidth={1.6} />
            </button>
          )}
        </div>

        {/* Notifications */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-[8px] cursor-pointer transition-colors relative"
          style={{ background: "none", border: "none", color: "var(--tx-3)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
          }}
        >
          <Bell size={15} strokeWidth={1.6} />
          {notifications > 0 && (
            <div
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--neg)",
                border: "1.5px solid var(--panel)",
              }}
            />
          )}
        </button>

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 rounded-[8px] cursor-pointer transition-colors"
            style={{
              background: profileOpen ? "var(--hover)" : "none",
              border: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "var(--hover)";
            }}
            onMouseLeave={(e) => {
              if (!profileOpen)
                (e.currentTarget as HTMLElement).style.background = "none";
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
              style={{ background: "#2d1b4e", color: "#f0ebe3" }}
            >
              {initials}
            </div>
            <ChevronDown
              size={12}
              strokeWidth={2}
              style={{
                color: "var(--tx-3)",
                transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
              }}
            />
          </button>

          {profileOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--panel)",
                border: "0.5px solid var(--line)",
                borderRadius: 10,
                padding: 6,
                minWidth: 200,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "8px 10px",
                  borderBottom: "0.5px solid var(--line)",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--tx-1)",
                  }}
                >
                  {user?.full_name ||
                    user?.email?.split("@")[0] ||
                    "Пользователь"}
                </div>
                <div
                  style={{ fontSize: 10, color: "var(--tx-3)", marginTop: 2 }}
                >
                  {user?.email}
                </div>
              </div>
              {[
                { icon: User, label: "Профиль", href: "/profile" },
                { icon: Settings, label: "Настройки", href: "/settings" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(`/${locale}${item.href}`);
                    setProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[12px] cursor-pointer transition-colors"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--tx-2)",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "none";
                  }}
                >
                  <item.icon
                    size={14}
                    strokeWidth={1.6}
                    style={{ color: "var(--tx-3)" }}
                  />
                  {item.label}
                </button>
              ))}
              <div
                style={{
                  borderTop: "0.5px solid var(--line)",
                  marginTop: 4,
                  paddingTop: 4,
                }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[12px] cursor-pointer transition-colors"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--neg)",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--hover)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "none";
                  }}
                >
                  <LogOut size={14} strokeWidth={1.6} />
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
