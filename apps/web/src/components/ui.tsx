import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Inbox, X, type LucideIcon } from 'lucide-react';
import { useI18n, type DictKey } from '../i18n';
import type { OrderStatus, PartnerStatus } from '../api/types';

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, errorText } = useI18n();
  return (
    <div className="alert alert-error" role="alert">
      <span>{errorText(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Empty({ children, icon: Icon = Inbox }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        <Icon size={40} strokeWidth={1.6} />
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Renders loading / error / content for a react-query result. */
export function QueryView<T>({
  query,
  children,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <Spinner />;
  if (query.error) return <ErrorBox error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className ?? ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'blue';

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const orderTone: Record<OrderStatus, Tone> = {
  PENDING_PAYMENT: 'yellow',
  EXPIRED: 'gray',
  PAID: 'blue',
  READY: 'blue',
  ISSUED: 'green',
  NO_SHOW: 'red',
  CANCELLED_BY_BUYER: 'gray',
  CANCELLED_BY_PARTNER: 'gray',
  REFUNDED: 'yellow',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return <Badge tone={orderTone[status]}>{t(`orderStatus.${status}` as DictKey)}</Badge>;
}

const partnerTone: Record<PartnerStatus, Tone> = { PENDING: 'yellow', ACTIVE: 'green', REJECTED: 'red', SUSPENDED: 'red' };

export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  const { t } = useI18n();
  return <Badge tone={partnerTone[status]}>{t(`partnerStatus.${status}` as DictKey)}</Badge>;
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, actions, sub }: { title: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (value === null) return null;
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} / 5`}>
      {'★'.repeat(full)}
      <span className="stars-off">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

// ---------- toasts ----------

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}
const ToastContext = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, text, tone }]);
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast-${i.tone}`}>
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Two-option segmented control. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`tab ${o.value === value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
