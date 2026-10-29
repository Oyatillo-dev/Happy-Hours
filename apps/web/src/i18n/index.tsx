import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import type { Language } from '../api/types';
import { ky } from './ky';
import { ru, type Dict, type DictKey } from './ru';

export type { DictKey };

const dictionaries: Record<Language, Dict> = { ru, ky };
const STORAGE_KEY = 'hh.lang';

export type Vars = Record<string, string | number | null | undefined>;
export type TFn = (key: DictKey, vars?: Vars) => string;

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

export function storedLanguage(): Language | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ru' || v === 'ky' ? v : null;
  } catch {
    return null;
  }
}

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TFn;
  /** Translates any thrown error (ApiError codes, client validation keys). */
  errorText: (err: unknown) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => storedLanguage() ?? 'ru');

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang];
    const t: TFn = (key, vars) => fill(dict[key] ?? ru[key] ?? key, vars);
    const errorText = (err: unknown) => {
      if (err instanceof ApiError) {
        const key = `err.${err.code}` as DictKey;
        if (key in dict) {
          const details = (err.details && typeof err.details === 'object' ? err.details : {}) as Vars;
          return t(key, details);
        }
        return err.message && err.message !== err.code ? `${t('err.generic')} (${err.message})` : t('err.generic');
      }
      if (typeof err === 'string' && err in dict) return t(err as DictKey);
      return t('err.generic');
    };
    return { lang, setLang, t, errorText };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
