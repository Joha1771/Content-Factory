"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/features/Sidebar";
import { TopNavbar } from "@/components/features/TopNavbar";
import { AiAdvisorPanel } from "@/components/features/AiAdvisorPanel";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const SIDEBAR_KEY = "sidebar_collapsed";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const showAdvisor = !pathname.includes("/campaigns");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar with collapse animation */}
      <div
        style={{
          width: collapsed ? 0 : 220,
          overflow: "hidden",
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
        }}
      >
        <Sidebar />
      </div>

      {/* Main area */}
      <main className="flex-1 overflow-hidden flex flex-col gap-2 md:pt-2 md:pr-2 md:pb-2 md:pl-2 min-w-0">
        {/* Top navbar with toggle button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle button */}
          <button
            onClick={toggle}
            className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
            style={{
              width: 36,
              height: 44,
              borderRadius: 12,
              background: "var(--panel)",
              border: "0.5px solid var(--line)",
              color: "var(--tx-3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--tx-1)";
              (e.currentTarget as HTMLElement).style.background =
                "var(--hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--tx-3)";
              (e.currentTarget as HTMLElement).style.background =
                "var(--panel)";
            }}
            title={collapsed ? "Открыть меню" : "Скрыть меню"}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.6} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.6} />
            )}
          </button>

          {/* Navbar */}
          <div className="flex-1">
            <TopNavbar />
          </div>
        </div>

        {/* Page content + AI Advisor */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", gap: 8, minHeight: 0 }}>
          <div className="flex-1 bg-panel border border-line rounded-2xl overflow-y-auto md:pt-0 pt-14 min-h-0">
            {children}
          </div>
          {showAdvisor && <AiAdvisorPanel pathname={pathname} />}
        </div>
      </main>
    </div>
  );
}
