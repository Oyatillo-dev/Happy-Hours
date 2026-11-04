import { CircleCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import type { AdminComplaint, ComplaintStatus } from '../../api/types';
import { Empty, ErrorBox, Field, OrderStatusBadge, PageHeader, QueryView, Tabs, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateTime, money, phone } from '../../lib/format';

/** FR-A04: complaints queue. */
export function ComplaintsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<ComplaintStatus>('OPEN');
  const complaints = useQuery({ queryKey: ['admin', 'complaints', status], queryFn: () => adminApi.complaints(status), select: (d) => d.items });
  return (
    <>
      <PageHeader title={t('ac.title')} />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={(['OPEN', 'APPROVED', 'REJECTED'] as const).map((s) => ({ value: s, label: t(`complaintStatus.${s}` as DictKey) }))}
        />
      </div>
      <QueryView query={complaints}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={CircleCheck}>{t('ac.empty')}</Empty>
          ) : (
            <div className="stack">
              {items.map((c) => (
                <ComplaintCard key={c.id} complaint={c} />
              ))}
            </div>
          )
        }
      </QueryView>
    </>
  );
}

function ComplaintCard({ complaint: c }: { complaint: AdminComplaint }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [resolution, setResolution] = useState('');
  const [refund, setRefund] = useState('');
  const max = c.order.amountKgs - c.order.refundedKgs;
  const n = refund ? Number(refund) : undefined;
  const refundErr = n !== undefined && (!Number.isInteger(n) || n <= 0 || n > max) ? t('err.invalid_number') : null;
  const resErr = resolution.trim().length < 3 ? t('err.reason_short') : null;
  const resolve = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      adminApi.resolveComplaint(c.id, { decision, resolution: resolution.trim(), refundKgs: decision === 'APPROVED' ? n : undefined }),
    onSuccess: (r) => {
      toast(r.refundedKgs ? t('ao.refundDone', { amount: money(r.refundedKgs) }) : t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  return (
    <article className="card complaint">
      <div className="complaint-body">
        <div className="row-between">
          <div>
            <strong>{c.partner.brandName}</strong> ·{' '}
            <Link className="mono" to={`/a/orders/${c.order.id}`}>
              {c.order.number}
            </Link>{' '}
            <OrderStatusBadge status={c.order.status} />
          </div>
          <span className="muted small">{dateTime(c.createdAt, lang)}</span>
        </div>
        <div className="muted small">
          {c.user.name ?? '—'} · {phone(c.user.phone)}
        </div>
        <p className="complaint-text">{c.complaintText ?? c.text}</p>
        <p className="muted small">{t('ac.orderAmount', { amount: money(c.order.amountKgs), refunded: money(c.order.refundedKgs) })}</p>
        {c.resolution && <p className="alert alert-info">{t('reviews.resolution', { text: c.resolution })}</p>}
        {c.complaintStatus === 'OPEN' && (
          <div className="stack">
            <Field label={t('ac.resolution')} error={resolution && resErr ? resErr : null}>
              <textarea className="input" rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </Field>
            <Field label={t('ac.refundKgs')} error={refundErr} hint={t('ac.refundHint', { max: money(max) })}>
              <input className="input" type="number" min={1} max={max} value={refund} onChange={(e) => setRefund(e.target.value)} />
            </Field>
            {resolve.error && <ErrorBox error={resolve.error} />}
            <div className="row wrap">
              <button type="button" className="btn btn-primary" disabled={!!resErr || !!refundErr || resolve.isPending} onClick={() => resolve.mutate('APPROVED')}>
                {t('ac.approve')}
              </button>
              <button type="button" className="btn btn-danger-ghost" disabled={!!resErr || resolve.isPending} onClick={() => resolve.mutate('REJECTED')}>
                {t('ac.reject')}
              </button>
            </div>
          </div>
        )}
      </div>
      {c.photoUrl && (
        <a href={c.photoUrl} target="_blank" rel="noreferrer" className="complaint-photo">
          <img src={c.photoUrl} alt={t('ac.photo')} />
        </a>
      )}
    </article>
  );
}
