# MVI Content Factory — Project Context

## Что это за проект

**MVI Content Factory** — AI-платформа для SMM-специалистов и агентств на рынке Узбекистана/СНГ.
Сайт: **mvira.uz**
Разработчик/владелец: Jahongir (johasalimov1717@gmail.com)

---

## Стек технологий (АКТУАЛЬНЫЙ)

| Слой | Технология |
|------|-----------|
| Фреймворк | Next.js 16 (App Router) |
| Язык | TypeScript |
| БД | PostgreSQL напрямую через `pg` — НЕ Supabase клиент |
| Auth | JWT (`jsonwebtoken` + `bcryptjs`) — НЕ Supabase Auth |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) — модель `claude-haiku-4-5-20251001` для быстрых задач |
| Стили | Tailwind CSS + CSS-переменные |
| Стейт | TanStack React Query v5 |
| i18n | next-intl (ru / uz / en) |
| Иконки | lucide-react |
| Деплой | **Webdock VPS** (НЕ Vercel) |

> ⚠️ В CLAUDE.md ранее было написано "Supabase Auth" и "Vercel" — это НЕВЕРНО. Auth и БД — кастомные.

---

## Deploy — как происходит git push

1. Разработчик делает `git push origin main` с локальной машины
2. **GitHub Actions** (`.github/workflows/deploy.yml`) автоматически запускается
3. Actions подключается по SSH к **Webdock VPS** (`admin@mvira.uz`)
4. На сервере выполняется:
   ```bash
   cd /var/www/Content-Factory
   git pull origin main
   npm ci --omit=dev
   npm run build
   pm2 restart all --update-env
   ```
5. Сайт обновляется через ~2-3 минуты после пуша

**При ошибке деплоя:**
- Зайти на сервер по SSH
- `pm2 logs` — посмотреть ошибки
- `npm run build` — запустить вручную и посмотреть что сломалось
- `pm2 restart all --update-env` — перезапустить после исправления

---

## База данных

**Подключение:** через `lib/db.ts` → `pg.Pool` → переменная `DATABASE_URL`
**Пользователь БД:** `mvira_user`
**Имя БД:** `mvira`

**Утилиты:**
```ts
import { query, queryOne } from "@/lib/db";
// query() возвращает T[] (массив строк напрямую, НЕ { rows })
// queryOne() возвращает T | null
```

### Схема таблиц (актуальная после всех миграций)

**`users`**
```
id, email, password_hash, full_name, created_at, updated_at
```

**`projects`** (миграции 001, 006, 008)
```
id, user_id, name, niche, description, audience, tone, language,
logo_url, is_active, ai_agent_id, country, phone, website, keywords,
created_at, updated_at
```

**`landings`**
```
id, user_id, title, slug, content (JSON), published,
template_id, bg_image, settings (JSON), created_at, updated_at
```

**`leads`** (миграция 007)
```
id, landing_id, user_id, name, phone, email, message, status, created_at
```

**`ad_campaigns`**
```
id, user_id, project_id, name, goal, product, audience, budget,
date_from, date_to, status, platforms (JSON), created_at, updated_at
```

**`contents`, `ai_agents`, `tasks`, `profiles`** — стандартные, без изменений

### Миграции
```
001_init_no_supabase.sql      — начальная схема
002_missing_tables.sql        — дополнительные таблицы
003_fix_workspace_members.sql
004_fix_users_table.sql
005_password_reset_tokens.sql
006_project_extra_fields.sql  — country, phone, website в projects
007_landing_leads.sql         — landing_id, message в leads
008_project_keywords.sql      — keywords в projects
```

**Запуск миграции на сервере:**
```bash
sudo -u postgres psql -d mvira -f /var/www/Content-Factory/supabase/migrations/XXX.sql
```

---

## Auth

**Файл:** `lib/auth.ts`
- `getCurrentUser()` — читает JWT из cookie `auth_token`, возвращает `{ id, email, full_name }`
- `createToken(userId, email)` — создаёт JWT на 30 дней
- JWT_SECRET берётся из `process.env.JWT_SECRET`

