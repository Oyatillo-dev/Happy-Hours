import type { Language, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { pushProvider } from '../providers/push.js';

type Vars = Record<string, string | number>;
type Template = Record<Language, { title: string; body: string }>;

// Kyrgyz strings are a first draft and should be reviewed by a native speaker.
const templates = {
  order_paid: {
    ru: { title: 'Заказ оплачен', body: 'Заберите «{title}» в {place} с {from} до {to}' },
    ky: { title: 'Буйрутма төлөндү', body: '«{title}» боксун {place} жеринен {from}–{to} аралыгында алыңыз' },
  },
  pickup_reminder: {
    ru: { title: 'Скоро выдача', body: 'Через 30 минут начнётся выдача в {place}' },
    ky: { title: 'Жакында берилет', body: '30 мүнөттөн кийин {place} жеринде берүү башталат' },
  },
  order_cancelled_by_partner: {
    ru: { title: 'Заказ отменён', body: '{place} отменил заказ {number}. Деньги вернутся автоматически.' },
    ky: { title: 'Буйрутма жокко чыгарылды', body: '{place} {number} буйрутмасын жокко чыгарды. Акча автоматтык түрдө кайтарылат.' },
  },
  refund_issued: {
    ru: { title: 'Возврат оформлен', body: 'По заказу {number} возвращено {amount} сом' },
    ky: { title: 'Акча кайтарылды', body: '{number} буйрутмасы боюнча {amount} сом кайтарылды' },
  },
  favorite_new_offer: {
    ru: { title: 'Новые боксы', body: '{place}: «{title}» за {price} сом' },
    ky: { title: 'Жаңы бокстор', body: '{place}: «{title}» {price} сом' },
  },
  partner_new_order: {
    ru: { title: 'Новый заказ', body: 'Заказ {number}: «{title}», выдача {from}–{to}' },
    ky: { title: 'Жаңы буйрутма', body: '{number} буйрутма: «{title}», берүү {from}–{to}' },
  },
  partner_unpicked: {
    ru: { title: 'Незабранные заказы', body: 'В {place} не забрали заказов: {count}' },
    ky: { title: 'Алынбаган буйрутмалар', body: '{place} жеринде алынбаган буйрутмалар: {count}' },
  },
  partner_approved: {
    ru: { title: 'Заведение одобрено', body: '{place} подключено. Можно публиковать боксы.' },
    ky: { title: 'Ишкана бекитилди', body: '{place} кошулду. Бокстарды жарыялай аласыз.' },
  },
  partner_rejected: {
    ru: { title: 'Заявка отклонена', body: 'Причина: {reason}' },
    ky: { title: 'Арыз четке кагылды', body: 'Себеби: {reason}' },
  },
  partner_suspended: {
    ru: { title: 'Заведение приостановлено', body: 'Причина: {reason}' },
    ky: { title: 'Ишкана убактылуу токтотулду', body: 'Себеби: {reason}' },
  },
} satisfies Record<string, Template>;

export type NotificationType = keyof typeof templates;

const fill = (text: string, vars: Vars) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

export async function notify(
  userIds: string[],
  type: NotificationType,
  vars: Vars,
  data?: Record<string, string>,
) {
  if (!userIds.length) return;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true, language: true, pushTokens: { select: { token: true } } },
  });
  for (const user of users) {
    const t = templates[type][user.language];
    const title = fill(t.title, vars);
    const body = fill(t.body, vars);
    await prisma.notification.create({
      data: { userId: user.id, type, title, body, data: data as Prisma.InputJsonValue },
    });
    await pushProvider
      .send({ to: user.pushTokens.map((p) => p.token), title, body, data: { type, ...data } })
      .catch((err) => console.error('[push] failed', err));
  }
}

/** Owner plus staff of the given location (or all staff when location is unknown). */
export async function partnerRecipients(partnerId: string, locationId?: string) {
  const users = await prisma.user.findMany({
    where: {
      partnerId,
      deletedAt: null,
      OR: [
        { role: 'PARTNER_OWNER' },
        { role: 'PARTNER_STAFF', ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}) },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
