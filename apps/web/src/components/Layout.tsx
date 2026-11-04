import { Menu, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n, type DictKey } from '../i18n';
import { phone } from '../lib/format';
import { InstallPrompt } from './InstallPrompt';
import { LangSwitch } from './LangSwitch';
import { NotificationsBell } from './NotificationsBell';

export interface NavItem {
  to: string;
  label: DictKey;
  /** Shorter label for the phone bottom bar */
  short?: DictKey;
  icon: LucideIcon;
  /** Show in the phone bottom bar */
  primary?: boolean;
  badge?: ReactNode;
}

export function Shell({ title, nav, banner }: { title: DictKey; nav: NavItem[]; banner?: ReactNode }) {
  const { t } = useI18n();
  const { me, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const primary = nav.filter((n) => n.primary);

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} />
          <div>
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-sub">{me?.partner?.brandName ?? t(title)}</div>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <n.icon className="nav-icon" size={20} strokeWidth={1.9} aria-hidden />
              <span>{t(n.label)}</span>
              {n.badge}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small">
            <div>{me?.name}</div>
            <div className="muted">
              {phone(me?.phone)} · {me ? t(`role.${me.role}` as DictKey) : ''}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
            {t('auth.logout')}
          </button>
        </div>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label={t('nav.menu')} onClick={() => setMenuOpen(true)}>
            <Menu size={22} aria-hidden />
          </button>
          <div className="topbar-title">{me?.partner?.brandName ?? t(title)}</div>
          <div className="topbar-right">
            <LangSwitch />
            <NotificationsBell />
          </div>
        </header>
        {banner}
        <main className="content">
          <InstallPrompt />
          <Outlet />
        </main>
      </div>

      {primary.length > 0 && (
        <nav className="bottombar">
          {primary.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}>
              <n.icon className="bottom-icon" size={27} strokeWidth={1.9} aria-hidden />
              <span>{t(n.short ?? n.label)}</span>
            </NavLink>
          ))}
          <button type="button" className="bottom-link" onClick={() => setMenuOpen(true)}>
            <Menu className="bottom-icon" size={27} strokeWidth={1.9} aria-hidden />
            <span>{t('nav.menu')}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