Во всех Route Handlers:
```ts
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

---

## Структура папок (ключевые)

```
app/
  [locale]/(dashboard)/     ← все страницы дашборда ("use client")
    projects/page.tsx        ← проекты с вкладками, черновиками, AI-заполнением
    campaigns/page.tsx       ← кампании + WizardView
    landings/
      page.tsx               ← список лендингов + вкладка "Заявки" + кнопка Портфолио
      create/page.tsx        ← создание лендинга (sessionStorage + превью после генерации)
      [id]/edit/page.tsx     ← редактирование лендинга
  api/
    auth/me/route.ts         ← GET текущего пользователя → { user: { id, email, full_name } }
    projects/route.ts        ← GET все проекты / POST создать
    projects/[id]/route.ts   ← GET / PATCH / DELETE проект
    landings/route.ts        ← GET лендинги пользователя
    landings/[id]/route.ts   ← GET / PATCH / DELETE лендинг
    landings/generate/route.ts ← POST генерация лендинга через AI (возвращает { id, slug })
    landings/public/route.ts ← GET публичный лендинг по slug
    landings/portfolio/[userId]/route.ts ← GET опубликованные лендинги пользователя
    leads/route.ts           ← GET (все заявки пользователя) / POST (новая заявка)
    ai/suggest-project/route.ts ← AI заполнение description + audience + keywords
    ai/suggest-budget/route.ts  ← AI совет по бюджету кампании
  l/
    [slug]/page.tsx          ← публичный лендинг
    u/[userId]/page.tsx      ← публичное портфолио (все опубликованные лендинги)
components/
  ads/WizardView.tsx         ← визард создания кампании (2645+ строк, осторожно!)
