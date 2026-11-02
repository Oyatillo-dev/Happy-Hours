import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { paymentProvider, signPayload } from '../providers/payments.js';
import { handlePaymentEvent } from '../services/orders.js';

const page = (title: string, body: string) => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#f4f6f3;margin:0;display:grid;place-items:center;min-height:100vh;color:#1d2a1f}
  .card{background:#fff;border-radius:16px;padding:28px;max-width:360px;width:calc(100% - 32px);box-shadow:0 4px 24px #0001}
  h1{font-size:20px;margin:0 0 4px} p{color:#5b6b5e;margin:4px 0 20px} .sum{font-size:32px;font-weight:700;margin:8px 0 20px}
  button,a.btn{display:block;width:100%;padding:14px;border-radius:12px;border:0;font-size:16px;font-weight:600;margin-top:10px;text-align:center;text-decoration:none;cursor:pointer}
  .pay{background:#1f8a4c;color:#fff} .fail{background:#eef1ee;color:#1d2a1f} .note{font-size:12px;color:#8a978c;margin-top:16px}
</style></head><body><div class="card">${body}</div></body></html>`;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Where the "back to the app" button leads. The app passes its own deep link
 * (exp://…/--/orders/{id} in Expo Go, happyhours://orders/{id} in a build); only
 * app schemes are accepted so this page cannot bounce buyers to another website.
 */
function returnUrl(query: unknown, orderId: string) {
  const value = (query as { return?: unknown } | undefined)?.return;
  if (typeof value === 'string' && /^(happyhours|exps?):\/\//.test(value) && value.length < 500) return value;
  return `happyhours://orders/${orderId}`;
}

/** Button back to the app, plus an automatic return so the buyer does not have to tap. */
const backToApp = (url: string, auto: boolean) =>
  `<a class="btn pay" href="${escape(url)}">Вернуться в приложение</a>` +
  (auto ? `<script>setTimeout(function(){location.replace(${JSON.stringify(url).replace(/</g, '\\u003c')})},1500)</script>` : '');

export async function paymentRoutes(app: FastifyInstance) {
  // Webhook from the acquirer. Signature is verified over the raw body.
  app.post('/payments/webhook/:provider', async (request) => {
    const { provider } = parse(z.object({ provider: z.string() }), request.params);
    if (provider !== paymentProvider.name) throw notFound('provider');
    const event = paymentProvider.parseWebhook(request.headers, request.rawBody ?? '');
    if (!event) throw new AppError('invalid_signature', 401);
    return handlePaymentEvent(event);
  });

  if (config.PAYMENT_PROVIDER !== 'mock') return;

  // ---- mock acquirer pages (development only) ----
  app.get('/mock-pay/:ref', async (request, reply) => {
    const { ref } = parse(z.object({ ref: z.string() }), request.params);
    const payment = await prisma.payment.findUnique({ where: { providerRef: ref }, include: { order: true } });
    if (!payment) throw notFound('payment');
    const back = returnUrl(request.query, payment.orderId);
    const body =
      payment.status === 'PENDING'
        ? `<h1>Оплата заказа ${escape(payment.order.number)}</h1><p>Тестовая платёжная страница (ELQR / карта)</p>
           <div class="sum">${payment.amountKgs} сом</div>
           <form method="post"><button class="pay" name="action" value="pay">Оплатить</button>
           <button class="fail" name="action" value="fail">Отказаться</button></form>
           <div class="note">В продакшене здесь будет страница банка-эквайера.</div>`
        : `<h1>Платёж уже обработан</h1><p>Статус: ${payment.status}</p>
           ${backToApp(back, false)}`;
    return reply.type('text/html').send(page('Оплата', body));
  });

  app.post('/mock-pay/:ref', async (request, reply) => {
    const { ref } = parse(z.object({ ref: z.string() }), request.params);
    const { action } = parse(z.object({ action: z.enum(['pay', 'fail']) }), request.body);
    const raw = JSON.stringify({ providerRef: ref, status: action === 'pay' ? 'SUCCEEDED' : 'FAILED' });
    // Go through the same path a real webhook takes, signature included.
    const event = paymentProvider.parseWebhook({ 'x-signature': signPayload(raw) }, raw);
    if (!event) throw new AppError('invalid_signature', 401);
    const result = await handlePaymentEvent(event);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { providerRef: ref } });
    const ok = action === 'pay' && !('refunded' in result && result.refunded);
    const body = ok
      ? `<h1>Оплачено</h1><p>${payment.amountKgs} сом. Код выдачи — в приложении.</p>`
      : action === 'pay'
        ? `<h1>Бронь истекла</h1><p>Деньги возвращены. Попробуйте оформить заказ заново.</p>`
        : `<h1>Оплата отменена</h1><p>Можно попробовать ещё раз из приложения.</p>`;
    return reply
      .type('text/html')
      .send(page('Оплата', `${body}${backToApp(returnUrl(request.query, payment.orderId), ok)}`));
  });
}
