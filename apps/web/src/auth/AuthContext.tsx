import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTokens, onTokensChange, setTokens } from '../api/client';
import { authApi, meApi } from '../api/endpoints';
import type { Language, Me, Tokens } from '../api/types';
import { storedLanguage, useI18n } from '../i18n';

interface AuthValue {
  isAuthenticated: boolean;
  me: Me | undefined;
  meLoading: boolean;
  meError: unknown;
  login: (tokens: Tokens, me: Me) => void;
  logout: () => Promise<void>;
  /** Switches UI language and stores it on the user (PATCH /me). */
  changeLanguage: (lang: Language) => void;
  isOwner: boolean;
  isStaffAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { setLang } = useI18n();
  const [tokens, setTokenState] = useState<Tokens | null>(getTokens());

  useEffect(
    () =>
      onTokensChange((t) => {
        setTokenState(t);
        if (!t) qc.clear();
      }),
    [qc],
  );

  const meQuery = useQuery({ queryKey: ['me'], queryFn: meApi.get, enabled: !!tokens, staleTime: 60_000 });
  const me = tokens ? meQuery.data : undefined;

  // First visit on this device: take the language saved on the account.
  useEffect(() => {
    if (me && !storedLanguage()) setLang(me.language);
  }, [me, setLang]);

  const login = useCallback(
    (t: Tokens, user: Me) => {
      qc.clear();
      qc.setQueryData(['me'], user);
      setTokens(t);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    const current = getTokens();
    if (current) await authApi.logout(current.refreshToken).catch(() => undefined);
    setTokens(null);
  }, []);

  const changeLanguage = useCallback(
    (lang: Language) => {
      setLang(lang);
      if (getTokens()) {
        meApi
          .update({ language: lang })
          .then((u) => qc.setQueryData(['me'], u))
          .catch(() => undefined);
      }
    },
    [qc, setLang],
  );

  const value = useMemo<AuthValue>(
    () => ({
      isAuthenticated: !!tokens,
      me,
      meLoading: !!tokens && meQuery.isLoading,
      meError: meQuery.error,
      login,
      logout,
      changeLanguage,
      isOwner: me?.role === 'PARTNER_OWNER',
      isStaffAdmin: me?.role === 'SUPPORT' || me?.role === 'ADMIN',
      isAdmin: me?.role === 'ADMIN',
    }),
    [tokens, me, meQuery.isLoading, meQuery.error, login, logout, changeLanguage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
