"use client";
import { useState, useEffect } from "react";
import Script from "next/script";
import LandingRenderer, { Block } from "@/components/landing/LandingRenderer";

type PixelsConfig = {
  metaPixelId?: string;
  yandexMetrikaId?: string;
  gaId?: string;
};

type AfterSubmitConfig = {
  mode?: string;
  message?: string;
  redirectUrl?: string;
  telegramUrl?: string;
  whatsappPhone?: string;
};

type Props = {
  landingId: string;
  createdAt: string;
  blocks: Block[];
  bgImage?: string;
  brandColor?: string;
  autoCloseDays?: number | null;
  widgets?: { chat?: boolean; quickCall?: boolean };
  pixels?: PixelsConfig;
  afterSubmit?: AfterSubmitConfig;
};

function useCountdown(deadline: Date | null) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0 }); return; }
      const totalSec = Math.floor(diff / 1000);
      setTimeLeft({ h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return timeLeft;
}

export default function PublicLandingClient({
  landingId, createdAt, blocks, bgImage, brandColor, autoCloseDays, widgets, pixels, afterSubmit,
}: Props) {
  const deadline = autoCloseDays != null
    ? (() => { const d = new Date(createdAt); d.setDate(d.getDate() + autoCloseDays); return d; })()
    : null;

  const isExpired = deadline !== null && deadline.getTime() < Date.now();
  const daysUntil = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null;
  const showCountdown = daysUntil !== null && daysUntil <= 3 && !isExpired;

  const countdown = useCountdown(showCountdown ? deadline : null);

  // Feature 6: UTM/Source capture
  const [source, setSource] = useState<Record<string, string>>({});
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const captured: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const val = params.get(key);
      if (val) captured[key] = val;
    }
    if (document.referrer) {
      try {
        captured["referrer"] = new URL(document.referrer).hostname;
      } catch {
        captured["referrer"] = document.referrer;
      }
    }
    setSource(captured);
  }, []);

  const handleLeadSubmit = async (data: { name: string; phone: string; honeypot: string; loadedAt: number }) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landing_id: landingId,
        name: data.name,
        phone: data.phone,
        honeypot: data.honeypot,
        loadedAt: data.loadedAt,
        source,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || "Ошибка сервера");
    }
    // Feature 1: Fire pixel events on success
    if (pixels?.metaPixelId) {
      (window as any).fbq?.("track", "Lead");
    }
    if (pixels?.yandexMetrikaId) {
      (window as any).ym?.(Number(pixels.yandexMetrikaId), "reachGoal", "lead");
    }
    if (pixels?.gaId) {
      (window as any).gtag?.("event", "generate_lead");
    }
  };

  if (isExpired) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F0F0F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⏰</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0, marginBottom: 8, textAlign: "center" }}>Акция завершена</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", margin: 0 }}>
          Предложение действовало до {deadline!.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div style={{ position: "relative" }}>
      {/* Feature 1: Pixel scripts */}
      {pixels?.metaPixelId && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixels.metaPixelId}');
            fbq('track', 'PageView');
          `}</Script>
        </>
      )}
      {pixels?.yandexMetrikaId && (
        <Script id="yandex-metrika" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
          (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
          ym(${pixels.yandexMetrikaId}, "init", { clickmap:true, trackLinks:true, accurateTrackBounce:true });
        `}</Script>
      )}
      {pixels?.gaId && (
        <>
          <Script id="ga-script" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${pixels.gaId}`} />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${pixels.gaId}');
          `}</Script>
        </>
      )}

      {/* Deadline banner */}
      {deadline && !isExpired && (
        <div style={{ background: "#1A1A18", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 500 }}>
          Предложение действует до {deadline.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          {showCountdown && countdown && (
            <span style={{ marginLeft: 12, fontFamily: "monospace", fontWeight: 700, color: countdown.h === 0 && countdown.m < 10 ? "#EF4444" : "#4ABA74" }}>
              {countdown.h === 0 && countdown.m === 0 && countdown.s === 0
                ? "Завершено"
                : `Осталось: ${pad(countdown.h)}:${pad(countdown.m)}:${pad(countdown.s)}`}
            </span>
          )}
        </div>
      )}

      <LandingRenderer
        blocks={blocks}
        bgImage={bgImage}
        brandColor={brandColor}
        onLeadSubmit={handleLeadSubmit}
        afterSubmit={afterSubmit}
      />

      {/* Chat widget */}
      {widgets?.chat && (
        <button
          onClick={() => alert("Чат скоро будет доступен!")}
          style={{ position: "fixed", bottom: widgets?.quickCall ? 88 : 24, right: 24, width: 52, height: 52, borderRadius: "50%", background: "#25D366", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,211,102,0.4)", zIndex: 999 }}
          title="Открыть чат"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.656 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#fff"/>
          </svg>
        </button>
      )}

      {/* Quick call widget */}
      {widgets?.quickCall && (
        <button
          onClick={() => alert("AI перезвонит в течение 1 минуты! Функция скоро будет доступна.")}
          style={{ position: "fixed", bottom: 24, right: 24, width: 52, height: 52, borderRadius: "50%", background: "#3B82F6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(59,130,246,0.4)", zIndex: 999 }}
          title="Быстрый звонок"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#fff"/>
          </svg>
        </button>
      )}
    </div>
  );
}
