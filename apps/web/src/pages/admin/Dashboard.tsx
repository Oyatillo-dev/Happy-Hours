import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { PARTNER_STATUSES } from '../../api/types';
import { BarChart } from '../../components/BarChart';
import { Field, PageHeader, PartnerStatusBadge, QueryView, Stat } from '../../components/ui';
import { useI18n } from '../../i18n';
import { addDays, fillDays, money, num, pct, shortDate, today } from '../../lib/format';

/** FR-A06: platform KPIs for a period (default: last 30 days). */
export function DashboardPage() {
  const { t } = useI18n();
  const [to, setTo] = useState(today());
  const [from, setFrom] = useState(addDays(today(), -29));
  const dash = useQuery({ queryKey: ['admin', 'dashboard', from, to], queryFn: () => adminApi.dashboard(from, to) });
  return (
    <>
      <PageHeader title={t('dash.title')} />
      <div className="filters">
        <Field label={t('common.from')}>
          <input className="input input-sm" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Field label={t('common.to')}>
          <input className="input input-sm" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </Field>
        <div className="row">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${from === addDays(to, -(n - 1)) ? 'active' : ''}`}
              onClick={() => {
                setTo(today());
                setFrom(addDays(today(), -(n - 1)));
              }}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>
      <QueryView query={dash}>
        {(d) => {
          const daily = fillDays(d.from, d.to, d.daily, (date) => ({ date, orders: 0, gmvKgs: 0, listed: 0, sold: 0 }));
          return (
          <>
            <div className="stats-grid">
              <Stat label={t('dash.gmv')} value={money(d.gmvKgs)} />
              <Stat label={t('dash.revenue')} value={money(d.revenueKgs)} />
              <Stat label={t('dash.orders')} value={num(d.orders)} />
              <Stat label={t('dash.boxes')} value={`${num(d.boxesSold)} / ${num(d.boxesListed)}`} />
              <Stat label={t('dash.sellThrough')} value={pct(d.sellThrough)} />
              <Stat label={t('dash.noShow')} value={pct(d.noShowRate)} />
              <Stat label={t('dash.repeat')} value={pct(d.repeatRate)} />
              <Stat label={t('dash.buyers')} value={num(d.buyers)} sub={`${t('dash.partnersWithSales')}: ${d.partnersWithSales}`} />
            </div>
            <div className="grid-2 charts">
              <section className="card">
                <h2>{t('dash.chartGmv')}</h2>
                <BarChart
                  data={daily.map((x) => ({ label: shortDate(x.date), value: x.gmvKgs, tooltip: `${shortDate(x.date)}: ${money(x.gmvKgs)}` }))}
                  format={(n) => num(n)}
                />
              </section>
              <section className="card">
                <h2>{t('dash.chartOrders')}</h2>
                <BarChart
                  data={daily.map((x) => ({
                    label: shortDate(x.date),
                    value: x.orders,
                    tooltip: `${shortDate(x.date)}: ${x.orders} · ${t('dash.boxes')} ${x.sold}/${x.listed}`,
                  }))}
                />
              </section>
            </div>
            <div className="grid-2">
              <section className="card">
                <h2>{t('dash.partners')}</h2>
                <ul className="kv-list">
                  {PARTNER_STATUSES.map((s) => (
                    <li key={s}>
                      <Link to={`/a/partners?status=${s}`}>
                        <PartnerStatusBadge status={s} />
                      </Link>
                      <strong>{d.partnersByStatus[s] ?? 0}</strong>
                    </li>
                  ))}
                </ul>
              </section>
              <Link to="/a/complaints" className={`card stat-link ${d.openComplaints ? 'attention' : ''}`}>
                <Stat label={t('dash.openComplaints')} value={d.openComplaints} />
              </Link>
            </div>
          </>
          );
        }}
      </QueryView>
    </>
  );
}
