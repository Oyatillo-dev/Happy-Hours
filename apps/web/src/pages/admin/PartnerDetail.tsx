import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import type { AdminPartnerDetail } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Badge, ErrorBox, Field, Modal, PageHeader, PartnerStatusBadge, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateOnly, localDateLabel, money, phone, today } from '../../lib/format';

type Action = 'approve' | 'reject' | 'suspend' | 'commission';

/** FR-A01 / FR-A02: partner detail with moderation actions. */
export function PartnerDetailPage() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const partner = useQuery({ queryKey: ['admin', 'partner', id], queryFn: () => adminApi.partner(id) });
  const [action, setAction] = useState<Action | null>(null);
  const reactivate = useMutation({
    mutationFn: () => adminApi.reactivate(id),
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <QueryView query={partner}>
      {(p) => (
        <>
          <Link to="/a/partners" className="back-link">
            ‹ {t('ap.title')}
          </Link>
          <PageHeader
            title={
              <>
                {p.brandName} <PartnerStatusBadge status={p.status} />
              </>
            }
            sub={`${p.legalName} · ${t(`partnerCategory.${p.category}` as DictKey)}`}
            actions={
              isAdmin ? (
                <>
                  {p.status === 'PENDING' && (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => setAction('approve')}>
                        {t('ap.approve')}
                      </button>
                      <button type="button" className="btn btn-danger-ghost" onClick={() => setAction('reject')}>
                        {t('ap.reject')}
                      </button>
                    </>
                  )}
                  {p.status === 'REJECTED' && (
                    <button type="button" className="btn btn-primary" onClick={() => setAction('approve')}>
                      {t('ap.approve')}
                    </button>
                  )}
                  {p.status === 'ACTIVE' && (
                    <button type="button" className="btn btn-danger-ghost" onClick={() => setAction('suspend')}>
                      {t('ap.suspend')}
                    </button>
                  )}
                  {p.status === 'SUSPENDED' && (
                    <button type="button" className="btn btn-primary" disabled={reactivate.isPending} onClick={() => reactivate.mutate()}>
                      {t('ap.reactivate')}
                    </button>
                  )}
                  <button type="button" className="btn" onClick={() => setAction('commission')}>
                    {t('ap.editCommission')}
                  </button>
                </>
              ) : (
                <span className="muted small">{t('ap.adminOnly')}</span>
              )
            }
          />
          {reactivate.error && <ErrorBox error={reactivate.error} />}
          {p.rejectReason && <p className="alert alert-error">{t('status.reason', { reason: p.rejectReason })}</p>}

          <div className="grid-2 align-start">
            <section className="card">
              <dl className="dl">
                <dt>{t('ap.inn')}</dt>
                <dd className="mono">{p.inn}</dd>
                <dt>{t('ap.contact')}</dt>
                <dd>{phone(p.contactPhone)}</dd>
                <dt>{t('ap.bank')}</dt>
                <dd>
                  {p.bankName} · <span className="mono">{p.bankAccount}</span>
                </dd>
                <dt>{t('ap.commissionPct')}</dt>
                <dd>{p.commissionPct}%</dd>
                <dt>{t('ap.promoUntil')}</dt>
                <dd>{p.promoUntil ? dateOnly(p.promoUntil, lang) : t('ap.noPromo')}</dd>
                <dt>{t('ap.rating')}</dt>
                <dd>{p.rating ? `★ ${p.rating.toFixed(1)} (${p.ratingCount})` : '—'}</dd>
                <dt>{t('ap.cancellations')}</dt>
                <dd>{p.cancellationsCount}</dd>
                <dt>{t('ap.created')}</dt>
                <dd>{dateOnly(p.createdAt, lang)}</dd>
              </dl>
              <Link to={`/a/orders?partnerId=${p.id}`}>{t('ap.ordersLink')} ›</Link>
            </section>
            <section className="card">
              <h2>{t('ap.users')}</h2>
              <ul className="plain-list">
                {p.users.map((u) => (
                  <li key={u.id}>
                    {u.name ?? '—'} · {phone(u.phone)} <Badge>{t(`role.${u.role}` as DictKey)}</Badge>
                    {u.locationId && <span className="muted small"> · {p.locations.find((l) => l.id === u.locationId)?.name}</span>}
                  </li>
                ))}
              </ul>
              <h2>{t('ap.locations')}</h2>
              <ul className="plain-list">
                {p.locations.map((l) => (
                  <li key={l.id}>
                    <strong>{l.name}</strong> — {l.address} · {l.openTime}–{l.closeTime}{' '}
                    {!l.active && <Badge>{t('common.inactive')}</Badge>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <h2>{t('ap.templates')}</h2>
            {p.templates.length === 0 ? (
              <p className="muted">{t('common.empty')}</p>
            ) : (
              <ul className="plain-list">
                {p.templates.map((x) => (
                  <li key={x.id}>
                    {x.title} — {money(x.priceKgs)} / {money(x.valueKgs)} · {t(`boxCategory.${x.category}` as DictKey)}{' '}
                    {!x.active && <Badge>{t('common.inactive')}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>{t('ap.payouts')}</h2>
            {p.payouts.length === 0 ? (
              <p className="muted">{t('payouts.empty')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('payouts.period')}</th>
                      <th className="num">{t('payouts.orders')}</th>
                      <th className="num">{t('payouts.net')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.payouts.map((x) => (
                      <tr key={x.id}>
                        <td>
                          {localDateLabel(x.periodFrom)} – {localDateLabel(x.periodTo)}
                        </td>
                        <td className="num">{x.orders}</td>
                        <td className="num">{money(x.netKgs)}</td>
                        <td>
                          <Badge tone={x.status === 'PAID' ? 'green' : 'yellow'}>{t(`payoutStatus.${x.status}`)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {action && <ActionModal partner={p} action={action} onClose={() => setAction(null)} />}
        </>
      )}
    </QueryView>
  );
}

function ActionModal({ partner, action, onClose }: { partner: AdminPartnerDetail; action: Action; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [commission, setCommission] = useState(String(partner.commissionPct));
  const [promoMonths, setPromoMonths] = useState('3');
  const [promoUntil, setPromoUntil] = useState(partner.promoUntil ? today(new Date(partner.promoUntil)) : '');
  const [reason, setReason] = useState('');

  const pct = Number(commission);
  const months = Number(promoMonths);
  const pctErr = !Number.isInteger(pct) || pct < 0 || pct > 50 ? t('err.invalid_number') : null;
  const monthsErr = !Number.isInteger(months) || months < 0 || months > 12 ? t('err.invalid_number') : null;
  const reasonErr = reason.trim().length < 3 ? t('err.reason_short') : null;

  const run = useMutation({
    mutationFn: async () => {
      if (action === 'approve') return adminApi.approve(partner.id, { commissionPct: pct, promoMonths: months });
      if (action === 'reject') return adminApi.reject(partner.id, reason.trim());
      if (action === 'suspend') return adminApi.suspend(partner.id, reason.trim());
      return adminApi.commission(partner.id, {
        commissionPct: pct,
        promoUntil: promoUntil ? new Date(`${promoUntil}T23:59:59+06:00`).toISOString() : null,
      });
    },
    onSuccess: () => {
      toast(t('common.saved'));
      void qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
  });

  const invalid =
    action === 'approve' ? !!(pctErr || monthsErr) : action === 'commission' ? !!pctErr : !!reasonErr;

  const title =
    action === 'approve'
      ? t('ap.approveTitle', { name: partner.brandName })
      : action === 'reject'
        ? t('ap.rejectTitle', { name: partner.brandName })
        : action === 'suspend'
          ? t('ap.suspendTitle', { name: partner.brandName })
          : t('ap.editCommission');

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${action === 'reject' || action === 'suspend' ? 'btn-danger' : 'btn-primary'}`}
            disabled={invalid || run.isPending}
            onClick={() => run.mutate()}
          >
            {t('common.confirm')}
          </button>
        </>
      }
    >
      <div className="stack">
        {(action === 'approve' || action === 'commission') && (
          <Field label={t('ap.commissionPct')} error={pctErr}>
            <input className="input" type="number" min={0} max={50} value={commission} onChange={(e) => setCommission(e.target.value)} />
          </Field>
        )}
        {action === 'approve' && (
          <Field label={t('ap.promoMonths')} error={monthsErr}>
            <input className="input" type="number" min={0} max={12} value={promoMonths} onChange={(e) => setPromoMonths(e.target.value)} />
          </Field>
        )}
        {action === 'commission' && (
          <Field label={t('ap.promoUntil')} hint={t('common.optional')}>
            <input className="input" type="date" value={promoUntil} onChange={(e) => setPromoUntil(e.target.value)} />
          </Field>
        )}
        {(action === 'reject' || action === 'suspend') && (
          <Field label={t('common.reason')} error={reason ? reasonErr : null}>
            <textarea className="input" rows={3} value={reason} placeholder={t('ap.reasonPh')} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        {run.error && <ErrorBox error={run.error} />}
      </div>
    </Modal>
  );
}
