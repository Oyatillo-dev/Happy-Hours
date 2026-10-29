import { rules } from '../config.js';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { notify, partnerRecipients } from './notifications.js';

/** Recomputes a partner's rating and applies FR-A04 auto-pause. */
export async function refreshPartnerRating(partnerId: string) {
  const agg = await prisma.review.aggregate({
    where: { partnerId, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const rating = agg._avg.rating ? Math.round(agg._avg.rating * 100) / 100 : null;
  const partner = await prisma.partner.update({
    where: { id: partnerId },
    data: { rating, ratingCount: agg._count.rating },
  });

  if (
    partner.status === 'ACTIVE' &&
    rating !== null &&
    agg._count.rating >= rules.autoPauseMinReviews &&
    rating < rules.autoPauseRating
  ) {
    const reason = `rating ${rating} < ${rules.autoPauseRating}`;
    await prisma.partner.update({ where: { id: partnerId }, data: { status: 'SUSPENDED' } });
    await audit('partner.auto_suspend', 'Partner', partnerId, null, { rating, reviews: agg._count.rating });
    await notify(await partnerRecipients(partnerId), 'partner_suspended', { reason });
  }
  return rating;
}
