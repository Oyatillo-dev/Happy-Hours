import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../api/endpoints';
import { DateNav } from '../../components/DateNav';
import { Empty, OrderStatusBadge, PageHeader, QueryView, Stat } from '../../components/ui';
import { useI18n } from '../../i18n';
import { money, time, today } from '../../lib/format';

/** FR-P08: orders for a day (default today), auto-refreshing. */
export function OrdersPage() {
  const { t } = useI18n();
  const [date, setDate] = useState(today());
  const orders = useQuery({
    queryKey: ['partner', 'orders', date],
    queryFn: () => partnerApi.orders(date),
    select: (d) => d.items,
    refetchInterval: 30_000,
  });
  return (
    <>
      <PageHeader
        title={t('orders.title')}
        sub={t('orders.autoRefresh')}
        actions={
          <Link to="/p/issue" className="btn btn-primary">
            📷 {t('nav.issue')}
          </Link>
        }
      />
      <DateNav value={date} onChange={setDate} />
      <QueryView query={orders}>
        {(items) => {
          if (items.length === 0) return <Empty icon="🧾">{t('orders.empty')}</Empty>;
          const toIssue = items.filter((o) => o.status === 'PAID' || o.status === 'READY').length;
          const issued = items.filter((o) => o.status === 'ISSUED').length;
          return (
            <>
              <div className="stats-row">
                <Stat label={t('orderStatus.READY')} value={toIssue} />
                <Stat label={t('orderStatus.ISSUED')} value={issued} />
                <Stat label={t('orders.amount')} value={money(items.filter((o) => ['PAID', 'READY', 'ISSUED', 'NO_SHOW'].includes(o.status)).reduce((s, o) => s + o.amountKgs, 0))} />
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('orders.number')}</th>
                      <th>{t('orders.box')}</th>
                      <th>{t('orders.buyer')}</th>
                      <th>{t('orders.window')}</th>
                      <th className="num">{t('orders.amount')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">{o.number}</td>
                        <td>
                          {o.boxTitle} ×{o.quantity}
                          <div className="muted small">{o.locationName}</div>
                        </td>
                        <td>
                          {o.buyerName || '—'}
                          <div className="muted small">{t('orders.phoneTail', { tail: o.buyerPhoneTail })}</div>
                        </td>
                        <td>
                          {time(o.pickupFrom)}–{time(o.pickupTo)}
                        </td>
                        <td className="num">{money(o.amountKgs)}</td>
                        <td>
                          <OrderStatusBadge status={o.status} />
                          {o.issuedAt && <div className="muted small">{t('orders.issuedAt', { time: time(o.issuedAt) })}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </QueryView>
    </>
  );
}
