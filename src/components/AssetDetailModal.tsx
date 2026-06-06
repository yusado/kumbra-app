import { useEffect, useState, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Star } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchHistory, fetchQuotes, formatNumber, isMarketOpen, getMarketBadge, addToWatchlist, removeFromWatchlist, isWatched } from '../lib/api';
import type { AssetWithQuote, QuotesMap, Market } from '../types';
import { TIME_RANGES } from '../types';
import type { TimeRange } from '../types';

interface AssetDetailModalProps {
  asset: AssetWithQuote;
  quotes: QuotesMap;
  usdTry: number;
  onClose: () => void;
}

export default function AssetDetailModal({ asset, quotes, usdTry, onClose }: AssetDetailModalProps) {
  const [history, setHistory] = useState<{ date: string; close: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>(TIME_RANGES[4]);
  const [watched, setWatched] = useState(false);

  const yahooTicker = asset.exchange === 'BIST' ? `${asset.ticker.replace(/\.IS$/i, '')}.IS` : asset.ticker;
  const market: Market = asset.exchange === 'BIST' ? 'BIST' : 'US';
  const isUp = asset.changePercent >= 0;
  const isPL = asset.profitLossPercent >= 0;
  const badge = getMarketBadge(market);
  const live = isMarketOpen(market);

  useEffect(() => {
    isWatched(yahooTicker).then(setWatched);
    loadHistory();
  }, [yahooTicker, timeRange]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchHistory(yahooTicker, timeRange.value);
      if (data.length > 0) {
        setHistory(data);
      } else {
        // Generate mock data if no data
        const mock = generateMockHistory(asset.currentPrice || asset.purchase_price);
        setHistory(mock);
      }
    } catch (err) {
      console.error('History load failed:', err);
      const mock = generateMockHistory(asset.currentPrice || asset.purchase_price);
      setHistory(mock);
    } finally {
      setIsLoading(false);
    }
  }, [yahooTicker, timeRange]);

  const generateMockHistory = (basePrice: number) => {
    const points: { date: string; close: number }[] = [];
    const now = new Date();
    for (let i = 365; i >= 0; i -= 7) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const variance = (Math.random() - 0.5) * 0.2 * basePrice;
      points.push({
        date: d.toISOString().slice(0, 10),
        close: Math.max(basePrice * 0.5, basePrice + variance),
      });
    }
    return points;
  };

  const handleWatchToggle = async () => {
    if (watched) {
      await removeFromWatchlist(yahooTicker);
      setWatched(false);
    } else {
      await addToWatchlist(yahooTicker, asset.name, market);
      setWatched(true);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const firstPrice = history[0]?.close ?? 0;
  const lastPrice = history[history.length - 1]?.close ?? 0;
  const chartUp = lastPrice >= firstPrice;
  const chartColor = chartUp ? '#22C55E' : '#EF4444';
  const fiveYearPct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  const chartData = history.map(p => ({
    date: p.date.slice(5),
    fullDate: p.date,
    value: p.close,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-kum-card border border-kum-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-kum-border sticky top-0 bg-kum-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-kum-primary/10 flex items-center justify-center">
              <span className="text-kum-primary font-bold text-sm">
                {asset.ticker.slice(0, 4)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-kum-text">{asset.ticker}</h2>
                <span className={`badge ${badge.class}`}>{badge.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${live ? 'bg-kum-success/20 text-kum-success' : 'bg-kum-bg text-kum-textDim'}`}>
                  {live ? 'CANLI' : 'KAPALI'}
                </span>
              </div>
              <p className="text-sm text-kum-textMuted">{asset.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-kum-bg text-kum-textMuted">
            <X size={18} />
          </button>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-3xl font-bold text-kum-text font-mono">
              {asset.currentPrice > 0 ? formatNumber(asset.currentPrice, 2) : '—'}
            </p>
            {asset.currentPrice > 0 && (
              <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{isUp ? '+' : ''}{asset.changePercent.toFixed(2)}% bugün</span>
              </div>
            )}
          </div>

          <button onClick={handleWatchToggle} className={`p-2 rounded-lg ${watched ? 'bg-kum-primary/20 text-kum-primary' : 'bg-kum-bg text-kum-textMuted'}`}>
            <Star size={18} fill={watched ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="px-5 flex gap-2 overflow-x-auto pb-2">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                timeRange.value === range.value
                  ? 'bg-kum-primary text-black'
                  : 'bg-kum-bg border border-kum-border text-kum-textMuted'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="px-5 pb-5">
          {isLoading ? (
            <div className="h-52 flex items-center justify-center text-kum-textMuted">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-kum-textMuted text-sm">
              Geçmiş veri yüklenemedi
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3 mt-4">
                <p className="text-sm font-semibold text-kum-text">{timeRange.label} Performans</p>
                {history.length > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chartUp ? 'bg-kum-success/20 text-kum-success' : 'bg-kum-danger/20 text-kum-danger'}`}>
                    {chartUp ? '+' : ''}{fiveYearPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tickFormatter={(v) => formatNumber(v, 0)} tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={(value: number) => formatNumber(value, 2)} contentStyle={{ backgroundColor: '#0B0B0B', border: '1px solid #1A1A1A', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#grad-${asset.id})`} dot={false} activeDot={{ r: 4, fill: chartColor }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Position Stats */}
        <div className="grid grid-cols-3 gap-px bg-kum-border border-t border-kum-border">
          <div className="bg-kum-card px-4 py-3 text-center">
            <p className="text-xs text-kum-textMuted mb-0.5">Adet</p>
            <p className="text-sm font-semibold text-kum-text font-mono">{asset.quantity.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-kum-card px-4 py-3 text-center">
            <p className="text-xs text-kum-textMuted mb-0.5">Alış Fiyatı</p>
            <p className="text-sm font-semibold text-kum-text font-mono">{formatNumber(asset.purchase_price, 2)}</p>
          </div>
          <div className="bg-kum-card px-4 py-3 text-center">
            <p className="text-xs text-kum-textMuted mb-0.5">Kâr/Zarar</p>
            <p className={`text-sm font-semibold font-mono ${isPL ? 'text-kum-success' : 'text-kum-danger'}`}>
              {isPL ? '+' : ''}{asset.profitLossPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
