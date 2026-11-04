import { UserRound } from 'lucide-react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import type { AdminUser, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Empty, ErrorBox, PageHeader, QueryView, useToast } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { dateOnly, phone } from '../../lib/format';
import { Pager } from './Pager';

const LIMIT = 50;
const ASSIGNABLE = ['BUYER', 'SUPPORT', 'ADMIN'] as const;
type Assignable = (typeof ASSIGNABLE)[number];

/** Users search + role change (ADMIN only). */
export function UsersPage() {
  const { t, lang } = useI18n();
  const { isAdmin, me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const users = useQuery({
    queryKey: ['admin', 'users', q, offset],
    queryFn: () => adminApi.users({ q: q || undefined, limit: LIMIT, offset }),
    select: (d) => d.items,
    placeholderData: keepPreviousData,
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Assignable }) => adminApi.setRole(id, role),
    onSuccess: () => {
      toast(t('au.roleChanged'));
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
  const editable = (u: AdminUser) => isAdmin && !u.partnerId && !u.deletedAt && u.id !== me?.id && (ASSIGNABLE as readonly Role[]).includes(u.role);

  return (
    <>
      <PageHeader title={t('au.title')} />
      <div className="filters">
        <form
          className="search grow"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setQ(search.trim());
          }}
        >
          <input className="input" value={search} placeholder={t('au.searchPh')} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn">{t('common.search')}</button>
        </form>
      </div>
      {setRole.error && <ErrorBox error={setRole.error} />}
      <QueryView query={users}>
        {(items) =>
          items.length === 0 ? (
            <Empty icon={UserRound}>{t('au.empty')}</Empty>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.name')}</th>
                      <th>{t('common.phone')}</th>
                      <th>{t('au.role')}</th>
                      <th>{t('au.registered')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => (
                      <tr key={u.id} className={u.deletedAt ? 'row-muted' : ''}>
                        <td>
                          {u.name ?? '—'} {u.deletedAt && <Badge>{t('au.deleted')}</Badge>}
                        </td>
                        <td className="mono">{phone(u.phone)}</td>
                        <td>
                          {editable(u) ? (
                            <select
                              className="input input-sm"
                              value={u.role}
                              disabled={setRole.isPending}
                              onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as Assignable })}
                            >
                              {ASSIGNABLE.map((r) => (
                                <option key={r} value={r}>
                                  {t(`role.${r}` as DictKey)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <Badge tone={u.role === 'ADMIN' || u.role === 'SUPPORT' ? 'blue' : 'gray'}>{t(`role.${u.role}` as DictKey)}</Badge>
                              {u.partnerId && (
                                <div className="small">
                                  <Link to={`/a/partners/${u.partnerId}`}>{t('au.partnerRoleHint')}</Link>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td>{dateOnly(u.createdAt, lang)}</td>
                      </tr>
                    ))}
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
