# Выкладка: API на Render, кабинет на Vercel

API — постоянно работающий сервер: раз в минуту он снимает просроченные брони, отмечает неявки, повторяет возвраты. Поэтому он живёт на Render вместе с базой, а кабинет партнёра и админка — статический сайт на Vercel.

## 1. API и база на Render

Всё описано в [`render.yaml`](../render.yaml) (Render Blueprint):

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → подключите GitHub и выберите этот репозиторий.
2. Render покажет, что создаст: базу `happy-hours-db` и сервис `happy-hours-api`. Нажмите **Deploy Blueprint**.
3. Через 5–10 минут сервис станет **Live**. Его адрес вида `https://happy-hours-api.onrender.com` — проверка: `<адрес>/health` отвечает `{"ok":true,…}`.

Что Render настроит сам: базу и `DATABASE_URL`, случайные `JWT_SECRET` и `PAYMENT_WEBHOOK_SECRET`, `PUBLIC_URL` (из адреса сервиса), миграции базы при каждом запуске.

**Фото** хранятся в Cloudflare R2 (бакет `happy-hours-uploads` с публичным адресом `r2.dev`). Ключи R2 — `R2_ACCESS_KEY_ID` и `R2_SECRET_ACCESS_KEY` (R2 → Manage API tokens, права Object Read & Write на этот бакет) — вводятся вручную в **Environment** сервиса; Render спросит их при создании из Blueprint.

Тарифы в `render.yaml`: сервис **Starter** и база **Basic-256mb** (~$13/мес вместе). Бесплатный сервис засыпает без запросов, и ежеминутные задачи перестают выполняться; бесплатная база удаляется через 30 дней — для продаж они не подходят.

Пока нет банка и Nikita.kg, это **тестовый сервер**: `ALLOW_MOCK_PAYMENTS=true` (оплата без денег) и `SHOW_OTP_CODES=true` (код входа на экране). **Перед запуском для настоящих клиентов** эти две переменные удаляются в **Environment** сервиса, а вместо них подключаются банк и SMS.

Свой адрес кабинета или домен — в переменную `CORS_ORIGINS` (через запятую).

## 2. Кабинет и админка на Vercel

1. **Add New → Project** → этот репозиторий → у приложения `web` **Import single project**, **Root Directory**: `apps/web` (сборка — из [`apps/web/vercel.json`](../apps/web/vercel.json)).
2. **Settings → Environment Variables**: `VITE_API_URL` = адрес API на Render (без `/` на конце).
3. **Deployments → ⋯ → Redeploy**: адрес API зашивается в сайт при сборке, поэтому после смены переменной нужна пересборка.

## 3. Мобильное приложение

В сборке приложения укажите `EXPO_PUBLIC_API_URL` = адрес API на Render. Для теста в Expo Go: `EXPO_PUBLIC_API_URL=https://… npx expo start`.

## Демо-данные (по желанию)

Render → `happy-hours-db` → **Connect → External** → скопируйте адрес и запустите локально:
`DATABASE_URL=<адрес> npm run db:seed -w apps/api`.

## Свой домен

Сайт, например, `partner.<домен>` — в Vercel (**Settings → Domains**), API `api.<домен>` — в Render (**Settings → Custom Domains**). Затем обновите `CORS_ORIGINS`, `VITE_API_URL` (и пересоберите сайт) и `PUBLIC_URL` на Render.
