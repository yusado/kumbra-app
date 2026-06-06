import { useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('E-posta adresi gerekli.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }

    setLoading(true);
    try {
      const result = mode === 'signin'
        ? await signIn(cleanEmail, password)
        : await signUp(cleanEmail, password);

      if (result.error) setError(result.error);
      const maybeMessage = (result as { message?: string }).message;
      if (maybeMessage) setMessage(maybeMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kum-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-kum-primary/10 border border-kum-primary/30 mb-4 shadow-glow">
            <ShieldCheck size={30} className="text-kum-primary" />
          </div>
          <h1 className="text-4xl font-bold text-gradient">Kumbra</h1>
          <p className="text-sm text-kum-textMuted mt-2">Portföy ve bütçe verilerin hesabına bağlı saklanır.</p>
        </div>

        <form onSubmit={handleSubmit} className="card-lg space-y-5">
          <div>
            <h2 className="text-xl font-bold text-kum-text">
              {mode === 'signin' ? 'Giriş yap' : 'Yeni hesap oluştur'}
            </h2>
            <p className="text-xs text-kum-textMuted mt-1">
              {mode === 'signin'
                ? 'Aynı hesaba farklı cihazlardan girerek verilerini görebilirsin.'
                : 'E-posta ve şifreyle kişisel Kumbra hesabını oluştur.'}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-kum-danger/40 bg-kum-danger/10 px-3 py-2 text-sm text-kum-danger">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-kum-success/40 bg-kum-success/10 px-3 py-2 text-sm text-kum-success">
              {message}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-kum-textMuted">E-posta</span>
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kum-textDim" />
              <input
                className="input pl-10"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-kum-textMuted">Şifre</span>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kum-textDim" />
              <input
                className="input pl-10"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
              />
            </div>
          </label>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Giriş yap' : 'Kayıt ol'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setMessage(null);
            }}
            className="w-full text-sm text-kum-primary hover:text-kum-secondary transition-colors"
          >
            {mode === 'signin' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </button>
        </form>

        <p className="text-center text-xs text-kum-textDim mt-5">
          Bu ekran yalnızca Supabase ayarları girildiğinde görünür. Env yoksa uygulama demo modda çalışır.
        </p>
      </div>
    </div>
  );
}
