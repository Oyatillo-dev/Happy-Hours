import { prisma } from '../db.js';
import { addDays, localDate, weekStart } from '../lib/time.js';

/**
 * FR-R05: weekly settlement for Monday…Sunday (local dates of the offers).
 * Partners are paid for issued and not-collected boxes; complaint refunds are
 * deducted, and the platform gives back its commission on refunded money.
 */
export async function computePayouts(periodFrom: string) {
  const periodTo = addDays(periodFrom, 6);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['ISSUED', 'NO_SHOW', 'REFUNDED'] },
      offer: { date: { gte: periodFrom, lte: periodTo } },
    },
    select: {
      amountKgs: true,
      commissionKgs: true,
      refundedKgs: true,
      offer: { select: { location: { select: { partnerId: true } } } },
    },
  });

  const totals = new Map<string, { orders: number; gross: number; commission: number; refunds: number; net: number }>();
  for (const o of orders) {
    const partnerId = o.offer.location.partnerId;
    const t = totals.get(partnerId) ?? { orders: 0, gross: 0, commission: 0, refunds: 0, net: 0 };
    const kept = o.amountKgs - o.refundedKgs;
    const commission = o.amountKgs ? Math.round((o.commissionKgs * kept) / o.amountKgs) : 0;
    t.orders += 1;
    t.gross += o.amountKgs;
    t.refunds += o.refundedKgs;
    t.commission += commission;
    t.net += kept - commission;
    totals.set(partnerId, t);
  }

  const results = [];
  for (const [partnerId, t] of totals) {
    const existing = await prisma.payout.findUnique({
      where: { partnerId_periodFrom: { partnerId, periodFrom } },
    });
    if (existing?.status === 'PAID') {
      results.push(existing);
      continue;
    }
    const data = {
      periodTo,
      orders: t.orders,
      grossKgs: t.gross,
      commission: t.commission,
      refundsKgs: t.refunds,
      netKgs: t.net,
    };
    results.push(
      await prisma.payout.upsert({
        where: { partnerId_periodFrom: { partnerId, periodFrom } },
        create: { partnerId, periodFrom, ...data },
        update: data,
      }),
    );
  }
  return results;
}

/** Settles the previous full week. */
export function computeLastWeekPayouts(now = new Date()) {
  return computePayouts(addDays(weekStart(localDate(now)), -7));
}

/** Payment file for the bank (FR-A05): one CSV row per pending payout. */
export async function payoutsCsv(periodFrom: string) {
  const payouts = await prisma.payout.findMany({
    where: { periodFrom },
    include: { partner: true },
    orderBy: { partner: { brandName: 'asc' } },
  });
  // Text a partner typed (e.g. a brand name starting with "=") would run as a formula in
  // Excel; a leading apostrophe makes the spreadsheet treat it as plain text.
  const esc = (v: string | number) => {
    const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [
    ['partner', 'legal_name', 'inn', 'bank', 'account', 'period_from', 'period_to', 'orders', 'gross', 'commission', 'refunds', 'net', 'status'],
    ...payouts.map((p) => [
      p.partner.brandName,
      p.partner.legalName,
      p.partner.inn,
      p.partner.bankName,
      p.partner.bankAccount,
      p.periodFrom,
      p.periodTo,
      p.orders,
      p.grossKgs,
      p.commission,
      p.refundsKgs,
      p.netKgs,
      p.status,
    ]),
  ];
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
