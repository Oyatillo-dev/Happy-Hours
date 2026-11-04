import { Store } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { PARTNER_STATUSES, type PartnerStatus } from '../../api/types';
import { Empty, PageHeader, PartnerStatusBadge, QueryView, Tabs } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateOnly, phone } from '../../lib/format';
import { Pager } from './Pager';

const LIMIT = 25;

/** FR-A01: partner moderation list. */
export function PartnersPage() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as PartnerStatus | '';
  const q = params.get('q') ?? '';
  const offset = Number(params.get('offset') ?? 0);
  const [search, setSearch] = useState(q);

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    setParams(p, { replace: true });
  };

  const partners = useQuery({
    queryKey: ['admin', 'partners', { status, q, offset }],
    queryFn: () => adminApi.partners({ status: status || undefined, q: q || undefined, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title={t('ap.title')} />
      <div className="filters">
        <Tabs
          value={status}
          onChange={(v) => update({ status: v, offset: '' })}
          options={[{ value: '' as const, label: t('common.all') }, ...PARTNER_STATUSES.map((s) => ({ value: s, label: t(`partnerStatus.${s}` as DictKey) }))]}
        />
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim(), offset: '' });
          }}
        >
          <input className="input input-sm" value={search} placeholder={t('ap.searchPh')} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-sm">{t('common.search')}</button>
        </form>
      </div>
      <QueryView query={partners}>
        {(data) =>
          data.items.length === 0 ? (
            <Empty icon={Store}>{t('ap.empty')}</Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>{t('apply.brandName')}</th>
                      <th>{t('apply.category')}</th>
                      <th>{t('ap.owner')}</th>
                      <th className="num">{t('ap.locations')}</th>
                      <th className="num">{t('ap.commissionPct')}</th>
                      <th>{t('ap.created')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/a/partners/${p.id}`}>
                            <strong>{p.brandName}</strong>
                          </Link>
                          <div className="muted small">
                            {p.legalName} · {t('ap.inn')} {p.inn}
                          </div>
                        </td>
                        <td>{t(`partnerCategory.${p.category}` as DictKey)}</td>
                        <td>
                          {p.users[0]?.name ?? '—'}
                          <div className="muted small">{phone(p.users[0]?.phone ?? p.contactPhone)}</div>
                        </td>
                        <td className="num">{p.locations.length}</td>
                        <td className="num">{p.commissionPct}%</td>
                        <td>{dateOnly(p.createdAt, lang)}</td>
                        <td>
                          <PartnerStatusBadge status={p.status} />
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
