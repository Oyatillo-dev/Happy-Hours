import { CalendarClock, ChartColumn, Hourglass, MapPin, Package, ReceiptText, ScanLine, Settings, ShoppingBag, Star, Users, Wallet } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Shell, type NavItem } from '../../components/Layout';
import { useI18n, type DictKey } from '../../i18n';
import { NotFound } from '../NotFound';
import { IssuePage } from './Issue';
import { LocationsPage } from './Locations';
import { OffersPage } from './Offers';
import { OrdersPage } from './Orders';
import { PayoutsPage } from './Payouts';
import { ProfilePage } from './Profile';
import { ReviewsPage } from './Reviews';
import { SchedulesPage } from './Schedules';
import { StaffPage } from './Staff';
import { StatsPage } from './Stats';
import { ApplyPage } from '../Apply';
import { StatusPage } from './Status';
import { TemplatesPage } from './Templates';
import { usePartner } from './hooks';

/** Partner cabinet for PARTNER_OWNER and PARTNER_STAFF. Owner-only sections are hidden for staff. */
export function PartnerApp() {
  const { t } = useI18n();
  const { me, isOwner } = useAuth();
  const partner = usePartner();
  const status = partner.data?.status ?? me?.partner?.status;
  const active = status === 'ACTIVE';

  const nav: NavItem[] = [
    ...(!active && status ? [{ to: '/p/status', label: 'nav.status' as const, icon: Hourglass }] : []),
    { to: '/p/offers', label: 'nav.offers', short: 'offers.title', icon: ShoppingBag, primary: true },
    { to: '/p/issue', label: 'nav.issue', icon: ScanLine, primary: true },
    { to: '/p/orders', label: 'nav.orders', icon: ReceiptText, primary: true },
    { to: '/p/reviews', label: 'nav.reviews', icon: Star },
    ...(isOwner
      ? ([
          { to: '/p/templates', label: 'nav.templates', icon: Package },
          { to: '/p/schedules', label: 'nav.schedules', icon: CalendarClock },
          { to: '/p/locations', label: 'nav.locations', icon: MapPin },
          { to: '/p/staff', label: 'nav.staff', icon: Users },
          { to: '/p/stats', label: 'nav.stats', icon: ChartColumn },
          { to: '/p/payouts', label: 'nav.payouts', icon: Wallet },
          { to: '/p/profile', label: 'nav.profile', icon: Settings },
        ] satisfies NavItem[])
      : []),
  ];

  const banner =
    status && !active ? (
      <div className={`status-banner status-${status.toLowerCase()}`}>
        {t('status.banner', { status: t(`partnerStatus.${status}` as DictKey) })}
        {partner.data?.rejectReason ? ` ${t('status.reason', { reason: partner.data.rejectReason })}` : ''}
      </div>
    ) : null;

  const owner = (el: JSX.Element) => (isOwner ? el : <Navigate to="/p/offers" replace />);
  const home = status && !active ? '/p/status' : '/p/offers';

  return (
    <Routes>
      <Route element={<Shell title="app.partnerCabinet" nav={nav} banner={banner} />}>
        <Route index element={<Navigate to={home} replace />} />
        <Route path="status" element={<StatusPage />} />
        <Route
          path="reapply"
          element={owner(
            partner.data?.status === 'REJECTED' ? <ApplyPage rejected={partner.data} /> : <Navigate to="/p/status" replace />,
          )}
        />
        <Route path="offers" element={<OffersPage />} />
        <Route path="issue" element={<IssuePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="templates" element={owner(<TemplatesPage />)} />
        <Route path="schedules" element={owner(<SchedulesPage />)} />
        <Route path="locations" element={owner(<LocationsPage />)} />
        <Route path="staff" element={owner(<StaffPage />)} />
        <Route path="stats" element={owner(<StatsPage />)} />
        <Route path="payouts" element={owner(<PayoutsPage />)} />
        <Route path="profile" element={owner(<ProfilePage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
