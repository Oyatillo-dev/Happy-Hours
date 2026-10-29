# Happy Hours API

Базовый URL в разработке: `http://localhost:4000`. Все ответы — JSON. Ошибки:

```json
{ "error": { "code": "sold_out", "message": "sold_out", "details": null } }
```

Клиенты переводят `code` на русский и кыргызский. Деньги — целые сомы, время — ISO UTC (`pickupFrom`, `pickupTo`), даты предложений — местные `YYYY-MM-DD` (Бишкек, UTC+6).

Авторизация: `Authorization: Bearer <accessToken>`. Access-токен живёт 30 минут, refresh-токен 30 дней и меняется при каждом обновлении.

Роли: `BUYER`, `PARTNER_OWNER`, `PARTNER_STAFF`, `SUPPORT`, `ADMIN`.

## Авторизация (FR-B01)

| Метод | Путь | Тело | Ответ |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | `{ phone }` | `{ ok, phone, devCode? }` — `devCode` только при `SMS_PROVIDER=console` вне production |
| POST | `/auth/otp/verify` | `{ phone, code, name?, language? }` | `{ accessToken, refreshToken, user, isNew }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | `{ ok }` |

Лимиты: 5 кодов в час на номер, 5 попыток на код, код живёт 5 минут.

## Профиль

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/me` | текущий пользователь, роль, партнёр |
| PATCH | `/me` | `{ name?, language? }` |
| DELETE | `/me` | удаление аккаунта (NFR-06) |
| POST | `/me/push-tokens` | `{ token, platform: ios\|android\|web }` |
| GET | `/me/notifications` | `{ items, unread }` |
| POST | `/me/notifications/read` | `{ ids? }` — без `ids` отмечает все |
| GET | `/me/impact` | `{ boxes, foodKg, savedKgs, co2Kg }` (FR-B11) |

## Покупатель

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/offers` | лента боксов на сегодня (FR-B02). Параметры: `lat, lng, radiusKm, category, maxPrice, pickupAfter, pickupBefore (HH:mm), q, favorites, includeSoldOut, sort=distance\|price\|pickup` |
| GET | `/offers/:id` | карточка бокса (FR-B03) |
| GET | `/partners/:id` | заведение: точки, боксы на сегодня, отзывы |
| POST | `/orders` | `{ offerId, quantity 1–3 }` → заказ `PENDING_PAYMENT` с `payUrl`, бронь 10 минут (FR-B04) |
| GET | `/orders?scope=active\|history\|all` | мои заказы |
| GET | `/orders/:id` | заказ; `pickupCode` и `qrToken` есть только у оплаченных (FR-B06) |
| POST | `/orders/:id/pay` | новая ссылка на оплату, если бронь ещё действует |
| POST | `/orders/:id/cancel` | отмена: неоплаченный — всегда, оплаченный — за 2+ часа до окна (FR-B07) |
| POST | `/orders/:id/review` | `{ rating 1–5, text }` после выдачи (FR-B10) |
| POST | `/orders/:id/complaint` | `{ text, photoUrl? }` в течение 24 часов (FR-B10) |
| GET | `/favorites` | избранные заведения (FR-B09) |
| PUT / DELETE | `/favorites/:partnerId` | добавить / убрать |
| POST | `/uploads` | multipart, поле `file` (jpeg/png/webp ≤ 5 МБ) → `{ url }` |

### Статусы заказа

```
PENDING_PAYMENT ──оплата──▶ PAID ──начало окна──▶ READY ──QR/код──▶ ISSUED ──жалоба одобрена──▶ REFUNDED
      │                      │  └──партнёр отменил──▶ CANCELLED_BY_PARTNER (возврат)
      │                      └──покупатель, за 2+ ч──▶ CANCELLED_BY_BUYER (возврат)
      ├──10 мин без оплаты──▶ EXPIRED
      └──покупатель отменил──▶ CANCELLED_BY_BUYER
