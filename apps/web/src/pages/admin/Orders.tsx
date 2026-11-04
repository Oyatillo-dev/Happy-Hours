import { SearchX } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { ORDER_STATUSES, type OrderStatus } from '../../api/types';
import { Empty, OrderStatusBadge, PageHeader, QueryView } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateTime, money, phone } from '../../lib/format';
import { Pager } from './Pager';

const LIMIT = 25;

/** FR-A03: order search by number or buyer phone. */
export function OrdersPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (params.get('status') ?? '') as OrderStatus | '';
  const partnerId = params.get('partnerId') ?? '';
  const refunds = params.get('refunds') === 'pending' ? 'pending' : undefined;
  const offset = Number(params.get('offset') ?? 0);
  const [search, setSearch] = useState(q);
  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };
  const orders = useQuery({
    queryKey: ['admin', 'orders', { q, status, partnerId, refunds, offset }],
    queryFn: () =>
      adminApi.orders({ q: q || undefined, status: status || undefined, partnerId: partnerId || undefined, refunds, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('ao.title')} />
      <div className="filters">
        <form
          className="search grow"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim(), offset: '' });
          }}
        >
          <input className="input" value={search} placeholder={t('ao.searchPh')} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn">{t('common.search')}</button>
        </form>
        <select className="input input-sm" value={status} onChange={(e) => update({ status: e.target.value, offset: '' })}>
          <option value="">{t('common.all')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`orderStatus.${s}` as DictKey)}
            </option>
          ))}
        </select>
        {refunds && (
          <button type="button" className="chip active" onClick={() => update({ refunds: '', offset: '' })}>
            {t('ao.pendingRefundsFilter')} ✕
          </button>
        )}
        {partnerId && (
          <button type="button" className="chip active" onClick={() => update({ partnerId: '', offset: '' })}>
            {orders.data?.items[0]?.offer.location.partner.brandName ?? t('ao.partner')} ✕
          </button>
        )}
      </div>
      <QueryView query={orders}>
        {(data) =>
          data.items.length === 0 ? (
            <Empty icon={SearchX}>{t('ao.empty')}</Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>{t('orders.number')}</th>
                      <th>{t('ao.partner')}</th>
                      <th>{t('orders.box')}</th>
                      <th>{t('orders.buyer')}</th>
                      <th className="num">{t('orders.amount')}</th>
                      <th>{t('ao.created')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link className="mono" to={`/a/orders/${o.id}`}>
                            {o.number}
                          </Link>
                        </td>
                        <td>
                          {o.offer.location.partner.brandName}
                          <div className="muted small">{o.offer.location.name}</div>
                        </td>
                        <td>
                          {o.offer.template.title} ×{o.quantity}
                        </td>
                        <td>
                          {o.user.name ?? '—'}
                          <div className="muted small">{phone(o.user.phone)}</div>
                        </td>
                        <td className="num">
                          {money(o.amountKgs)}
                          {o.refundedKgs > 0 && <div className="muted small">−{money(o.refundedKgs)}</div>}
                        </td>
                        <td>{dateTime(o.createdAt, lang)}</td>
                        <td>
                          <OrderStatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager offset={offset} limit={LIMIT} total={data.total} count={data.items.length} onChange={(o) => update({ offset: o ? String(o) : '' })} />
            </>
          )
        }
      </QueryView>
    </>
  );
}
