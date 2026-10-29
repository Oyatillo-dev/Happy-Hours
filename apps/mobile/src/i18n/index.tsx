import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, session } from '@/api/client';
import type { Language } from '@/api/types';
import { ky } from './ky';
import { ru, type Dict } from './ru';

export const dictionaries: Record<Language, Dict> = { ru, ky };
const STORAGE_KEY = 'hh.language';

/** Fills `{name}` placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translates an API/network error into a user-facing message. */
export function errorMessage(t: Dict, error: unknown): string {
  if (error instanceof ApiError) {
    const known = (t.errors as Record<string, string>)[error.code];
    if (known) return known;
    if (error.code.endsWith('_not_found')) return t.errors.unknown;
  }
  return t.errors.unknown;
}

interface I18nValue {
  lang: Language;
  t: Dict;
  setLang: (lang: Language) => Promise<void>;
  err: (error: unknown) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('ru');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'ru' || v === 'ky') setLangState(v);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback(async (next: Language) => {
    setLangState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    // FR-B13: also store it on the account so push notifications come in the same language.
    if (session.isAuthenticated) {
      await api('PATCH', '/me', { body: { language: next } }).catch(() => undefined);
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = dictionaries[lang];
    return { lang, t, setLang, err: (e: unknown) => errorMessage(t, e) };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export async function storedLanguage(): Promise<Language> {
  const v = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return v === 'ky' ? 'ky' : 'ru';
}
