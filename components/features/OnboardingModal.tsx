"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STEPS = [
  {
    icon: "📁",
    title: "Создай первый проект",
    desc: "Проект — это бренд или клиент. Укажи название, нишу и аудиторию. Claude будет писать в нужном стиле.",
    action: { label: "Создать проект", href: "/projects" },
  },
  {
    icon: "✈️",
    title: "Подключи Telegram канал",
    desc: "Добавь @mvi_ra_bot как администратора в свой канал, затем подключи в Интеграциях.",
    action: { label: "Перейти в Интеграции", href: "/integrations" },
  },
  {
    icon: "✦",
    title: "Сгенерируй первый пост",
    desc: "Выбери проект, укажи тему — Claude напишет хук, текст, хэштеги и CTA за 6 секунд.",
    action: { label: "Создать пост", href: "/create" },
  },
  {
    icon: "📅",
    title: "Запланируй публикацию",
    desc: "Выбери дату и время — бот автоматически опубликует пост в нужный момент.",
    action: { label: "Открыть календарь", href: "/calendar" },
  },
];

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dismissed = localStorage.getItem("onboarding_dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("onboarding_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent-darker to-accent px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-white/70">
              Добро пожаловать в MVI Content Factory
            </p>
            <button
              onClick={dismiss}
              className="text-white/50 hover:text-white cursor-pointer text-lg"
            >
              ×
            </button>
          </div>
          <h2 className="text-lg font-bold">Начнём за 4 шага 🚀</h2>
          <div className="flex gap-1.5 mt-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${i <= step ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="text-4xl mb-3">{current.icon}</div>
          <h3 className="text-base font-bold text-gray-900 mb-2">
            {current.title}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            {current.desc}
          </p>

          <div className="flex gap-3">
            <Link
              href={current.action.href}
              onClick={dismiss}
              className="flex-1 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl text-center hover:bg-accent-darker transition-colors"
            >
              {current.action.label}
            </Link>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Далее →
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Начать
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => {
                await fetch("/api/demo", { method: "POST" });
                dismiss();
                window.location.reload();
              }}
              className="flex-1 text-xs text-accent hover:underline cursor-pointer py-1"
            >
              Попробовать с демо-данными
            </button>
            <button
              onClick={dismiss}
              className="flex-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer py-1"
            >
              Пропустить
            </button>
          </div>
        </div>

        {/* Step counter */}
        <div className="px-6 pb-4 text-center">
          <p className="text-[10px] text-gray-400">
            Шаг {step + 1} из {STEPS.length}
          </p>
        </div>
      </div>
    </div>
  );
}
