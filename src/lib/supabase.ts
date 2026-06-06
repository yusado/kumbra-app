import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

let demoSessionId = '';
let authenticatedUserId: string | null = null;

export function getSessionId(): string {
  if (!demoSessionId) {
    const key = 'kumbara_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    demoSessionId = id;
  }
  return demoSessionId;
}

export function setAuthenticatedUserId(userId: string | null): void {
  authenticatedUserId = userId;
}

export function getAuthenticatedUserId(): string | null {
  return authenticatedUserId;
}

export function getDataOwnerId(): string {
  return authenticatedUserId || getSessionId();
}

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const isSupabaseConfigured = hasSupabaseConfig();

// IMPORTANT:
// Do NOT call createClient when .env is missing. @supabase/supabase-js throws
// "supabaseUrl is required" during module initialization, which causes a blank
// white page before React can render anything. All data functions check
// hasSupabaseConfig() and use localStorage/mock data when this is null.
export const supabase = hasSupabaseConfig()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-session-id': getSessionId(),
        },
      },
    })
  : (null as any);
