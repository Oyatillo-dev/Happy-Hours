import type { FastifyBaseLogger } from 'fastify';
import { localDate, localTime, weekday } from '../lib/time.js';
import { generateScheduledOffers } from '../services/offers.js';
import { expireReservations, markNoShows, markReady, retryRefunds, sendPickupReminders } from '../services/orders.js';
import { computeLastWeekPayouts } from '../services/payouts.js';

/**
 * Runs once a minute in the API process. All steps are idempotent, so running
 * a second API instance is safe (it only does redundant work).
 */
export async function tick(now = new Date()) {
  const result = {
    expired: await expireReservations(now),
    ready: await markReady(now),
    reminders: await sendPickupReminders(now),
    noShows: await markNoShows(now),
    refunds: await retryRefunds(now),
    scheduled: 0,
    payouts: 0,
  };
  const time = localTime(now);
  // Hourly top-up of offers from schedules (covers restarts and schedules created during the day).
  if (time.endsWith(':05')) result.scheduled = await generateScheduledOffers(localDate(now));
  // Payouts for the previous week are settled on Tuesday 01:00, after all
  // 24-hour complaint windows of Sunday's orders have closed.
  if (weekday(localDate(now)) === 2 && time === '01:00') {
    result.payouts = (await computeLastWeekPayouts(now)).length;
  }
  return result;
}

export function startScheduler(log: FastifyBaseLogger) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const r = await tick();
      if (Object.values(r).some((n) => n > 0)) log.info({ jobs: r }, 'scheduler tick');
    } catch (err) {
      log.error(err, 'scheduler tick failed');
    } finally {
      running = false;
    }
  };
  generateScheduledOffers().catch((err) => log.error(err, 'initial schedule generation failed'));
  const timer = setInterval(run, 60_000);
  return () => clearInterval(timer);
}
