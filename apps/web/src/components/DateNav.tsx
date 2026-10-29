import { useI18n } from '../i18n';
import { addDays, today } from '../lib/format';

export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const { t } = useI18n();
  const now = today();
  return (
    <div className="date-nav">
      <button type="button" className="btn btn-sm" onClick={() => onChange(addDays(value, -1))} aria-label={t('common.prev')}>
        ‹
      </button>
      <input className="input input-sm" type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      <button type="button" className="btn btn-sm" onClick={() => onChange(addDays(value, 1))} aria-label={t('common.next')}>
        ›
      </button>
      {value !== now && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(now)}>
          {t('common.today')}
        </button>
      )}
    </div>
  );
}
