import { ChartColumn } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { partnerApi } from '../../api/endpoints';
import { BarChart } from '../../components/BarChart';
import { Empty, Field, PageHeader, QueryView, Stat } from '../../components/ui';
import { useI18n } from '../../i18n';
import { fillDays, money, num, pct, shortDate, today } from '../../lib/format';

/** FR-P09: owner statistics for a period (default: this month). */
export function StatsPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(today().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const stats = useQuery({ queryKey: ['partner', 'stats', from, to], queryFn: () => partnerApi.stats(from, to) });
  return (
    <>
      <PageHeader title={t('stats.title')} />
      <div className="filters">
        <Field label={t('common.from')}>
          <input className="input input-sm" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Field label={t('common.to')}>
          <input className="input input-sm" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </Field>
      </div>
      <QueryView query={stats}>
        {(s) => {
          const daily = fillDays(s.from, s.to, s.daily, (date) => ({ date, listed: 0, sold: 0, revenueKgs: 0 }));
          return (
          <>
            <div className="stats-grid">
              <Stat label={t('stats.revenue')} value={money(s.revenueKgs)} />
              <Stat label={t('stats.net')} value={money(s.netKgs)} sub={`${t('stats.commission')}: ${money(s.commissionKgs)}`} />
              <Stat label={t('stats.sold')} value={num(s.soldBoxes)} sub={`${t('stats.listed')}: ${num(s.listedBoxes)}`} />
              <Stat label={t('stats.sellThrough')} value={pct(s.sellThrough)} />
              <Stat label={t('stats.food')} value={`${num(s.foodKg)} ${t('common.kg')}`} />
              <Stat label={t('stats.noShows')} value={num(s.noShows)} />
              <Stat label={t('stats.rating')} value={s.rating ? `★ ${s.rating.toFixed(1)}` : '—'} sub={t('stats.ratingCount', { n: s.ratingCount })} />
              <Stat label={t('stats.cancellations')} value={num(s.cancellations)} />
            </div>
            {s.daily.length === 0 ? (
              <Empty icon={ChartColumn}>{t('stats.noData')}</Empty>
            ) : (
              <div className="grid-2 charts">
                <section className="card">
                  <h2>{t('stats.chartSold')}</h2>
                  <BarChart
                    data={daily.map((d) => ({ label: shortDate(d.date), value: d.sold, tooltip: `${shortDate(d.date)}: ${d.sold} / ${d.listed}` }))}
                  />
                </section>
                <section className="card">
                  <h2>{t('stats.chartRevenue')}</h2>
                  <BarChart
                    data={daily.map((d) => ({ label: shortDate(d.date), value: d.revenueKgs, tooltip: `${shortDate(d.date)}: ${money(d.revenueKgs)}` }))}
                    format={(n) => num(n)}
                  />
                </section>
              </div>
            )}
          </>
          );
        }}
      </QueryView>
    </>
  );
}
