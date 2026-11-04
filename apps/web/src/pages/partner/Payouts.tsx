import { Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { partnerApi } from '../../api/endpoints';
import { Badge, Empty, PageHeader, QueryView } from '../../components/ui';
import { useI18n } from '../../i18n';
import { dateOnly, localDateLabel, money } from '../../lib/format';

/** FR-P10: weekly payouts. */
export function PayoutsPage() {
  const { t, lang } = useI18n();
  const payouts = useQuery({ queryKey: ['partner', 'payouts'], queryFn: partnerApi.payouts, select: (d) => d.items });
  return (
    <>
      <PageHeader title={t('payouts.title')} sub={t('payouts.subtitle')} />
      <QueryView query={payouts}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={Wallet}>{t('payouts.empty')}</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('payouts.period')}</th>
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
                        {localDateLabel(p.periodFrom)} – {localDateLabel(p.periodTo)}
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
                        ) : (
                          <Badge tone="yellow">{t('payoutStatus.PENDING')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryView>
    </>
  );
}
