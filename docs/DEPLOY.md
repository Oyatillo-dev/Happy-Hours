# Выкладка: API на Railway, кабинет на Vercel

API — постоянно работающий сервер: раз в минуту он снимает просроченные брони, отмечает неявки, повторяет возвраты. Поэтому он живёт на Railway вместе с базой, а кабинет партнёра и админка — статический сайт на Vercel.

## 1. API и база на Railway

1. **New Project → Deploy from GitHub repo** → этот репозиторий. Railway возьмёт [`railway.json`](../railway.json) и соберёт [`apps/api/Dockerfile`](../apps/api/Dockerfile). Миграции базы применяются при каждом запуске.
2. **New → Database → PostgreSQL** в том же проекте.
3. Сервису API: **Settings → Volumes → Add volume**, путь `/app/apps/api/uploads` — иначе фото боксов и жалоб пропадут при каждом обновлении.
4. **Settings → Networking → Generate domain** — получите адрес вида `https://happy-hours-api.up.railway.app`.
5. **Variables** сервиса API:

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (ссылка на базу из шага 2) |
| `PUBLIC_URL` | адрес API из шага 4 |
| `JWT_SECRET` | случайная строка 32+ символов (`openssl rand -hex 32`) |
| `PAYMENT_WEBHOOK_SECRET` | ещё одна случайная строка 32+ символов |
| `ADMIN_PHONES` | телефоны админов через запятую, например `+996700000001` |
| `CORS_ORIGINS` | адрес сайта на Vercel (шаг 2 ниже), например `https://happy-hours.vercel.app` |
| `TRUST_PROXY` | `1` |
| `PUSH_PROVIDER` | `expo` |

Пока нет банка и Nikita.kg, это **тестовый сервер**, и нужно ещё:

| Переменная | Значение | Зачем |
| --- | --- | --- |
| `ALLOW_MOCK_PAYMENTS` | `true` | тестовая страница оплаты, без денег |
| `SHOW_OTP_CODES` | `true` | код входа показывается на экране, SMS не отправляются |

Без них API в режиме `production` не запустится и скажет почему. **Перед запуском для настоящих клиентов** эти две переменные удаляются, а вместо них подключаются банк и SMS.

Демо-данные (необязательно): **API → ⋯ → Shell** → `npx tsx prisma/seed.ts` не сработает в боевом образе; вместо этого локально: `DATABASE_URL=<публичный адрес базы из Railway> npm run db:seed -w apps/api`.

## 2. Кабинет и админка на Vercel

1. **Add New → Project** → этот репозиторий → у приложения `web` нажмите **Import single project** (не «multi-service»).
2. **Root Directory**: `apps/web`. Сборку Vercel возьмёт из [`apps/web/vercel.json`](../apps/web/vercel.json).
3. **Environment Variables**: `VITE_API_URL` = адрес API из Railway (без `/` на конце).
4. **Deploy**. Адрес сайта впишите в `CORS_ORIGINS` на Railway (через запятую, если адресов несколько, например ещё свой домен).

## 3. Мобильное приложение

В сборке приложения укажите `EXPO_PUBLIC_API_URL` = адрес API из Railway. Для теста в Expo Go: `EXPO_PUBLIC_API_URL=https://… npx expo start`.

## Свой домен

Когда появится домен: сайт, например, `partner.<домен>` — в Vercel (**Settings → Domains**), API `api.<домен>` — в Railway (**Networking → Custom domain**). Затем обновите `PUBLIC_URL`, `CORS_ORIGINS` и `VITE_API_URL`.
