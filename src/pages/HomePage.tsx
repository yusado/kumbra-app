import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff, RefreshCw, PiggyBank, Star } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber, isMarketOpen, getMarketBadge } from '../lib/api';
import { loadAssets, loadSnapshots, loadWatchlist, loadExpenses, loadIncome, loadLiabilities, loadCashAccounts, loadExchangeRates, type HistoryPoint } from '../lib/api';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { QuotesMap, ExchangeRate, Asset, WatchlistItem, Expense, IncomeRecord, Liability, CashAccount, Market } from '../types';

interface HomePageProps {
  quotes: QuotesMap;
  rates: ExchangeRate[];
  usdTry: number;
  lastUpdate: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectAsset: (symbol: string, name: string, market: Market) => void;
}

const MARKET_CARDS = [
  { symbol: 'USDTRY=X', name: 'USD/TRY', market: 'FX' as Market },
  { symbol: 'EURTRY=X', name: 'EUR/TRY', market: 'FX' as Market },
  { symbol: 'GC=F', name: 'Altın', market: 'METAL' as Market },
  { symbol: 'SI=F', name: 'Gümüş', market: 'METAL' as Market },
  { symbol: 'SPY', name: 'S&P 500', market: 'US' as Market },
  { symbol: 'QQQ', name: 'NASDAQ', market: 'NASDAQ' as Market },
  { symbol: 'XU100.IS', name: 'BIST 100', market: 'BIST' as Market },
];

