import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LangSwitch } from '../components/LangSwitch';
import { useI18n } from '../i18n';
import { phone } from '../lib/format';
import { ApplyPage } from './Apply';

/**
 * A buyer who signs in to the partner cabinet: explain that boxes are bought in the
 * app, and open the partner application only when they actually want to sell.
 */
export function BuyerHome() {
  const { t } = useI18n();
  const { me, logout } = useAuth();
  const [applying, setApplying] = useState(false);

  if (applying) return <ApplyPage />;

  return (
    <div className="apply-page">
      <header className="topbar topbar-plain">
        <div className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <div className="brand-name">{t('app.name')}</div>
        </div>
        <div className="topbar-right">
          <LangSwitch />
        </div>
      </header>
      <main className="content narrow">
        <div className="status-screen card">
          <img src="/icon.svg" alt="" width={72} height={72} />
          <h1>{t('buyer.title')}</h1>
          <p className="muted">{t('buyer.text', { phone: phone(me?.phone) })}</p>
          <div className="row wrap center">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setApplying(true)}>
              {t('buyer.apply')}
            </button>
            <button type="button" className="btn btn-lg" onClick={() => void logout()}>
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
