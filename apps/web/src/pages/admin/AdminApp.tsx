import { LayoutDashboard, ReceiptText, ScrollText, Store, TriangleAlert, UserRound, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import { Shell, type NavItem } from '../../components/Layout';
import { NotFound } from '../NotFound';
import { AuditPage } from './Audit';
import { ComplaintsPage } from './Complaints';
import { DashboardPage } from './Dashboard';
import { OrderDetailPage } from './OrderDetail';
import { OrdersPage } from './Orders';
import { PartnerDetailPage } from './PartnerDetail';
import { PartnersPage } from './Partners';
import { PayoutsPage } from './Payouts';
import { UsersPage } from './Users';

/** Admin / support panel (roles SUPPORT, ADMIN). ADMIN-only actions are disabled for SUPPORT. */
export function AdminApp() {
  const complaints = useQuery({
    queryKey: ['admin', 'complaints', 'OPEN'],
    queryFn: () => adminApi.complaints('OPEN'),
    refetchInterval: 60_000,
  });
  const pending = useQuery({
    queryKey: ['admin', 'partners', { status: 'PENDING', q: '', offset: 0 }],
    queryFn: () => adminApi.partners({ status: 'PENDING', limit: 50, offset: 0 }),
    refetchInterval: 60_000,
  });
  const count = (n?: number) => (n ? <span className="nav-count">{n}</span> : null);

  const nav: NavItem[] = [
    { to: '/a/dashboard', label: 'nav.dashboard', icon: LayoutDashboard, primary: true },
    { to: '/a/partners', label: 'nav.partners', icon: Store, primary: true, badge: count(pending.data?.total) },
    { to: '/a/orders', label: 'nav.adminOrders', icon: ReceiptText, primary: true },
    { to: '/a/complaints', label: 'nav.complaints', icon: TriangleAlert, badge: count(complaints.data?.items.length) },
    { to: '/a/payouts', label: 'nav.adminPayouts', icon: Wallet },
    { to: '/a/users', label: 'nav.users', icon: UserRound },
    { to: '/a/audit', label: 'nav.audit', icon: ScrollText },
  ];
  return (
    <Routes>
      <Route element={<Shell title="app.adminPanel" nav={nav} />}>
        <Route index element={<Navigate to="/a/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="partners/:id" element={<PartnerDetailPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
