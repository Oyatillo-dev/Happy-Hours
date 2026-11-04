import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { meApi } from '../api/endpoints';
import { useI18n } from '../i18n';
import { dateTime } from '../lib/format';
import { useToast } from './ui';

const POLL_MS = 30_000;

/** Polls GET /me/notifications every 30 s; a new partner order refreshes orders and offers. */
export function NotificationsBell() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const seenAt = useRef<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: meApi.notifications,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });
  const markRead = useMutation({
    mutationFn: () => meApi.markRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;

  useEffect(() => {
    const newest = items[0];
    if (!newest) return;
    const since = seenAt.current;
    seenAt.current = newest.createdAt;
    if (since === null) return; // first load: nothing is "new"
    const fresh = items.filter((n) => n.createdAt > since);
    const order = fresh.find((n) => n.type === 'partner_new_order');
    if (order) {
      void qc.invalidateQueries({ queryKey: ['partner', 'orders'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'offers'] });
      toast(`${t('notif.newOrder')} ${order.body}`, 'info');
    }
    if (fresh.some((n) => n.type.startsWith('partner_'))) {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'profile'] });
    }
  }, [items, qc, t, toast]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="bell" ref={panel}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('notif.title')}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={22} aria-hidden />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <strong>{t('notif.title')}</strong>
            {unread > 0 && (
              <button type="button" className="link" onClick={() => markRead.mutate()}>
                {t('notif.markAll')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="muted pad">{t('notif.empty')}</div>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? '' : 'unread'}>
                  <div className="bell-title">{n.title}</div>
                  <div>{n.body}</div>
                  <div className="muted small">{dateTime(n.createdAt, lang)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
