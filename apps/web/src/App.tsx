import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ErrorBox, Spinner } from './components/ui';
import { useI18n } from './i18n';
import { AdminApp } from './pages/admin/AdminApp';
import { ApplyPage } from './pages/Apply';
import { LoginPage } from './pages/Login';
import { PartnerApp } from './pages/partner/PartnerApp';

export function App() {
  const { t } = useI18n();
  const { isAuthenticated, me, meLoading, meError, logout } = useAuth();

  if (!isAuthenticated) return <LoginPage />;
  if (meLoading) return <Spinner />;
  if (!me) {
    return (
      <div className="content narrow">
        <ErrorBox error={meError} onRetry={() => window.location.reload()} />
        <button type="button" className="btn" onClick={() => void logout()}>
          {t('auth.logout')}
        </button>
      </div>
    );
  }

  if (me.role === 'BUYER') return <ApplyPage />;

  const isPartner = me.role === 'PARTNER_OWNER' || me.role === 'PARTNER_STAFF';
  const home = isPartner ? '/p' : '/a';
  return (
    <Routes>
      {isPartner ? <Route path="/p/*" element={<PartnerApp />} /> : <Route path="/a/*" element={<AdminApp />} />}
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
