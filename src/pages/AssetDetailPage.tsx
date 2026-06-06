import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Star, Loader2, ArrowLeft, Plus, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchHistory, formatNumber, isMarketOpen, getMarketBadge } from '../lib/api';
import { CHART_RANGES } from '../data/assetUniverse';
import { addToWatchlist, removeFromWatchlist, isWatched } from '../lib/api';
import type { QuoteData, Market } from '../types';

interface AssetDetailPageProps {
  symbol: string;
  name: string;
  market: Market;
  quote?: QuoteData;
  usdTry: number;
  onClose: () => void;
}

interface HistoryPoint {
  date: string;
  close: number;
}

export default function AssetDetailPage({ symbol, name, market, quote, onClose }: AssetDetailPageProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeRange, setActiveRange] = useState<(typeof CHART_RANGES)[number]['value']>('1y');
  const [watched, setWatched] = useState(false);
  const [watching, setWatching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const normalizedSymbol = market === 'BIST' ? symbol.replace(/\.IS$/i, '') : symbol;
  const yahooSymbol = market === 'BIST' ? `${normalizedSymbol}.IS` : normalizedSymbol;
  const displaySymbol = market === 'BIST' ? normalizedSymbol : symbol;
  const live = isMarketOpen(market);
  const isUp = (quote?.changePercent || 0) >= 0;
  const badge = getMarketBadge(market);

  // Load watch status
  useEffect(() => {
    isWatched(yahooSymbol).then(setWatched).catch(() => {});
  }, [yahooSymbol]);

  // Load history when range changes
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchHistory(yahooSymbol, activeRange);
      if (data && data.length > 1) {
        setHistory(data);
      } else {
        const mock = generateMockHistory(quote?.price || 100, activeRange);
        setHistory(mock);
      }
    } catch (err) {
      console.error('History error:', err);
      const mock = generateMockHistory(quote?.price || 100, activeRange);
      setHistory(mock);
      setHistoryError('Gerçek veri alınamadı, tahmini grafik gösteriliyor');
    } finally {
      setLoading(false);
    }
  }, [yahooSymbol, activeRange, quote?.price]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleWatchToggle = async () => {
    setWatching(true);
    try {
      if (watched) {
        const result = await removeFromWatchlist(yahooSymbol);
        if (result.success) {
          setWatched(false);
          showToast('Takip listesinden çıkarıldı', 'success');
        } else {
          showToast('Çıkarılamadı: ' + (result.error || 'Hata'), 'error');
        }
      } else {
        const result = await addToWatchlist(yahooSymbol, name, market);
        if (result.success) {
          setWatched(true);
          showToast('Takip listesine eklendi', 'success');
        } else {
          showToast('Eklenemedi: ' + (result.error || 'Hata'), 'error');
        }
      }
    } catch (err) {
      console.error('Watchlist error:', err);
      showToast('İşlem başarısız', 'error');
    } finally {
      setWatching(false);
    }
  };

  // Calculate change percentage for chart
  const firstPrice = history[0]?.close || 0;
  const lastPrice = history[history.length - 1]?.close || 0;
  const chartChangePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const chartColor = chartChangePct >= 0 ? '#22C55E' : '#EF4444';

  // Format chart data
  const chartData = history.map(p => ({
    date: p.date.length > 5 ? p.date.slice(5) : p.date,
    fullDate: p.date,
    value: p.close,
  }));

  // Calculate period change
  const getChangeLabel = () => {
    const range = CHART_RANGES.find(r => r.value === activeRange);
    return range?.label || '1Y';
  };

  return (
    <div className="fixed inset-0 bg-kum-bg z-50 flex flex-col md:ml-64">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-kum-success text-black' : 'bg-kum-danger text-white'}`}>
          {toast.message}
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 bg-kum-card/95 backdrop-blur-sm border-b border-kum-border z-10 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onClose} className="flex items-center gap-2 text-kum-textMuted hover:text-kum-text">
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Geri</span>
          </button>
          <div className="flex items-center gap-2">
            <span className={`badge ${badge.class}`}>{badge.label}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${live ? 'bg-kum-success/20 text-kum-success' : 'bg-kum-bg text-kum-textDim'}`}>
              {live ? 'CANLI' : 'KAPALI'}
            </span>
          </div>
          <button
            onClick={handleWatchToggle}
            disabled={watching}
            className={`p-2 rounded-lg transition-colors ${watched ? 'bg-kum-primary/20 text-kum-primary' : 'bg-kum-bg text-kum-textMuted hover:text-kum-text'}`}
          >
            <Star size={20} fill={watched ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Title Card */}
          <div className="card-lg">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1 mr-4">
                <h1 className="text-2xl font-bold text-kum-text truncate">{displaySymbol}</h1>
                <p className="text-sm text-kum-textMuted truncate">{name}</p>
              </div>
              {quote && (
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-bold text-kum-text font-mono">
                    {formatNumber(quote.price, 2)}
                  </p>
                  <p className="text-sm text-kum-textMuted">{quote.currency}</p>
                </div>
              )}
            </div>

            {quote && (
              <div className="flex items-center gap-4 mb-4">
                <div className={`flex items-center gap-1 ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                  {isUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  <span className="text-lg font-semibold">
                    {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
                  </span>
                </div>
                <span className="text-sm text-kum-textMuted">
                  {isUp ? '+' : ''}{formatNumber(quote.change || 0, 2)} bugün
                </span>
              </div>
            )}
          </div>

          {/* Chart Range Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CHART_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setActiveRange(range.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeRange === range.value
                    ? 'bg-kum-primary text-black'
                    : 'bg-kum-card border border-kum-border text-kum-textMuted hover:border-kum-borderLight'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="card-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-kum-text">
                {getChangeLabel()} Performans
              </h3>
              {!loading && history.length > 1 && (
                <span className={`text-sm font-semibold ${chartChangePct >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
                  {chartChangePct >= 0 ? '+' : ''}{chartChangePct.toFixed(2)}%
                </span>
              )}
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-kum-primary" />
              </div>
            ) : history.length < 2 ? (
              <div className="h-64 flex items-center justify-center text-center">
                <div>
                  <AlertCircle size={32} className="text-kum-textDim mx-auto mb-2" />
                  <p className="text-kum-textMuted">Bu zaman aralığı için yeterli veri yok</p>
                </div>
              </div>
            ) : (
              <>
                {historyError && (
                  <p className="text-xs text-kum-textDim mb-2">{historyError}</p>
                )}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id={`grad-${yahooSymbol}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v) => formatNumber(v, 0)} tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip formatter={(value: number) => formatNumber(value, 2)} contentStyle={{ backgroundColor: '#0B0B0B', border: '1px solid #1A1A1A', borderRadius: '8px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#grad-${yahooSymbol})`} dot={false} activeDot={{ r: 4, fill: chartColor }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleWatchToggle}
              disabled={watching}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
                watched
                  ? 'bg-kum-primary/20 text-kum-primary border border-kum-primary/30'
                  : 'bg-kum-card border border-kum-border text-kum-text hover:bg-kum-cardHover'
              }`}
            >
              <Star size={18} fill={watched ? 'currentColor' : 'none'} />
              {watched ? 'Takipten Çıkar' : 'Takip Listeme Ekle'}
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-kum-primary text-black font-medium transition-colors hover:bg-kum-primaryDark">
              <Plus size={18} />
              Portföye Ekle
            </button>
          </div>

          {/* Disclaimer */}
          <div className="text-center py-4">
            <p className="text-[10px] text-kum-textDim">
              Bu uygulama yatırım tavsiyesi vermez.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate mock history for fallback
function generateMockHistory(basePrice: number, range: string): HistoryPoint[] {
  const days: Record<string, number> = {
    '1d': 1,
    '1w': 7,
    '1m': 30,
    '6m': 180,
    '1y': 365,
    '2y': 730,
    '5y': 1825,
  };

  const d = days[range] || 365;
  const step = d > 30 ? Math.ceil(d / 50) : 1;
  const points: HistoryPoint[] = [];
  const now = new Date();

  for (let i = d; i >= 0; i -= step) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variance = (Math.random() - 0.45) * 0.15 * basePrice;
    points.push({
      date: date.toISOString().slice(0, 10),
      close: Math.max(basePrice * 0.5, basePrice + variance),
    });
  }

  return points;
}
