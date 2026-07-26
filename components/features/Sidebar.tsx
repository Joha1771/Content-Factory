"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import LangSwitcher from "@/components/features/LangSwitcher";
import ThemeToggle from "@/components/features/ThemeToggle";
import { useUser, clearUserCache } from "@/lib/hooks/useUser";
import Logo from "@/components/ui/Logo";
import {
  LayoutDashboard,
  SquarePen,
  Columns3,
  Calendar,
  LineChart,
  FolderOpen,
  Plug,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
  type LucideIcon,
  Globe,
  // MVP-hidden icons (раскомментировать при включении пункта):
  // Megaphone, Gauge, ListChecks, Gift
} from "lucide-react";

type NavItem = { key: string; href: string; Icon: LucideIcon };

const MARKETING: NavItem[] = [
  { key: "projects", href: "/projects", Icon: FolderOpen },
  // { key: "campaigns", href: "/campaigns", Icon: Megaphone }, // MVP: hidden
  { key: "create", href: "/create", Icon: SquarePen },
  { key: "landings", href: "/landings", Icon: Globe },
];

const BUSINESS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { key: "content", href: "/history", Icon: Columns3 },
  { key: "calendar", href: "/calendar", Icon: Calendar },
  { key: "analytics", href: "/analytics", Icon: LineChart },
  // { key: "summary", href: "/summary", Icon: Gauge }, // MVP: hidden
];

const TOOLS: NavItem[] = [
  // { key: "tasks", href: "/tasks", Icon: ListChecks }, // MVP: hidden
  { key: "integrations", href: "/integrations", Icon: Plug },
];

const ACCOUNT: NavItem[] = [
  { key: "billing", href: "/billing", Icon: CreditCard },
  // { key: "referral", href: "/referral", Icon: Gift }, // MVP: hidden
  { key: "settings", href: "/settings", Icon: Settings },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const t = useTranslations("nav");
  const locale = useLocale();
  const { user } = useUser();

  useEffect(() => {
    if (user && process.env.NEXT_PUBLIC_ADMIN_EMAIL && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      setIsAdmin(true);
    }
  }, [user]);

  useEffect(() => {
    const mPaths = ["/campaigns", "/projects", "/create", "/ai-workers"];
    if (mPaths.some((p) => pathname.includes(p))) setMarketingOpen(true);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearUserCache();
    router.push(`/${locale}/auth/login`);
    router.refresh();
  };

  const go = (href: string) => {
    setActiveHref(href);
    startTransition(() => router.push(`/${locale}${href}`));
    onClose?.();
  };

  const isActive = (href: string) => {
    const full = `/${locale}${href}`;
    return (
      activeHref === href ||
      (!activeHref &&
        (pathname === full ||
          (href !== "/dashboard" && pathname.startsWith(full))))
    );
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  const NavButton = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const { Icon } = item;
    return (
      <button
        onClick={() => go(item.href)}
        className="w-full flex items-center gap-2.5 text-[12px] text-left cursor-pointer mb-[1px] focus:outline-none transition-all"
        style={{
          background: active ? "rgba(201,132,122,0.18)" : "transparent",
          color: active ? "#f0ebe3" : "rgba(240,235,227,0.72)",
          borderLeft: active ? "3px solid #c9847a" : "3px solid transparent",
          borderTop: "none",
          borderRight: "none",
          borderBottom: "none",
          borderRadius: "0 6px 6px 0",
          padding: "6px 10px 6px 9px",
          fontWeight: active ? 500 : 400,
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <Icon
          size={14}
          strokeWidth={1.6}
          style={{
            color: active ? "#c9847a" : "rgba(240,235,227,0.45)",
            flexShrink: 0,
          }}
        />
        <span className="flex-1">{t(item.key)}</span>
        {isPending && active && (
          <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
        )}
      </button>
    );
  };

  const GroupLabel = ({ label }: { label: string }) => (
    <div
      className="px-3 pb-1 pt-4"
      style={{
        fontSize: "9px",
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: "rgba(240,235,227,0.28)",
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  );

  const Collapsible = ({
    label,
    open,
    onToggle,
    children,
  }: {
    label: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) => (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 pb-1 pt-4 cursor-pointer"
        style={{ background: "none", border: "none", outline: "none" }}
      >
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.28em",
            textTransform: "uppercase" as const,
            color: "rgba(240,235,227,0.28)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <ChevronDown
          size={10}
          strokeWidth={2}
          style={{
            color: "rgba(240,235,227,0.28)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>
      <div
        style={{
          maxHeight: open ? 500 : 0,
          overflow: "hidden",
          transition: "max-height 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="px-4 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          onClick={() => go("/dashboard")}
          className="cursor-pointer hover:opacity-80 transition-opacity w-full text-left"
          style={{ background: "none", border: "none", outline: "none" }}
        >
          <Logo variant="light" size={36} horizontal />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Marketing - collapsible */}
        <Collapsible
          label="Маркетинг"
          open={marketingOpen}
          onToggle={() => setMarketingOpen((v) => !v)}
        >
          {MARKETING.map((item) => (
            <NavButton key={item.href} item={item} />
          ))}
        </Collapsible>

        {/* Business */}
        <div className="mb-1">
          <GroupLabel label={t("groupBusiness")} />
          {BUSINESS.map((item) => (
            <NavButton key={item.href} item={item} />
          ))}
        </div>

        {/* Tools */}
        <div className="mb-1">
          <GroupLabel label={t("groupTools")} />
          {TOOLS.map((item) => (
            <NavButton key={item.href} item={item} />
          ))}
        </div>

        {/* Account */}
        <div>
          <GroupLabel label={t("groupAccount")} />
          {ACCOUNT.map((item) => (
            <NavButton key={item.href} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        {isAdmin && (
          <button
            onClick={() => { window.location.href = "/admin"; }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] cursor-pointer mb-1"
            style={{ background: "none", border: "none", color: "#c9847a", borderRadius: 4 }}
          >
            <Settings size={13} strokeWidth={1.6} /> Admin
          </button>
        )}
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <LangSwitcher />
          <ThemeToggle />
        </div>
        <div
          className="flex items-center gap-2.5 px-2 py-2 rounded-[6px] cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        >
          <button
            onClick={() => go("/profile")}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
            style={{ background: "none", border: "none", outline: "none" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
              style={{ background: "#c9847a", color: "#2d1b4e" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12px] font-medium truncate" style={{ color: "#f0ebe3" }}>
                {user?.full_name || user?.email?.split("@")[0] || "Пользователь"}
              </div>
              <div className="text-[10px] truncate" style={{ color: "rgba(240,235,227,0.4)" }}>
                {user?.email || ""}
              </div>
            </div>
          </button>
          <button
            onClick={handleLogout}
            title="Выйти"
            className="p-1 cursor-pointer flex-shrink-0"
            style={{ background: "none", border: "none", color: "rgba(240,235,227,0.35)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c9847a"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(240,235,227,0.35)"; }}
          >
            <LogOut size={13} strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--sb-bg)", borderColor: "var(--sb-border)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--sb-tx-2)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <Logo variant="light" size={28} horizontal />
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative w-60 flex flex-col h-full shadow-xl"
            style={{ background: "var(--sb-bg)" }}
          >
            <NavContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <aside
        className="hidden md:flex flex-shrink-0 flex-col h-screen w-[220px]"
        style={{
          background: "var(--sb-bg)",
          borderRight: "0.5px solid var(--sb-border)",
        }}
      >
        <NavContent />
      </aside>
    </>
  );
}
