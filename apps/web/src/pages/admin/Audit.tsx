import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import type { AuditEntry } from '../../api/types';
import { Empty, Field, PageHeader, QueryView } from '../../components/ui';
import { useI18n } from '../../i18n';
import { dateTime } from '../../lib/format';
import { Pager } from './Pager';

const LIMIT = 50;
const ENTITIES = ['', 'Partner', 'Order', 'Payout', 'User', 'BoxOffer'];

function entityLink(e: AuditEntry) {
  if (e.entity === 'Partner') return `/a/partners/${e.entityId}`;
  if (e.entity === 'Order') return `/a/orders/${e.entityId}`;
  if (e.entity === 'Payout' && /^\d{4}-\d{2}-\d{2}$/.test(e.entityId)) return `/a/payouts`;
  return null;
}

/** FR-A08: audit log viewer. */
export function AuditPage() {
  const { t, lang } = useI18n();
  const [entity, setEntity] = useState('');
  const [entityId, setEntityId] = useState('');
  const [offset, setOffset] = useState(0);
  const audit = useQuery({
    queryKey: ['admin', 'audit', entity, entityId, offset],
    queryFn: () => adminApi.audit({ entity: entity || undefined, entityId: entityId.trim() || undefined, limit: LIMIT, offset }),
    select: (d) => d.items,
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('audit.title')} />
      <div className="filters">
        <Field label={t('audit.entity')}>
          <select
            className="input input-sm"
            value={entity}
            onChange={(e) => {
              setOffset(0);
              setEntity(e.target.value);
            }}
          >
            {ENTITIES.map((x) => (
              <option key={x} value={x}>
                {x || t('common.all')}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('audit.entityId')}>
          <input
            className="input input-sm"
            value={entityId}
            onChange={(e) => {
              setOffset(0);
              setEntityId(e.target.value);
            }}
          />
        </Field>
      </div>
      <QueryView query={audit}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon="📜">{t('audit.empty')}</Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('audit.action')}</th>
                      <th>{t('audit.entity')}</th>
                      <th>{t('audit.actor')}</th>
                      <th>{t('audit.data')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => {
                      const link = entityLink(e);
                      return (
                        <tr key={e.id}>
                          <td className="nowrap">{dateTime(e.createdAt, lang)}</td>
                          <td>
                            <strong>{e.action}</strong>
                          </td>
                          <td>
                            {e.entity}{' '}
                            {link ? (
                              <Link className="mono small" to={link}>
                                {e.entityId}
                              </Link>
                            ) : (
                              <span className="mono small">{e.entityId}</span>
                            )}
                          </td>
                          <td className="mono small">{e.actorId ?? t('audit.system')}</td>
                          <td>
                            <code className="small json">{e.data ? JSON.stringify(e.data) : ''}</code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager offset={offset} limit={LIMIT} count={items.length} onChange={setOffset} />
            </>
          )
        }
      </QueryView>
    </>
  );
}