READY ──окно закрылось──▶ NO_SHOW (без возврата)
```

## Оплата

| Метод | Путь | Назначение |
| --- | --- | --- |
| POST | `/payments/webhook/:provider` | вебхук эквайера; подпись HMAC-SHA256 сырого тела в заголовке `x-signature` |
| GET / POST | `/mock-pay/:ref` | тестовая страница банка (только `PAYMENT_PROVIDER=mock`) |

Вебхуки идемпотентны (FR-R06): повторное уведомление ничего не меняет. Если деньги пришли после истечения брони, платёж автоматически возвращается.

## Партнёр

Владелец (`PARTNER_OWNER`) — всё; сотрудник (`PARTNER_STAFF`) — только боксы, заказы, выдача и отзывы своей точки.

| Метод | Путь | Кто | Назначение |
| --- | --- | --- | --- |
| POST | `/partner/apply` | BUYER | заявка (FR-P01) |
| GET / PATCH | `/partner` | все / владелец | профиль, реквизиты |
| GET / POST / PATCH | `/partner/locations[/:id]` | все / владелец | точки (FR-P02) |
| GET / POST / DELETE | `/partner/staff[/:id]` | владелец | сотрудники (FR-P02) |
| GET / POST / PATCH | `/partner/templates[/:id]` | все / владелец | шаблоны боксов (FR-P03) |
| GET / POST / PATCH / DELETE | `/partner/schedules[/:id]` | все / владелец | расписания по дням недели (FR-P04) |
| GET | `/partner/offers?date=` | все | боксы на дату |
| POST | `/partner/offers` | все | опубликовать (FR-P04) |
| PATCH | `/partner/offers/:id` | все | `{ quantity }` (FR-P05) |
| POST | `/partner/offers/:id/cancel` | все | `{ reason }` — отмена с возвратами (FR-P06) |
| GET | `/partner/orders?date=` | все | заказы на дату (FR-P08) |
| POST | `/partner/orders/issue` | все | `{ qrToken }` или `{ code }` (FR-P07) |
| GET | `/partner/stats?from&to` | владелец | статистика (FR-P09) |
| GET | `/partner/payouts` | владелец | выплаты (FR-P10) |
| GET | `/partner/reviews` | все | отзывы и жалобы |

## Администрирование

`SUPPORT` и `ADMIN`; действия с пометкой «A» — только `ADMIN`.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/admin/dashboard?from&to` | GMV, выручка, заказы, доля продаж, неявки, повторные покупки (FR-A06) |
| GET | `/admin/partners?status&q` | список партнёров |
| GET | `/admin/partners/:id` | карточка партнёра |
| POST | `/admin/partners/:id/approve` A | `{ commissionPct?, promoMonths? }` (FR-A01, FR-A02) |
| POST | `/admin/partners/:id/reject` A | `{ reason }` |
| POST | `/admin/partners/:id/suspend` A | `{ reason }` |
| POST | `/admin/partners/:id/reactivate` A | |
| PATCH | `/admin/partners/:id/commission` A | `{ commissionPct, promoUntil? }` |
| GET | `/admin/orders?q&status&partnerId` | поиск по номеру или телефону (FR-A03) |
| GET | `/admin/orders/:id` | заказ, платежи, история |
| POST | `/admin/orders/:id/refund` | `{ amountKgs?, reason }` |
| GET | `/admin/complaints?status` | очередь жалоб (FR-A04) |
| POST | `/admin/complaints/:id/resolve` | `{ decision: APPROVED\|REJECTED, resolution, refundKgs? }` |
| GET | `/admin/payouts?periodFrom` | выплаты за неделю (FR-A05) |
| POST | `/admin/payouts/compute` A | `{ periodFrom }` — понедельник |
| GET | `/admin/payouts/export?periodFrom` | CSV для банка |
| POST | `/admin/payouts/:id/mark-paid` A | |
| GET | `/admin/users?q` | поиск пользователей |
| PATCH | `/admin/users/:id/role` A | `{ role: BUYER\|SUPPORT\|ADMIN }` |
| GET | `/admin/audit?entity&entityId` | журнал действий (FR-A08) |

## Фоновые задачи

Раз в минуту в процессе API (`src/jobs/scheduler.ts`):

- снимает неоплаченные брони старше 10 минут;
- переводит оплаченные заказы в `READY` в начале окна;
- шлёт напоминание за 30 минут до окна;
- отмечает `NO_SHOW` через 15 минут после конца окна и сообщает партнёру;
- каждый час в :05 создаёт боксы из расписаний;
- во вторник в 01:00 формирует выплаты за прошлую неделю — после того как закрылись 24-часовые окна жалоб на воскресные заказы.
