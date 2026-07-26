"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@/lib/hooks/useUser";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"profile" | "password" | "danger" | "telegram">("profile");
  const [telegramToken, setTelegramToken] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      return res.ok ? res.json() : null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      setName(user.full_name || "");
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name }),
    });
    if (res.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError("Ошибка сохранения");
    }
    setSaving(false);
  };

  const handleAvatarChange = async (file: File) => {
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload/avatar", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar_url: url }) });
    }
    setAvatarUploading(false);
  };

  const handleChangePassword = async () => {
    if (passwords.next !== passwords.confirm) { setPwdError("Пароли не совпадают"); return; }
    if (passwords.next.length < 6) { setPwdError("Минимум 6 символов"); return; }
    setPwdSaving(true);
    setPwdError("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwords.next }),
    });
    if (res.ok) {
      setPwdSuccess(true);
      setPasswords({ next: "", confirm: "" });
      setTimeout(() => setPwdSuccess(false), 3000);
    } else {
      const data = await res.json();
      setPwdError(data.error || "Ошибка");
    }
    setPwdSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) return;
    setDeleting(true);
    await fetch("/api/auth/profile", { method: "DELETE" });
    router.push(`/${locale}/auth/login`);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}/auth/login`);
    router.refresh();
  };

  if (userLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : user?.email?.[0]?.toUpperCase() || "U";
  const joinedDate = (user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-line-strong text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors bg-panel";

  return (
    <div className="min-h-screen bg-panel-2 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="ui-label">Профиль</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-tx-1 mt-1.5">Личный кабинет</h1>
          <p className="text-[13px] text-tx-2 mt-1">Управление аккаунтом и настройками</p>
        </div>

        <div className="bg-panel rounded-2xl border border-line-strong p-5 mb-4 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-2xl overflow-hidden cursor-pointer group relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-accent flex items-center justify-center text-on-accent text-xl font-bold">{initials}</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {avatarUploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="text-white text-xs">📷</span>}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarChange(e.target.files[0])} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-tx-1 truncate">{name || "—"}</p>
            <p className="text-sm text-tx-3 truncate">{user?.email}</p>
            <p className="text-xs text-tx-3 mt-0.5">С нами с {joinedDate}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-strong text-xs text-tx-3 hover:text-neg hover:border-line hover:bg-chip transition-all cursor-pointer flex-shrink-0">
            Выйти
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Проекты", value: stats.projects || 0 },
              { label: "Контент", value: stats.contents || 0 },
              { label: "Опубликовано", value: stats.published || 0 },
              { label: "Запланировано", value: stats.scheduled || 0 },
            ].map((s) => (
              <div key={s.label} className="bg-panel rounded-xl border border-line-strong p-3 text-center">
                <p className="text-xl font-bold text-accent">{s.value}</p>
                <p className="text-[10px] text-tx-3 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-panel rounded-2xl border border-line-strong overflow-hidden">
          <div className="flex border-b border-line">
            {[{ key: "profile", label: "Профиль" }, { key: "password", label: "Пароль" }, { key: "danger", label: "Опасная зона" }, { key: "telegram", label: "Telegram" }].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex-1 py-3 text-xs font-semibold transition-colors cursor-pointer ${activeTab === tab.key ? tab.key === "danger" ? "text-neg border-b-2 border-red-400" : "text-accent border-b-2 border-accent" : "text-tx-3 hover:text-tx-2"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "profile" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1.5">Полное имя</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1.5">Email</label>
                  <input type="email" value={user?.email || ""} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
                  <p className="text-[10px] text-tx-3 mt-1">Email нельзя изменить</p>
                </div>
                {saveError && <div className="bg-chip border border-line rounded-lg px-3 py-2 text-xs text-neg">{saveError}</div>}
                {saveSuccess && <div className="bg-accent-dim border border-accent/20 rounded-lg px-3 py-2 text-xs text-accent font-medium">✓ Сохранено</div>}
                <button onClick={handleSaveProfile} disabled={saving} className="w-full py-2.5 bg-accent hover:opacity-90 text-on-accent text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
                  {saving ? "Сохраняем..." : "Сохранить изменения"}
                </button>
              </div>
            )}

            {activeTab === "password" && (
              <div className="space-y-4">
                <p className="text-xs text-tx-3">Введите новый пароль дважды. Минимум 6 символов.</p>
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1.5">Новый пароль</label>
                  <input type="password" value={passwords.next} onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} placeholder="Минимум 6 символов" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-2 mb-1.5">Подтвердите пароль</label>
                  <input type="password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} placeholder="Повторите пароль" className={inputClass} />
                </div>
                {pwdError && <div className="bg-chip border border-line rounded-lg px-3 py-2 text-xs text-neg">{pwdError}</div>}
                {pwdSuccess && <div className="bg-accent-dim border border-accent/20 rounded-lg px-3 py-2 text-xs text-accent font-medium">✓ Пароль изменён</div>}
                <button onClick={handleChangePassword} disabled={pwdSaving || !passwords.next || !passwords.confirm} className="w-full py-2.5 bg-accent hover:opacity-90 text-on-accent text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer">
                  {pwdSaving ? "Меняем..." : "Изменить пароль"}
                </button>
              </div>
            )}

            {activeTab === "telegram" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-tx-1 mb-1">Уведомления в Telegram</h3>
                  <p className="text-xs text-tx-3">Получай уведомления о публикациях и еженедельный отчёт</p>
                </div>
                {telegramLinked ? (
                  <div className="bg-accent-dim border border-accent rounded-xl p-4">
                    <p className="text-sm font-medium text-accent mb-1">Telegram подключён</p>
                    <button onClick={async () => { await fetch("/api/telegram/link-profile", { method: "DELETE" }); setTelegramLinked(false); setTelegramToken(null); }} className="text-xs text-neg hover:underline cursor-pointer">Отвязать Telegram</button>
                  </div>
                ) : telegramToken ? (
                  <div className="bg-chip border border-accent rounded-xl p-4">
                    <p className="text-xs font-medium text-c-2 mb-2">Отправь боту эту команду:</p>
                    <div className="bg-panel border border-accent rounded-lg px-3 py-2 font-mono text-sm text-tx-1 mb-3 select-all">/link {telegramToken}</div>
                    <a href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "mvi_ra_bot"}?start=link_${telegramToken}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2AABEE] text-on-accent text-xs font-medium rounded-lg hover:opacity-90 transition-colors">
                      Открыть @{process.env.NEXT_PUBLIC_BOT_USERNAME || "mvi_ra_bot"}
                    </a>
                    <p className="text-[10px] text-c-2 mt-2">Код действителен 10 минут</p>
                  </div>
                ) : (
                  <button onClick={async () => { setTelegramLoading(true); const res = await fetch("/api/telegram/link-profile", { method: "POST" }); const data = await res.json(); if (data.token) setTelegramToken(data.token); setTelegramLoading(false); }} disabled={telegramLoading} className="flex items-center gap-2 px-4 py-3 bg-[#2AABEE] text-on-accent text-sm font-medium rounded-xl hover:opacity-90 cursor-pointer disabled:opacity-60 transition-colors">
                    {telegramLoading ? "Генерирую код..." : "Привязать Telegram"}
                  </button>
                )}
              </div>
            )}

            {activeTab === "danger" && (
              <div className="space-y-4">
                <div className="bg-chip border border-line rounded-xl p-4">
                  <p className="text-sm font-semibold text-neg mb-1">Удаление аккаунта</p>
                  <p className="text-xs text-neg mb-3">Это действие необратимо. Все ваши проекты, контент и интеграции будут удалены.</p>
                  <label className="block text-xs font-medium text-neg mb-1.5">Введите ваш email для подтверждения:</label>
                  <input type="email" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={user?.email} className="w-full px-3 py-2 rounded-lg border border-line text-sm outline-none focus:border-red-400 bg-panel mb-3" />
                  <button onClick={handleDeleteAccount} disabled={deleteConfirm !== user?.email || deleting} className="w-full py-2.5 bg-neg hover:opacity-90 text-on-accent text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                    {deleting ? "Удаляем..." : "Удалить аккаунт навсегда"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
