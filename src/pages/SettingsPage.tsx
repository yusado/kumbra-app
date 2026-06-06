import { useState, useEffect } from 'react';
import { Database, Globe, Eye, EyeOff, Trash2, Download, Upload, Info, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { loadExchangeRates, loadExpenses, loadIncome, loadAssets, loadLiabilities } from '../lib/api';
import { getDataOwnerId, hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ExchangeRate, Expense, IncomeRecord, Asset, Liability } from '../types';
import { formatNumber } from '../lib/api';

export default function SettingsPage() {
  const { user, isDemoMode, signOut } = useAuth();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [stats, setStats] = useState({ expenses: 0, income: 0, assets: 0, liabilities: 0 });

  useEffect(() => {
    loadExchangeRates().then(setRates);
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [exp, inc, assets, liab] = await Promise.all([
        loadExpenses(),
        loadIncome(),
        loadAssets(),
        loadLiabilities(),
      ]);
      setStats({
        expenses: exp.length,
        income: inc.length,
        assets: assets.length,
        liabilities: liab.length,
      });
    } catch (err) {
      console.error('Stats load failed:', err);
    }
  };

  const sessionId = getDataOwnerId();

  const handleExport = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      expenses: await loadExpenses(),
      income: await loadIncome(),
      assets: await loadAssets(),
      liabilities: await loadLiabilities(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kumbra-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataSources = [
    { name: 'BIST', status: 'active', lastUpdate: new Date().toISOString(), interval: '5 dakika' },
    { name: 'NASDAQ / ABD', status: 'active', lastUpdate: new Date().toISOString(), interval: '5 dakika' },
    { name: 'Döviz Kurları', status: 'active', lastUpdate: new Date().toISOString(), interval: '15 dakika' },
    { name: 'Altın / Gümüş', status: 'active', lastUpdate: new Date().toISOString(), interval: '15 dakika' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-kum-text">Ayarlar</h1>
        <p className="text-sm text-kum-textMuted mt-1">Veri kaynakları ve uygulama ayarları</p>
      </div>

      {/* Account */}
      <div className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle size={20} className={isDemoMode ? 'text-kum-secondary' : 'text-kum-success'} />
          <h2 className="text-lg font-semibold text-kum-text">Hesap Durumu</h2>
        </div>
        <div className="rounded-xl bg-kum-bg border border-kum-border p-4 space-y-2">
          <p className="text-sm text-kum-text">
            {isDemoMode ? 'Demo moddasın.' : `Giriş yapılan hesap: ${user?.email}`}
          </p>
          <p className="text-xs text-kum-textMuted">
            {isDemoMode
              ? 'Supabase env değerleri girilmediği için veriler yalnızca bu cihazın tarayıcısında saklanır.'
              : 'Verilerin Supabase hesabına bağlı saklanır. Aynı hesapla farklı cihazdan giriş yapınca aynı kayıtlar yüklenir.'}
          </p>
          <p className="text-xs text-kum-textDim">
            Supabase bağlantısı: {hasSupabaseConfig() ? 'Aktif' : 'Kapalı'}
          </p>
          {!isDemoMode && (
            <button onClick={signOut} className="btn-secondary text-sm mt-2">
              Çıkış yap
            </button>
          )}
        </div>
      </div>

      {/* Data Sources Status */}
      <div className="card-lg">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-kum-primary" />
          <h2 className="text-lg font-semibold text-kum-text">Veri Kaynakları</h2>
        </div>

        <div className="space-y-3">
          {dataSources.map(source => (
            <div key={source.name} className="flex items-center justify-between p-3 rounded-lg bg-kum-bg">
              <div>
                <p className="text-sm font-medium text-kum-text">{source.name}</p>
                <p className="text-xs text-kum-textMuted">Yenileme: {source.interval}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${source.status === 'active' ? 'bg-kum-success' : 'bg-kum-danger'}`} />
                <span className="text-xs text-kum-textMuted capitalize">{source.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg border border-kum-border bg-kum-bg">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-kum-textMuted mt-0.5" />
            <p className="text-xs text-kum-textMuted">
              API tuşları ortam değişkenlerinden yüklenir. Üretim ortamında tuşlar güvenli bir şekilde Supabase Edge Functions içinde saklanır.
            </p>
          </div>
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Globe size={20} className="text-kum-primary" />
          <h2 className="text-lg font-semibold text-kum-text">Döviz Kurları</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {rates.map(rate => (
            <div key={rate.id} className="p-3 rounded-lg bg-kum-bg">
              <p className="text-xs text-kum-textMuted">{rate.pair}</p>
              <p className="text-lg font-semibold text-kum-text font-mono">{formatNumber(rate.rate, 4)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-kum-primary" />
          <h2 className="text-lg font-semibold text-kum-text">Veri Yönetimi</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-kum-bg text-center">
            <p className="text-2xl font-bold text-kum-text">{stats.expenses}</p>
            <p className="text-xs text-kum-textMuted">Harcama</p>
          </div>
          <div className="p-3 rounded-lg bg-kum-bg text-center">
            <p className="text-2xl font-bold text-kum-text">{stats.income}</p>
            <p className="text-xs text-kum-textMuted">Gelir</p>
          </div>
          <div className="p-3 rounded-lg bg-kum-bg text-center">
            <p className="text-2xl font-bold text-kum-text">{stats.assets}</p>
            <p className="text-xs text-kum-textMuted">Varlık</p>
          </div>
          <div className="p-3 rounded-lg bg-kum-bg text-center">
            <p className="text-2xl font-bold text-kum-text">{stats.liabilities}</p>
            <p className="text-xs text-kum-textMuted">Borç</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Download size={16} />
            Yedekle (JSON)
          </button>
          <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Upload size={16} />
            İçe Aktar
          </button>
        </div>

        <div className="mt-4 p-3 rounded-lg border border-kum-danger/30 bg-kum-danger/10">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 text-kum-danger" />
            <div>
              <p className="text-xs font-medium text-kum-danger">Tüm Verileri Sil</p>
              <p className="text-xs text-kum-textMuted">Bu işlem geri alınamaz. Önce yedek alın.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Session ID */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <Info size={18} className="text-kum-textMuted" />
          <h3 className="text-sm font-medium text-kum-text">Veri Sahibi ID</h3>
        </div>
        <p className="text-xs font-mono text-kum-textMuted bg-kum-bg p-2 rounded-lg break-all">
          {sessionId}
        </p>
        <p className="text-xs text-kum-textDim mt-2">
          Bu ID demo modda cihaz oturumunu, hesap modunda Supabase kullanıcı hesabını temsil eder.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="card-lg text-center">
        <h3 className="text-lg font-bold text-kum-text mb-2">⚠️ Yasal Uyarı</h3>
        <p className="text-sm text-kum-textMuted max-w-md mx-auto leading-relaxed">
          Bu uygulama yatırım tavsiyesi vermez, yalnızca kullanıcının verilerini ve piyasa verilerini gösterir.
          Piyasa verileri gecikmeli olabilir. Yatırım kararları için profesyonel danışmanlık alın.
        </p>
        <div className="mt-4 text-xs text-kum-textDim">
          © 2024 Kumbra
        </div>
      </div>
    </div>
  );
}
