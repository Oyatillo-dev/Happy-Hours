import { Lock, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="empty-icon">
        <SearchX size={40} strokeWidth={1.6} />
      </div>
      <h1>{t('notfound.title')}</h1>
      <Link to="/">{t('common.back')}</Link>
    </div>
  );
}

export function NoAccess() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="empty-icon">
        <Lock size={40} strokeWidth={1.6} />
      </div>
      <h1>{t('noaccess.title')}</h1>
      <p>{t('noaccess.text')}</p>
    </div>
  );
}
