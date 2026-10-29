import type { Language } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';

export function LangSwitch() {
  const { lang } = useI18n();
  const { changeLanguage } = useAuth();
  const opts: { v: Language; label: string }[] = [
    { v: 'ru', label: 'RU' },
    { v: 'ky', label: 'KY' },
  ];
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className={lang === o.v ? 'active' : ''}
          aria-pressed={lang === o.v}
          onClick={() => changeLanguage(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
