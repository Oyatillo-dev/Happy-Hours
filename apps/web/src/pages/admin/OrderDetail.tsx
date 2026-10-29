import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { Badge, ErrorBox, Field, OrderStatusBadge, PageHeader, QueryView, Stars, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateTime, money, phone, time } from '../../lib/format';

/** FR-A03: order detail with payments, history and manual refund. */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const order = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => adminApi.order(id) });
  return (
    <QueryView query={order}>
      {(o) => {
        const refundable = ['ISSUED', 'NO_SHOW', 'REFUNDED'].includes(o.status) && o.amountKgs - o.refundedKgs > 0;
        return (
          <>
            <Link to="/a/orders" className="back-link">
              ‹ {t('ao.title')}
            </Link>
            <PageHeader
              title={
                <>
                  <span className="mono">{o.number}</span> <OrderStatusBadge status={o.status} />
                </>
              }
              sub={`${o.offer.location.partner.brandName} · ${o.offer.location.name}`}
            />
            <div className="grid-2 align-start">
              <section className="card">
                <dl className="dl">
                  <dt>{t('orders.box')}</dt>
                  <dd>
                    {o.offer.template.title} ×{o.quantity}
                  </dd>
                  <dt>{t('orders.window')}</dt>
                  <dd>
                    {o.offer.date} · {time(o.offer.pickupFrom)}–{time(o.offer.pickupTo)}
                  </dd>
                  <dt>{t('orders.buyer')}</dt>
                  <dd>
                    {o.user.name ?? '—'} · {phone(o.user.phone)}
                  </dd>
                  <dt>{t('orders.amount')}</dt>
                  <dd>{money(o.amountKgs)}</dd>
                  <dt>{t('ao.commission')}</dt>
                  <dd>{money(o.commissionKgs)}</dd>
                  <dt>{t('ao.refunded')}</dt>
                  <dd>{money(o.refundedKgs)}</dd>
                  <dt>{t('ao.pickupCode')}</dt>
                  <dd className="mono">{o.pickupCode}</dd>
                  <dt>{t('ao.created')}</dt>
                  <dd>{dateTime(o.createdAt, lang)}</dd>
                  <dt>{t('ao.paidAt')}</dt>
                  <dd>{dateTime(o.paidAt, lang)}</dd>
                  <dt>{t('ao.issuedAt')}</dt>
                  <dd>{dateTime(o.issuedAt, lang)}</dd>
                  {o.cancelReason && (
                    <>
                      <dt>{t('ao.cancelReason')}</dt>
                      <dd>{o.cancelReason}</dd>
                    </>
                  )}
                </dl>
                <Link to={`/a/partners/${o.offer.location.partner.id}`}>{o.offer.location.partner.brandName} ›</Link>
              </section>
              <div className="stack">
                {refundable ? (
                  <RefundForm orderId={o.id} max={o.amountKgs - o.refundedKgs} />
                ) : (
                  <p className="alert alert-info">{t('ao.refundNotAllowed')}</p>
                )}
                {o.review && (
                  <section className="card">
                    <h2>{t('ao.review')}</h2>
                    <div className="row">
                      <Stars value={o.review.rating} />
                      {o.review.isComplaint && <Badge tone="red">{t('reviews.complaint')}</Badge>}
                      {o.review.complaintStatus && <Badge>{t(`complaintStatus.${o.review.complaintStatus}` as DictKey)}</Badge>}
                    </div>
                    {o.review.text && <p>{o.review.text}</p>}
                    {o.review.complaintText && <p className="complaint-text">{o.review.complaintText}</p>}
                    {o.review.photoUrl && <img className="review-photo" src={o.review.photoUrl} alt="" />}
                    {o.review.resolution && <p className="muted small">{t('reviews.resolution', { text: o.review.resolution })}</p>}
                  </section>
                )}
              </div>
            </div>
            <section className="card">
              <h2>{t('ao.payments')}</h2>
              {o.payments.length === 0 ? (
                <p className="muted">{t('common.empty')}</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('ao.provider')}</th>
                        <th>ID</th>
                        <th className="num">{t('orders.amount')}</th>
                        <th className="num">{t('ao.refunded')}</th>
                        <th>{t('common.status')}</th>
                        <th>{t('common.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.provider}</td>
                          <td className="mono small">{p.providerRef}</td>
                          <td className="num">{money(p.amountKgs)}</td>
                          <td className="num">{money(p.refundedKgs)}</td>
                          <td>{t(`paymentStatus.${p.status}` as DictKey)}</td>
                          <td>{dateTime(p.createdAt, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card">
              <h2>{t('ao.history')}</h2>
              {o.history.length === 0 ? (
                <p className="muted">{t('audit.empty')}</p>
              ) : (
                <ul className="plain-list">
                  {o.history.map((h) => (
                    <li key={h.id}>
                      <span className="muted small">{dateTime(h.createdAt, lang)}</span> <strong>{h.action}</strong>{' '}
                      <code className="small">{JSON.stringify(h.data)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        );
      }}
    </QueryView>
  );
}

function RefundForm({ orderId, max }: { orderId: string; max: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const n = amount ? Number(amount) : undefined;
  const amountErr = n !== undefined && (!Number.isInteger(n) || n <= 0 || n > max) ? t('err.invalid_number') : null;
  const reasonErr = reason.trim().length < 3 ? t('err.reason_short') : null;
  const refund = useMutation({
    mutationFn: () => adminApi.refund(orderId, { amountKgs: n, reason: reason.trim() }),
    onSuccess: (r) => {
      toast(t('ao.refundDone', { amount: money(r.refundedKgs) }));
      setAmount('');
      setReason('');
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  return (
    <section className="card stack">
      <h2>{t('ao.refund')}</h2>
      <Field label={t('ao.refundAmount')} error={amountErr} hint={t('ao.refundAmountHint', { max: money(max) })}>
        <input className="input" type="number" min={1} max={max} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label={t('common.reason')} error={reason && reasonErr ? reasonErr : null}>
        <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {refund.error && <ErrorBox error={refund.error} />}
      <button type="button" className="btn btn-danger" disabled={!!amountErr || !!reasonErr || refund.isPending} onClick={() => refund.mutate()}>
        {t('ao.refund')}
      </button>
    </section>
  );
}