export default function HomePage({ quotes, rates, usdTry, lastUpdate, isRefreshing, onRefresh, onSelectAsset }: HomePageProps) {
  const [privacy, setPrivacy] = useState<'visible_try' | 'visible_usd' | 'hidden'>('visible_try');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [snapshots, setSnapshots] = useState<{ recorded_at: string; total_value_usd: number }[]>([]);
  const [totalPortfolio, setTotalPortfolio] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadAssets(),
      loadWatchlist(),
      loadCashAccounts(),
      loadSnapshots(),
      loadLiabilities(),
      loadExpenses(),
      loadIncome(),
    ])
      .then(([a, w, c, s, liab, exp, inc]) => {
        setAssets((a || []) as Asset[]);
        setWatchlist((w || []) as WatchlistItem[]);
        setCashAccounts((c || []) as CashAccount[]);
        setSnapshots((s || []).map((x: any) => ({ recorded_at: x.recorded_at, total_value_usd: x.total_value_usd })));
        const lib = (liab || []) as Liability[];
        setTotalLiabilities(lib.reduce((sum, l) => sum + l.amount, 0));
        const expenses = (exp || []) as Expense[];
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.slice(0, 7);
        setTodayExpenses(expenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0));
        setMonthlyExpenses(expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0));
      })
      .catch(err => console.error('Load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // Calculate portfolio value
  useEffect(() => {
    if (assets.length > 0 && Object.keys(quotes).length > 0) {
      let total = 0;
      for (const a of assets) {
        const yahooTicker = a.exchange === 'BIST' ? `${a.ticker.replace(/\.IS$/i, '')}.IS` : a.ticker;
        const price = quotes[yahooTicker]?.price || a.purchase_price;
        const valueTRY = a.exchange === 'BIST' ? price * a.quantity : price * a.quantity * usdTry;
        total += valueTRY;
      }
      setTotalPortfolio(total);
    } else if (assets.length > 0) {
      // Use purchase price if quotes not loaded
      const total = assets.reduce((s, a) => s + a.purchase_price * a.quantity, 0);
      setTotalPortfolio(total);
    }
  }, [assets, quotes, usdTry]);

  // Calculate net worth
  const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const netWorth = totalPortfolio + totalCash - totalLiabilities;
  const change24h = snapshots.length >= 2
    ? ((snapshots[snapshots.length - 1]?.total_value_usd || 0) - (snapshots[0]?.total_value_usd || 0)) * usdTry
    : 0;

  const formatValue = (val: number, currency: 'TRY' | 'USD') => {
    if (privacy === 'hidden') return '••••••';
    const v = currency === 'USD' ? val / usdTry : val;
    return formatCurrency(v, currency);
  };

  // Simple sparkline data
  const chartData = snapshots.slice(-30).map((s, i) => ({
    name: i.toString(),
    value: s.total_value_usd * usdTry,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Net Worth Card */}
      <div className="card-lg">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-kum-textMuted uppercase tracking-wider mb-1">Toplam Net Varlık</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-kum-text truncate">
              {formatValue(netWorth, privacy === 'visible_usd' ? 'USD' : 'TRY')}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPrivacy(p => p === 'hidden' ? 'visible_try' : p === 'visible_try' ? 'visible_usd' : 'hidden')}
              className="p-2 rounded-lg bg-kum-bg hover:bg-kum-border transition-colors"
              title="Gizlilik"
            >
              {privacy === 'hidden' ? <EyeOff size={18} className="text-kum-textMuted" /> : <Eye size={18} className="text-kum-primary" />}
            </button>
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-kum-bg hover:bg-kum-border transition-colors"
              disabled={isRefreshing}
              title="Yenile"
            >
              <RefreshCw size={18} className={`${isRefreshing ? 'animate-spin' : ''} text-kum-textMuted`} />
            </button>
          </div>
        </div>

        {/* Quick Stats - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Bugünkü Değişim</p>
            <p className={`text-lg font-bold font-mono truncate ${change24h >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
              {privacy === 'hidden' ? '•••' : formatPercent((change24h / (netWorth || 1)) * 100)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Portföy</p>
            <p className="text-lg font-bold font-mono text-kum-text truncate">{formatValue(totalPortfolio, 'TRY')}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Nakit</p>
            <p className="text-lg font-bold font-mono text-kum-text truncate">{formatValue(totalCash, 'TRY')}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Toplam Borç</p>
            <p className="text-lg font-bold font-mono text-kum-danger truncate">{formatValue(totalLiabilities, 'TRY')}</p>
          </div>
          <div className="min-w-0 col-span-2 sm:col-span-1">
            <p className="text-xs text-kum-textMuted truncate">Bu Ay Harcama</p>
            <p className="text-lg font-bold font-mono text-kum-textMuted truncate">{formatValue(monthlyExpenses, 'TRY')}</p>
          </div>
        </div>

        {/* Mini Chart */}
        {chartData.length > 1 && (
          <div className="h-16 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7A00" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#FF7A00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#FF7A00" strokeWidth={2} fill="url(#netWorthGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Market Snapshot Grid */}
      <div>
        <h3 className="text-sm font-semibold text-kum-text mb-3">Piyasa Özeti</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
          {MARKET_CARDS.map(card => {
            const q = quotes[card.symbol];
            const isUp = (q?.changePercent || 0) >= 0;
            const live = isMarketOpen(card.market);
            return (
              <button
                key={card.symbol}
                onClick={() => onSelectAsset(card.symbol, card.name, card.market)}
                className="card p-3 sm:p-4 hover:border-kum-primary/30 transition-all text-left min-w-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-kum-textMuted truncate">{card.name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${live ? 'bg-kum-success animate-pulse' : 'bg-kum-textDim'}`} />
                </div>
                <p className="text-base sm:text-lg font-semibold text-kum-text font-mono truncate">
                  {q?.price ? formatNumber(q.price, 2) : '—'}
                </p>
                <div className="flex items-center gap-1 mt-1 min-w-0">
                  {isUp ? <TrendingUp size={12} className="text-kum-success flex-shrink-0" /> : <TrendingDown size={12} className="text-kum-danger flex-shrink-0" />}
                  <span className={`text-xs font-medium truncate ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                    {q?.changePercent ? formatPercent(q.changePercent) : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Watchlist Mini */}
      {watchlist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-kum-text">Takip Listem</h3>
            <span className="text-xs text-kum-textMuted">{watchlist.length} varlık</span>
          </div>
          <div className="space-y-2">
            {watchlist.slice(0, 5).map(item => {
              const yahooSymbol = item.market === 'BIST' ? `${item.symbol.replace(/\.IS$/i, '')}.IS` : item.symbol;
              const q = quotes[yahooSymbol];
              const isUp = (q?.changePercent || 0) >= 0;
              const badge = getMarketBadge(item.market);
              const live = isMarketOpen(item.market);

              // Calculate 1-week change (mock for now)
              const weekChange = q?.changePercent ? q.changePercent * 3 : 0; // Approximate
              const weekUp = weekChange >= 0;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectAsset(yahooSymbol, item.asset_name || item.symbol, item.market)}
                  className="w-full card p-3 sm:p-4 flex items-center justify-between hover:border-kum-primary/30 transition-all min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-kum-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-kum-primary">
                        {item.symbol.slice(0, 4)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-kum-text text-sm sm:text-base">{item.symbol}</span>
                        <span className={`badge ${badge.class} text-[10px]`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-kum-textMuted truncate">{item.asset_name}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-kum-text font-mono">
                      {q?.price ? formatNumber(q.price, 2) : '—'}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      {isUp ? <TrendingUp size={12} className="text-kum-success" /> : <TrendingDown size={12} className="text-kum-danger" />}
                      <span className={`text-xs ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                        {q?.changePercent !== undefined ? formatPercent(q.changePercent) : '—'}
                      </span>
                    </div>
                    {/* 1-week change */}
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[10px] text-kum-textDim">1H:</span>
                      <span className={`text-xs font-medium ${weekUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                        {weekUp ? '+' : ''}{weekChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {watchlist.length === 0 && assets.length === 0 && !loading && (
        <div className="card-lg text-center py-12">
          <div className="w-16 h-16 rounded-full bg-kum-primary/10 flex items-center justify-center mx-auto mb-4">
            <PiggyBank size={28} className="text-kum-primary" />
          </div>
          <h3 className="text-lg font-semibold text-kum-text mb-2">Hoş geldiniz!</h3>
          <p className="text-sm text-kum-textMuted max-w-sm mx-auto">
            Portföyünüzü ve harcamalarınızı takip etmeye başlamak için varlık ekleyin veya takip listesi oluşturun.
          </p>
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="text-center py-6 border-t border-kum-border">
        <p className="text-xs text-kum-textDim">
          Son güncelleme: {lastUpdate ? new Date(lastUpdate).toLocaleString('tr-TR') : '—'}
        </p>
        <p className="text-[10px] text-kum-textDim mt-2">
          Bu uygulama yatırım tavsiyesi vermez.
        </p>
      </div>
    </div>
  );
}
