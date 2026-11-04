# Sakta — мобильное приложение покупателя

Expo (SDK 58) + expo-router + TypeScript + React Query. Приложение **не входит** в npm workspaces корня — у него свой `package.json` и свой `node_modules`.

## Запуск

```bash
cd apps/mobile
npm install
cp .env.example .env        # укажите адрес API
npx expo start              # QR-код → Expo Go на телефоне
```

API должен быть запущен (`cd apps/api && npx tsx src/server.ts`, проверка: `curl localhost:4000/health`).

### Адрес API и LAN IP

- `EXPO_PUBLIC_API_URL` — адрес `apps/api`, по умолчанию `http://localhost:4000`.
- На **реальном телефоне** `localhost` — это сам телефон. Укажите IP компьютера в локальной сети: `EXPO_PUBLIC_API_URL=http://192.168.1.10:4000`. Телефон и компьютер должны быть в одной Wi‑Fi сети.
- Эмулятор Android: `http://10.0.2.2:4000`.
- API строит ссылки на оплату и фото из своего `PUBLIC_URL`. Лучше запускать API с `PUBLIC_URL=http://<LAN IP>:4000`; приложение на всякий случай переписывает ссылки `http://localhost…` на `EXPO_PUBLIC_API_URL`.
- После изменения `.env` перезапустите `npx expo start` (переменные `EXPO_PUBLIC_*` встраиваются при сборке бандла).

### Вход

Вход по номеру и SMS-коду. В dev-режиме API возвращает код в ответе, и приложение показывает подсказку «Код для теста: 1234» — SMS не нужна. Демо-покупатель: `+996 700 000 010`. Лимит — 5 запросов кода в час на номер.

## Оплата (мок)

После «Забронировать» бокс резервируется на 10 минут, и открывается платёжная страница (`payUrl`) через `expo-web-browser` (`openAuthSessionAsync(payUrl, 'happyhours://')`). В dev это тестовая страница банка из `apps/api` (`/mock-pay/:ref`) с кнопками «Оплатить» / «Отказаться»; она ведёт обратно в приложение по ссылке `happyhours://orders/{id}`. Приложение опрашивает `GET /orders/:id`, пока статус не сменится с `PENDING_PAYMENT`, и показывает QR-код и 6-значный код выдачи. Повторная оплата — кнопка «Открыть оплату снова» (`POST /orders/:id/pay`).

## Push-уведомления

- Токен Expo запрашивается после входа и отправляется в `POST /me/push-tokens`. Отказ в разрешении не ломает приложение — уведомления всё равно видны в профиле («Уведомления»).
- **Expo Go на Android не поддерживает remote push** (с SDK 53), в Expo Go на iOS токен может не выдаваться без EAS. Для настоящих токенов нужна dev-сборка (`npx expo run:android` / `eas build --profile development`) и EAS projectId: `EXPO_PUBLIC_EAS_PROJECT_ID=<id>` в `.env` (или `extra.eas.projectId`).
- На стороне API включите `PUSH_PROVIDER=expo`.
- Нажатие на уведомление с `data.orderId` открывает экран заказа.

## Карта

`react-native-maps` работает в Expo Go. Для собственной Android-сборки нужен ключ Google Maps: `GOOGLE_MAPS_ANDROID_API_KEY` в `.env` (подхватывается в `app.config.ts`). Если доступ к геолокации запрещён — карта и лента центрируются на Бишкеке.

## Офлайн

Каждый полученный заказ сохраняется в AsyncStorage. Без сети экран заказа показывает QR и код из кэша с плашкой «Нет соединения».

## Проверки

```bash
npx tsc --noEmit                      # типы
npx expo-doctor                       # конфигурация и версии
npx expo export --platform android    # сборка бандла
npx expo export --platform web        # веб-версия (карта заменена списком)
```

## Структура

- `src/app/` — экраны (expo-router): вкладки `(tabs)/` (Рядом, Карта, Заказы, Профиль), `offer/[id]`, `orders/[id]`, `partner/[id]`, `complaint/[id]`, `login`, `notifications`, `favorites`.
- `src/api/` — клиент API (токены, обновление по 401), типы DTO, хуки React Query.
- `src/i18n/` — словари `ru.ts` и `ky.ts` (кыргызский требует вычитки носителем языка).
- `src/lib/` — форматирование времени (UTC+6) и денег, геолокация, push, кэш заказов, маршрут в 2GIS.
- `src/components/` — карточки, фильтры, карта (`OffersMap.tsx` / `OffersMap.web.tsx`).