```

---

## Дизайн-система

CSS-переменные (НЕ Tailwind цвета):
```
--bg, --panel, --panel-2, --line, --line-strong
--tx-1, --tx-2, --tx-3
--accent, --on-accent, --neg, --hover, --chip
```

Классы: `ui-surface`, `ui-label`, `text-tx-1/2/3`

---

## Текущий статус фич (последнее обновление: 2026-07-03)

### ✅ Работает
- Аутентификация (JWT, login/register)
- Проекты: создание, редактирование, черновики, ниша с деревом, тон с подстилями
  - Ниша "Другое" → показывает текстовый input
  - AI заполнить → description + audience + keywords (с показом ошибки)
  - AI заполнить по логотипу → анализирует картинку, заполняет ВСЕ поля (name, description, audience, tone, niche, language, keywords)
  - Поле "Ключевые слова" в правой колонке
  - Форма сохраняется в localStorage (не пропадает при навигации/обновлении)
  - Клик на лого → lightbox просмотр
  - Загрузка лого: клиентский ресайз до 800×800 JPEG 85% перед отправкой (нет 413)
- Кампании: WizardView с динамическими шагами по выбранным инструментам
  - Ниша — поиск прямо в шаге "Цель" (WIZARD_NICHE_TREE, 26 категорий)
  - AI совет по бюджету с объяснением (мин/рекомендуем/макс + 2-3 предложения почему)
  - Шаг "Платформы" всегда виден
- Лендинги:
  - Создание через AI (шаблоны, фон, sessionStorage между шагами)
  - После создания — превью с iframe, не редирект
  - Публичная страница `/l/[slug]`
  - Портфолио `/l/u/[userId]` — все опубликованные лендинги пользователя
  - Вкладка "Заявки" в /landings (все лиды с контактами)
  - Кнопка "Портфолио" в шапке /landings (только если есть опубликованные)
  - Хранилище проекта: клик на картинку → lightbox просмотр
- Заявки (leads): форма на лендинге → сохраняется в БД с landing_id
- Интеграции: Meta Ads использует отдельный `NEXT_PUBLIC_META_APP_ID` (не путать с Instagram app)
- AI-агенты, генерация контента, инфографика
- Биллинг (Click/Payme)
- Мультиязычность (ru/uz/en)

### 🔄 Частично / в процессе
- Instagram интеграция — OAuth есть, публикация частичная
- Telegram публикация — есть, дорабатывается
- CRM, командная работа, тикеты — базовая структура

### ❌ Не реализовано / заглушки
- Реальная аналитика по платформам (данные моковые)
- A/B тесты — UI есть, логика нет

---

## Правила работы с кодом (ВАЖНО)

1. **Перед изменением** — сначала прочитать файл через Read, не угадывать содержимое
2. **`query()` возвращает `T[]` напрямую** — никогда не делать `result.rows` (это undefined)
3. **Изменяя API** — проверить все места где он вызывается (grep)
4. **Изменяя схему БД** — создать новую миграцию `supabase/migrations/00N_name.sql`
5. **Миграцию запускать вручную** на сервере после деплоя
6. **Не трогать** без явного запроса: `middleware.ts`, `layout.tsx`, auth файлы
7. **TypeScript** — после изменений запустить `npx tsc --noEmit` чтобы убедиться что нет ошибок
8. **WizardView.tsx** — файл 2600+ строк, менять точечно только нужный блок
9. **Стили** — только Tailwind + CSS-переменные, никаких новых CSS файлов
10. **После каждой сессии** — обновить секцию "Последние изменения" в этом файле

---

## Последние изменения (лог)

### 2026-07-03 (текущая сессия)
- `components/landing/LandingRenderer.tsx`: полный редизайн — новые типы блоков:
  - `price` (старая цена перечёркнута + новая зелёная + кнопка + эмодзи-карточка)
  - `hero` теперь поддерживает `badge` (чёрная пилюля-метка), `centered`, `emoji`
  - `form` теперь поддерживает `dark` (тёмный фон #1A1A18) + `note` (подпись под кнопкой)
- `landings/create/page.tsx`:
  - Step1 добавлены поля `oldPrice`, `newPrice`, `productEmoji`
  - TEMPLATES заменены на 6 целевых: Товар, Заявка, Запись, Событие, Меню, Звонок
  - В шаге 2 (тип) для шаблона "product" показываются поля цены
- `api/landings/generate/route.ts`:
  - Разные промпты для каждого templateId (product/appointment/event/menu/callback/form)
  - Для "product": hero(badge,centered) + price + features + form(dark,note)
  - Переключён на claude-haiku-4-5-20251001 (быстрее)
- `landings/[id]/edit/page.tsx`:
  - Поддержка `price` блока в сайдбаре (emoji, oldPrice, newPrice, cta)
  - Hero: добавлено поле `badge`
  - Form: добавлены поля `note` и `dark` (toggle светлый/тёмный)

### 2026-07-02–03
- `projects/page.tsx`: ресайз лого перед загрузкой (800×800 JPEG 85%) — исправлен 413 при сохранении
- `projects/page.tsx`: localStorage персистентность формы (`project_tab_snapshots_v1`)
- `projects/page.tsx`: AI заполнение всех полей по логотипу (`handleAiFromImage` + кнопка)
- `projects/page.tsx`: lightbox для лого (клик на превью → полноэкранный просмотр)
- `projects/[id]/page.tsx`: lightbox для файлов хранилища
- `api/projects/route.ts` + `[id]/route.ts`: try-catch, тихие ошибки устранены
- `api/ai/suggest-project/route.ts`: поддержка vision (base64 и URL), возвращает все поля
- `api/ai/suggest-budget/route.ts`: объяснение бюджета (мин/рекомендуем/макс + текст почему)
- `components/ads/WizardView.tsx`: карточка с тремя колонками бюджета + текст объяснения
- `integrations/page.tsx`: Meta Ads использует `NEXT_PUBLIC_META_APP_ID` (отдельное FB приложение)
- `api/oauth/meta/callback/route.ts`: исправлен client_id для Meta Ads
- БД: `projects_tone_check` расширен (`professional`, `humorous`, `formal` добавлены)
- `.env` на сервере: добавлены `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET`

### 2026-07-01
- `projects/page.tsx`: исправлен баг "Другое" ниши (показывает input), добавлено поле Keywords, inline ошибка AI заполнения
- `api/projects/route.ts` + `[id]/route.ts`: добавлен keywords в POST и PATCH
- `api/ai/suggest-project/route.ts`: возвращает keywords в ответе
- `supabase/migrations/008_project_keywords.sql`: **запущена на сервере** ✅
- `components/ads/WizardView.tsx`: ниша-поиск прямо в шаге "Цель", AI budget показывает ошибку

### 2026-06-29 (предыдущая сессия)
- `landings/page.tsx`: вкладка "Заявки", кнопка "Портфолио"
- `landings/create/page.tsx`: sessionStorage + превью после генерации
- `api/landings/generate/route.ts`: возвращает slug
- `api/leads/route.ts`: GET + исправлен баг result.rows
- `app/l/u/[userId]/page.tsx`: публичная портфолио страница (новый файл)
- `supabase/migrations/007_landing_leads.sql`: **уже запущена на сервере** ✅

---

## Переменные окружения на сервере

Файл: `/var/www/Content-Factory/.env.local`
```
DATABASE_URL=postgresql://mvira_user:...@localhost:5432/mvira
JWT_SECRET=...
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_APP_URL=https://mvira.uz
```

PM2 должен быть запущен с `--update-env` чтобы подхватить новые переменные.
