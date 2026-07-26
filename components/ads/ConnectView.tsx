"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import {
  useAdPlatforms,
  useConnectPlatform,
  useDisconnectPlatform,
} from "@/lib/hooks/useAdsData";
import { PLATFORM_META } from "./data";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "mvi_ra_bot";

const AD_PLATFORMS = [
  { key: "yandex", region: "cis" },
  { key: "vk", region: "cis" },
  { key: "telegram", region: "cis" },
  { key: "mytarget", region: "cis" },
  { key: "google", region: "global" },
  { key: "meta", region: "global" },
  { key: "tiktok", region: "global" },
];
const SOON = [
  {
    key: "kaspi",
    name: "Kaspi Pay Ads",
    color: "#E31E24",
    abbr: "K",
    detail: "Q3 2026",
  },
];

type Integration = {
  id: string;
  platform: string;
  channel_id: string;
  channel_name: string;
  is_active: boolean;
};

export function ConnectView({ projectId }: { projectId?: string }) {
  const qc = useQueryClient();
  const { data: adPlatforms = [], isLoading } = useAdPlatforms(projectId);
  const connect = useConnectPlatform();
  const disconnect = useDisconnectPlatform();

  const [adModal, setAdModal] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [accountIdInput, setAccountIdInput] = useState("");
  const [tgModal, setTgModal] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [activeSection, setActiveSection] = useState<"ad" | "social">("ad");

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations");
      return res.ok ? res.json() : [];
    },
  });

  const connectedAdKeys = adPlatforms
    .filter((p) => p.is_active)
    .map((p) => p.platform_key);
  const tgChannels = integrations.filter((i) => i.platform === "telegram");
  const igChannels = integrations.filter((i) => i.platform === "instagram");

  const connectInstagram = () => {
    const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID ?? "";
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI ?? "";
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "instagram_business_basic,instagram_business_content_publish",
      response_type: "code",
    });
    window.location.href = `https://www.instagram.com/oauth/authorize?${params}`;
  };

  const connectTelegram = async () => {
    if (!channelInput.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/telegram/add-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelUsername: channelInput.replace("@", ""),
        }),
      });
      if (res.ok) {
        setChannelInput("");
        setTgModal(false);
        qc.invalidateQueries({ queryKey: ["integrations"] });
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectAd = async () => {
    if (!adModal) return;
    const meta = PLATFORM_META[adModal];
    if (!meta) return;
    await connect.mutateAsync({
      platform_key: adModal,
      name: meta.name,
      region: meta.region,
      color: meta.color,
      abbr: meta.abbr,
      access_token: tokenInput || undefined,
      account_id: accountIdInput || undefined,
      project_id: projectId,
      status: "active",
    } as any);
    setAdModal(null);
    setTokenInput("");
    setAccountIdInput("");
  };

  const fi: React.CSSProperties = {
    width: "100%",
    padding: "8px 11px",
    fontSize: 12,
    fontFamily: "inherit",
    border: "0.5px solid var(--line)",
    borderRadius: 7,
    background: "var(--bg)",
    color: "var(--tx-1)",
    outline: "none",
  };
  const s9: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    color: "var(--tx-3)",
    marginBottom: 9,
  };

  return (
    <div>
      {/* Section switcher */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--chip)",
          borderRadius: 9,
          padding: 3,
          marginBottom: 16,
          alignSelf: "flex-start",
          width: "fit-content",
        }}
      >
        {[
          { k: "ad", l: "📡 Рекламные кабинеты" },
          { k: "social", l: "📱 Соцсети" },
        ].map((s) => (
          <button
            key={s.k}
            onClick={() => setActiveSection(s.k as any)}
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 500,
              background:
                activeSection === s.k ? "var(--panel)" : "transparent",
              color: activeSection === s.k ? "var(--tx-1)" : "var(--tx-2)",
            }}
          >
            {s.l}
          </button>
        ))}
      </div>

      {/* Ad platforms */}
      {activeSection === "ad" && (
        <div>
          {isLoading && (
            <div
              style={{
                fontSize: 11,
                color: "var(--tx-2)",
                padding: "8px 0",
                marginBottom: 14,
              }}
            >
              Загрузка...
            </div>
          )}

          {adPlatforms.filter((p) => p.is_active).length > 0 && (
            <>
              <div style={s9}>
                Подключённые · {adPlatforms.filter((p) => p.is_active).length}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 9,
                  marginBottom: 14,
                }}
              >
                {adPlatforms
                  .filter((p) => p.is_active)
                  .map((p) => {
                    const meta = PLATFORM_META[p.platform_key] ?? {
                      color: "#888",
                      textColor: "#fff",
                      abbr: "?",
                    };
                    const warn =
                      p.token_expires_at &&
                      new Date(p.token_expires_at) <
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: "var(--panel)",
                          border: `0.5px solid ${warn ? "var(--warning)" : "var(--success)"}`,
                          borderRadius: 9,
                          padding: 11,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            marginBottom: 6,
                          }}
                        >
                          <PlatformLogo
                            abbr={p.abbr || meta.abbr}
                            color={p.color || meta.color}
                            textColor={meta.textColor}
                          />
                          <div
                            style={{ flex: 1, fontSize: 11, fontWeight: 500 }}
                          >
                            {p.name}
                          </div>
                          <Badge variant={warn ? "warning" : "success"}>
                            {warn ? "Обновить" : "Активен"}
                          </Badge>
                        </div>
                        {p.account_name && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--tx-2)",
                              marginBottom: 6,
                            }}
                          >
                            {p.account_name}
                          </div>
                        )}
                        {warn && p.token_expires_at && (
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--c-3)",
                              marginBottom: 6,
                            }}
                          >
                            ⚠ Истекает{" "}
                            {new Date(p.token_expires_at).toLocaleDateString(
                              "ru",
                            )}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{ fontSize: 9 }}
                          onClick={() => disconnect.mutate(p.id)}
                        >
                          Отключить
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          <div style={s9}>Доступно</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 9,
              marginBottom: 14,
            }}
          >
            {AD_PLATFORMS.filter((p) => !connectedAdKeys.includes(p.key)).map(
              (p) => {
                const meta = PLATFORM_META[p.key];
                if (!meta) return null;
                return (
                  <div
                    key={p.key}
                    style={{
                      background: "var(--panel)",
                      border: "0.5px solid var(--line)",
                      borderRadius: 9,
                      padding: 11,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 9,
                      }}
                    >
                      <PlatformLogo
                        abbr={meta.abbr}
                        color={meta.color}
                        textColor={meta.textColor}
                      />
                      <div style={{ fontSize: 11, fontWeight: 500 }}>
                        {meta.name}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setAdModal(p.key)}
                    >
                      ⊕ Подключить
                    </Button>
                  </div>
                );
              },
            )}
            {SOON.map((p) => (
              <div
                key={p.key}
                style={{
                  background: "var(--panel)",
                  border: "0.5px solid var(--line)",
                  borderRadius: 9,
                  padding: 11,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 9,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 16,
                      borderRadius: 3,
                      background: p.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                    }}
                  >
                    {p.abbr}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500 }}>{p.name}</div>
                </div>
                <Badge variant="muted">{p.detail}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social channels */}
      {activeSection === "social" && (
        <div>
          {/* Telegram */}
          <div
            style={{
              background: "var(--panel)",
              border: "0.5px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "13px 16px",
                borderBottom: "0.5px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 11,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "#0088CC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                TG
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Telegram</div>
                <div
                  style={{ fontSize: 11, color: "var(--tx-2)", marginTop: 2 }}
                >
                  Каналы и группы · {tgChannels.length} подключено
                </div>
              </div>
            </div>
            <div style={{ padding: "13px 16px" }}>
              {tgChannels.map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 11px",
                    background: "var(--panel-2)",
                    borderRadius: 8,
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--success)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
                    @{ch.channel_name}
                  </span>
                  <Badge variant="success">Активен</Badge>
                </div>
              ))}
              <div
                style={{
                  fontSize: 11,
                  color: "var(--tx-2)",
                  marginBottom: 10,
                  lineHeight: 1.6,
                }}
              >
                Добавь бота{" "}
                <strong style={{ color: "var(--primary)" }}>
                  @{BOT_USERNAME}
                </strong>{" "}
                как администратора канала, затем введи его username
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setTgModal(true)}
              >
                + Добавить канал
              </Button>
            </div>
          </div>

          {/* Instagram */}
          <div
            style={{
              background: "var(--panel)",
              border: "0.5px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "13px 16px",
                borderBottom: "0.5px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 11,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "#E1306C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                IG
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Instagram</div>
                <div
                  style={{ fontSize: 11, color: "var(--tx-2)", marginTop: 2 }}
                >
                  Business или Creator · {igChannels.length} подключено
                </div>
              </div>
            </div>
            <div style={{ padding: "13px 16px" }}>
              {igChannels.map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 11px",
                    background: "var(--panel-2)",
                    borderRadius: 8,
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--success)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
                    @{ch.channel_name}
                  </span>
                  <Badge variant="success">Активен</Badge>
                </div>
              ))}
              <Button
                variant="primary"
                size="sm"
                style={{ background: "#E1306C" }}
                onClick={connectInstagram}
              >
                Подключить Instagram
              </Button>
            </div>
          </div>

          {/* TikTok / VK soon */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[
              { name: "TikTok", color: "#000", abbr: "TT" },
              { name: "ВКонтакте", color: "#0077FF", abbr: "VK" },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  background: "var(--panel)",
                  border: "0.5px solid var(--line)",
                  borderRadius: 12,
                  padding: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 9,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: p.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {p.abbr}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                </div>
                <Badge variant="muted">Скоро</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Telegram add channel modal */}
      <Modal
        open={tgModal}
        onClose={() => setTgModal(false)}
        title="Добавить Telegram канал"
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "var(--panel-2)",
              borderRadius: 8,
              padding: 11,
              fontSize: 11,
              color: "var(--tx-2)",
              lineHeight: 1.7,
            }}
          >
            1. Зайди в настройки канала → Администраторы
            <br />
            2. Добавь{" "}
            <strong style={{ color: "var(--primary)" }}>@{BOT_USERNAME}</strong>
            <br />
            3. Дай права на публикацию сообщений
            <br />
            4. Введи username канала ниже
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--tx-2)",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Username канала
            </label>
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="@mychannel"
              onKeyDown={(e) => e.key === "Enter" && connectTelegram()}
              style={fi}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setTgModal(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={connectTelegram}
              style={{ opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? "Подключение..." : "Добавить"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ad platform connect modal */}
      <Modal
        open={!!adModal}
        onClose={() => setAdModal(null)}
        title={`Подключить ${adModal ? PLATFORM_META[adModal]?.name : ""}`}
        size="sm"
      >
        {adModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "var(--panel-2)",
                borderRadius: 8,
                padding: 11,
                fontSize: 11,
                color: "var(--tx-2)",
                lineHeight: 1.6,
              }}
            >
              Введите токен доступа от рекламного кабинета. Токен можно получить
              в настройках API платформы.
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--tx-2)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Access Token
              </label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Вставьте токен..."
                style={fi}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--tx-2)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                ID кабинета (необязательно)
              </label>
              <input
                type="text"
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value)}
                placeholder="account_12345"
                style={fi}
              />
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <Button variant="ghost" onClick={() => setAdModal(null)}>
                Отмена
              </Button>
              <Button
                variant="primary"
                onClick={handleConnectAd}
                style={{ opacity: connect.isPending ? 0.7 : 1 }}
              >
                {connect.isPending ? "Подключение..." : "Подключить"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
