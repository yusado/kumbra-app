import { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Briefcase,
  Star,
  TrendingUp,
  Wallet,
  Settings,
  RefreshCw,
  ChevronLeft,
  LogOut,
  UserCircle,
  Cloud,
  Database,
  X,
} from 'lucide-react';
import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import WatchlistPage from './pages/WatchlistPage';
import MarketsPage from './pages/MarketsPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AuthPage from './pages/AuthPage';
import { fetchQuotes, getDemoDataCounts, loadAssets, loadExchangeRates, loadWatchlist, migrateDemoDataToSupabaseAccount } from './lib/api';
import { useAuth } from './context/AuthContext';
import type { QuotesMap, ExchangeRate, Market } from './types';

type Tab = 'home' | 'portfolio' | 'watchlist' | 'markets' | 'expenses' | 'settings';

const REFRESH_INTERVAL = 60 * 1000;

export default function App() {
  const { user, loading: authLoading, isSupabaseConfigured, isDemoMode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [quotes, setQuotes] = useState<QuotesMap>({});
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{
    symbol: string;
    name: string;
    market: Market;
  } | null>(null);
  const [demoImportCount, setDemoImportCount] = useState(0);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const usdTry = rates.find(r => r.pair === 'USDTRY')?.rate || 45.5;

  useEffect(() => {
    if (authLoading) return;
    if (isSupabaseConfigured && !user) return;
    loadExchangeRates().then(setRates);
  }, [authLoading, isSupabaseConfigured, user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setDemoImportCount(0);
      return;
    }
    const counts = getDemoDataCounts();
    setDemoImportCount(counts.total);
  }, [user, isSupabaseConfigured]);

  const refreshQuotes = useCallback(async () => {
    if (authLoading) return;
    if (isSupabaseConfigured && !user) return;

    setIsRefreshing(true);
    try {
      const baseSymbols = [
        'USDTRY=X', 'EURTRY=X', 'GC=F', 'SI=F',
        'SPY', 'QQQ', '^GSPC', '^IXIC', 'XU100.IS',
        'AAPL', 'MSFT', 'NVDA', 'GARAN.IS', 'THYAO.IS', 'ASELS.IS'
      ];
      const [assets, watchlist] = await Promise.all([
        loadAssets().catch(() => []),
        loadWatchlist().catch(() => []),
      ]);
      const portfolioSymbols = assets.map(a => a.exchange === 'BIST' ? `${a.ticker.replace(/\.IS$/i, '')}.IS` : a.ticker.toUpperCase());
      const watchlistSymbols = watchlist.map(w => w.market === 'BIST' ? `${w.symbol.replace(/\.IS$/i, '')}.IS` : w.symbol.toUpperCase());
      const symbols = [...new Set([...baseSymbols, ...portfolioSymbols, ...watchlistSymbols])];
      const freshQuotes = await fetchQuotes(symbols);
      if (Object.keys(freshQuotes).length > 0) {
        setQuotes(prev => ({ ...prev, ...freshQuotes }));
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [authLoading, isSupabaseConfigured, user]);

  useEffect(() => {
    if (authLoading) return;
    if (isSupabaseConfigured && !user) return;

    refreshQuotes();
    const id = setInterval(refreshQuotes, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [authLoading, isSupabaseConfigured, refreshQuotes, user]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setSelectedAsset(null);
  }, []);

  const handleSelectAsset = async (symbol: string, name: string, market: Market) => {
    setSelectedAsset({ symbol, name, market });
  };

  const handleMigrateDemoData = async () => {
    if (!user) return;
    setIsMigrating(true);
    setMigrationMessage(null);
    try {
      const result = await migrateDemoDataToSupabaseAccount(user.id);
      if (result.success) {
        setDemoImportCount(0);
        setMigrationMessage(result.migrated > 0
          ? `${result.migrated} demo kayıt hesabına aktarıldı.`
          : 'Aktarılacak yeni demo verisi bulunmadı.');
      } else {
        setMigrationMessage(result.error || 'Demo verileri aktarılamadı.');
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const renderContent = () => {
    if (selectedAsset) {
      return (
        <AssetDetailPage
          symbol={selectedAsset.symbol}
          name={selectedAsset.name}
          market={selectedAsset.market}
          quote={quotes[selectedAsset.symbol]}
          usdTry={usdTry}
          onClose={() => setSelectedAsset(null)}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            quotes={quotes}
            rates={rates}
            usdTry={usdTry}
            lastUpdate={lastUpdate}
            isRefreshing={isRefreshing}
            onRefresh={refreshQuotes}
            onSelectAsset={handleSelectAsset}
          />
        );
      case 'portfolio':
        return (
          <PortfolioPage
            quotes={quotes}
            usdTry={usdTry}
            onSelectAsset={handleSelectAsset}
          />
        );
      case 'watchlist':
        return (
          <WatchlistPage
            quotes={quotes}
            usdTry={usdTry}
            onSelectAsset={handleSelectAsset}
          />
        );
      case 'markets':
        return (
          <MarketsPage
            quotes={quotes}
            onSelectAsset={handleSelectAsset}
          />
        );
      case 'expenses':
        return <ExpensesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  const tabs: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: 'Ana Sayfa' },
    { id: 'portfolio', icon: Briefcase, label: 'Portföy' },
    { id: 'watchlist', icon: Star, label: 'Takip' },
    { id: 'markets', icon: TrendingUp, label: 'Piyasalar' },
    { id: 'expenses', icon: Wallet, label: 'Harcama' },
    { id: 'settings', icon: Settings, label: 'Ayarlar' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-kum-bg flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={28} className="animate-spin text-kum-primary mx-auto mb-3" />
          <p className="text-sm text-kum-textMuted">Kumbra yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && !user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-kum-bg pb-20 md:pb-0 md:pl-64">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 w-64 h-full bg-kum-card border-r border-kum-border flex-col z-50">
        <div className="p-6 border-b border-kum-border">
          <h1 className="text-2xl font-bold text-gradient">Kumbra</h1>
          <p className="text-xs text-kum-textMuted mt-1">Portföy & Bütçe</p>
          <div className="mt-4 rounded-xl border border-kum-border bg-kum-bg p-3">
            <div className="flex items-center gap-2 min-w-0">
              {isDemoMode ? <Database size={16} className="text-kum-secondary" /> : <UserCircle size={16} className="text-kum-primary" />}
              <div className="min-w-0">
                <p className="text-xs font-medium text-kum-text truncate">
                  {isDemoMode ? 'Demo mod' : user?.email}
                </p>
                <p className="text-[10px] text-kum-textDim">
                  {isDemoMode ? 'Veriler bu cihazda saklanır' : 'Hesap verileri bulutta saklanır'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-kum-primary/10 text-kum-primary border-l-2 border-kum-primary'
                  : 'text-kum-textMuted hover:text-kum-text hover:bg-kum-cardHover'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-kum-border text-xs text-kum-textDim space-y-3">
          <div className="flex items-center justify-between">
            <span>Son güncelleme:</span>
            <span>{lastUpdate ? new Date(lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          </div>
          {isSupabaseConfigured && user && (
            <button onClick={signOut} className="w-full btn-secondary flex items-center justify-center gap-2 text-xs py-2">
              <LogOut size={14} />
              Çıkış yap
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 bg-kum-card/95 backdrop-blur-sm border-b border-kum-border z-40">
        <div className="flex items-center justify-between px-4 py-3">
          {selectedAsset ? (
            <>
              <button onClick={() => setSelectedAsset(null)} className="p-2 -ml-2">
                <ChevronLeft size={20} className="text-kum-text" />
              </button>
              <h1 className="text-sm font-semibold text-kum-text">{selectedAsset.symbol}</h1>
              <div className="w-8" />
            </>
          ) : (
            <>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gradient">Kumbra</h1>
                <p className="text-[10px] text-kum-textDim truncate">{isDemoMode ? 'Demo mod' : user?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshQuotes} className="p-2" disabled={isRefreshing}>
                  <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} text-kum-textMuted`} />
                </button>
                {isSupabaseConfigured && user && (
                  <button onClick={signOut} className="p-2">
                    <LogOut size={18} className="text-kum-textMuted" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {isDemoMode && (
        <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-kum-secondary/30 bg-kum-secondary/10 px-4 py-3 text-sm text-kum-textMuted flex items-start gap-2">
          <Database size={16} className="text-kum-secondary mt-0.5" />
          <span>Demo mod: veriler yalnızca bu cihazda saklanır. Farklı cihazlarda aynı veriyi görmek için Vercel’e Supabase env değerlerini ekle.</span>
        </div>
      )}

      {demoImportCount > 0 && user && (
        <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-kum-primary/30 bg-kum-primary/10 px-4 py-3 text-sm text-kum-text flex flex-col sm:flex-row sm:items-center gap-3">
          <Cloud size={18} className="text-kum-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Bu cihazda {demoImportCount} demo kayıt bulundu.</p>
            <p className="text-xs text-kum-textMuted">İstersen bunları hesabına aktarabilir ve farklı cihazlarda görebilirsin.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleMigrateDemoData} disabled={isMigrating} className="btn-primary text-xs py-2">
              {isMigrating ? 'Aktarılıyor...' : 'Hesabıma aktar'}
            </button>
            <button onClick={() => setDemoImportCount(0)} className="btn-secondary text-xs py-2">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {migrationMessage && (
        <div className="mx-4 md:mx-6 mt-4 rounded-xl border border-kum-border bg-kum-card px-4 py-3 text-sm text-kum-textMuted">
          {migrationMessage}
        </div>
      )}

      <main className="min-h-screen">
        {renderContent()}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-kum-card border-t border-kum-border z-50">
        <div className="flex justify-around py-2">
          {tabs.slice(0, 5).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-kum-primary'
                  : 'text-kum-textMuted'
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
