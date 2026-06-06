import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabaseConfig, setAuthenticatedUserId, supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = hasSupabaseConfig();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) {
      setAuthenticatedUserId(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }: any) => {
      if (!isMounted) return;
      if (error) console.warn('Supabase session load failed:', error.message);
      const nextSession = data?.session ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthenticatedUserId(nextSession?.user?.id ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: any, nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthenticatedUserId(nextSession?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [isConfigured]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    isSupabaseConfigured: isConfigured,
    isDemoMode: !isConfigured,
    async signIn(email: string, password: string) {
      if (!isConfigured) return { error: 'Supabase ayarlı değil. Uygulama demo modda çalışıyor.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUp(email: string, password: string) {
      if (!isConfigured) return { error: 'Supabase ayarlı değil. Uygulama demo modda çalışıyor.' };
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      if (!data.session) {
        return { message: 'Kayıt oluşturuldu. Supabase ayarında e-posta doğrulaması açıksa gelen kutunu kontrol etmen gerekebilir.' };
      }
      return { message: 'Kayıt oluşturuldu ve giriş yapıldı.' };
    },
    async signOut() {
      if (!isConfigured) return;
      await supabase.auth.signOut();
      setAuthenticatedUserId(null);
    },
  }), [isConfigured, loading, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
