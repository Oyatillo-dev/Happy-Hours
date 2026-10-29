import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { QueryView } from '../../components/ui';
import { useI18n, type DictKey } from '../../i18n';
import { usePartner } from './hooks';

/** Status screen for PENDING / REJECTED / SUSPENDED partners. */
export function StatusPage() {
  const { t } = useI18n();
  const { isOwner } = useAuth();
  const partner = usePartner();
  return (
    <QueryView query={partner}>
      {(p) => {
        const icon = p.status === 'PENDING' ? '⏳' : p.status === 'ACTIVE' ? '✅' : '⛔';
        return (
          <div className="status-screen card">
            <div className="status-icon" aria-hidden>
              {icon}
            </div>
            <h1>{p.status === 'ACTIVE' ? p.brandName : t(`status.${p.status}.title` as DictKey)}</h1>
            {p.status !== 'ACTIVE' && <p>{t(`status.${p.status}.text` as DictKey)}</p>}
            {p.rejectReason && <p className="alert alert-error">{t('status.reason', { reason: p.rejectReason })}</p>}
            <p className="muted">{t('status.contact')}</p>
            <div className="row wrap center">
              <Link className="btn" to="/p/offers">
                {t('nav.offers')}
              </Link>
              {isOwner && (
                <>
                  <Link className="btn" to="/p/templates">
                    {t('nav.templates')}
                  </Link>
                  <Link className="btn" to="/p/locations">
                    {t('nav.locations')}
                  </Link>
                </>
              )}
            </div>
          </div>
        );
      }}
    </QueryView>
  );
}
