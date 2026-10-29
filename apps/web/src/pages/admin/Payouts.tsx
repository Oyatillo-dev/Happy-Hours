import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import type { AdminPayout } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorBox, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n } from '../../i18n';
import { addDays, dateOnly, localDateLabel, money, today, weekStart } from '../../lib/format';

/** FR-A05: weekly payouts — compute, export CSV for the bank, mark paid. */
export function PayoutsPage() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [week, setWeek] = useState(addDays(weekStart(today()), -7));
  const payouts = useQuery({ queryKey: ['admin', 'payouts', week], queryFn: () => adminApi.payouts(week), select: (d) => d.items });

  const compute = useMutation({
    mutationFn: () => adminApi.computePayouts(week),
    onSuccess: (r) => {
      toast(t('apay.computed', { n: r.items.length }));
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts', week] });
    },
  });
  const exportCsv = useMutation({ mutationFn: () => adminApi.exportPayouts(week) });
  const markPaid = useMutation({
    mutationFn: (p: AdminPayout) => adminApi.markPaid(p.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'payouts', week] }),
  });

  return (
    <>
      <PageHeader
        title={t('apay.title')}
        sub={t('payouts.subtitle')}
        actions={
          <>
            {isAdmin && (
              <button type="button" className="btn btn-primary" disabled={compute.isPending} onClick={() => compute.mutate()}>
                {compute.isPending ? t('common.loading') : t('apay.compute')}
              </button>
            )}
            <button type="button" className="btn" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
              ⬇ {t('apay.export')}
            </button>
          </>
        }
      />
      <div className="date-nav">
        <button type="button" className="btn btn-sm" onClick={() => setWeek(addDays(week, -7))} aria-label={t('common.prev')}>
          ‹
        </button>
        <input
          className="input input-sm"
          type="date"
          value={week}
          onChange={(e) => e.target.value && setWeek(weekStart(e.target.value))}
          aria-label={t('apay.week')}
        />
        <span className="small">
          {localDateLabel(week)} – {localDateLabel(addDays(week, 6))}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setWeek(addDays(week, 7))} aria-label={t('common.next')}>
          ›
        </button>
      </div>
      {[compute.error, exportCsv.error, markPaid.error].filter(Boolean).map((e, i) => (
        <ErrorBox key={i} error={e} />
      ))}
      <QueryView query={payouts}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon="💸">{t('apay.empty')}</Empty>
          ) : (
            <>
              <p>
                <strong>{t('apay.totalNet', { amount: money(items.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.netKgs, 0)) })}</strong>
              </p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('ao.partner')}</th>
                      <th>{t('ap.bank')}</th>
                      <th className="num">{t('payouts.orders')}</th>
                      <th className="num">{t('payouts.gross')}</th>
                      <th className="num">{t('payouts.commission')}</th>
                      <th className="num">{t('payouts.refunds')}</th>
                      <th className="num">{t('payouts.net')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/a/partners/${p.partnerId}`}>{p.partner.brandName}</Link>
                        </td>
                        <td>
                          {p.partner.bankName}
                          <div className="mono small muted">{p.partner.bankAccount}</div>
                        </td>
                        <td className="num">{p.orders}</td>
                        <td className="num">{money(p.grossKgs)}</td>
                        <td className="num">{money(p.commission)}</td>
                        <td className="num">{money(p.refundsKgs)}</td>
                        <td className="num">
                          <strong>{money(p.netKgs)}</strong>
                        </td>
                        <td>
                          {p.status === 'PAID' ? (
                            <Badge tone="green">{t('payouts.paidAt', { date: dateOnly(p.paidAt, lang) })}</Badge>
                          ) : isAdmin ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={markPaid.isPending}
                              onClick={() =>
                                window.confirm(t('apay.markPaidConfirm', { amount: money(p.netKgs), name: p.partner.brandName })) && markPaid.mutate(p)
                              }
                            >
                              {t('apay.markPaid')}
                            </button>
                          ) : (
                            <Badge tone="yellow">{t('payoutStatus.PENDING')}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }
      </QueryView>
    </>
  );
}
