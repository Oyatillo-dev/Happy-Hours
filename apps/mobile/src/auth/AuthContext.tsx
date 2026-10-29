import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, isNetworkError, session } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';
import { orderCache } from '@/lib/orderCache';
import { registerForPush } from '@/lib/push';

const USER_KEY = 'hh.user';

type Status = 'loading' | 'guest' | 'authed';

interface AuthValue {
  status: Status;
  user: User | null;
  signIn: (res: AuthResponse) => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<User | null>(null);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    void AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const clearLocal = useCallback(async () => {
    await session.clear();
    await AsyncStorage.removeItem(USER_KEY).catch(() => undefined);
    await orderCache.clear();
    setUserState(null);
    setStatus('guest');
    queryClient.clear();
  }, [queryClient]);

  // Restore the session on start. Works offline: the cached user is shown until /me answers.
  useEffect(() => {
    let alive = true;
    (async () => {
      const has = await session.load();
      if (!has) {
        if (alive) setStatus('guest');
        return;
      }
      const cached = await AsyncStorage.getItem(USER_KEY).catch(() => null);
      if (cached && alive) {
        try {
          setUserState(JSON.parse(cached) as User);
        } catch {
          // ignore broken cache
        }
      }
      if (alive) setStatus('authed');
      try {
        const me = await api<User>('GET', '/me');
        if (alive) setUser(me);
        void registerForPush();
      } catch (e) {
        if (!isNetworkError(e) && !session.isAuthenticated && alive) await clearLocal();
      }
    })();
    return () => {
      alive = false;
    };
  }, [clearLocal, setUser]);

  // Refresh token rejected → back to guest mode.
  useEffect(() => {
    session.onExpired(() => void clearLocal());
    return () => session.onExpired(null);
  }, [clearLocal]);

  const signIn = useCallback(
    async (res: AuthResponse) => {
      await session.save({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      setStatus('authed');
      // Feed responses differ for a signed-in user (isFavorite).
      await queryClient.invalidateQueries();
      void registerForPush();
    },
    [queryClient, setUser],
  );

  const signOut = useCallback(
    async (opts: { remote?: boolean } = {}) => {
      const token = session.refreshToken;
      if (opts.remote !== false && token) {
        await api('POST', '/auth/logout', { body: { refreshToken: token }, auth: false }).catch(() => undefined);
      }
      await clearLocal();
    },
    [clearLocal],
  );

  const value = useMemo(() => ({ status, user, signIn, signOut, setUser }), [status, user, signIn, signOut, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
