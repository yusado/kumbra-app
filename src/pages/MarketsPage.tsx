import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Search, Loader2, Database } from 'lucide-react';
import { fetchQuotes, formatPercent, formatNumber, isMarketOpen, getMarketBadge } from '../lib/api';
import {
  ALL_ASSETS,
  filterByMarket,
  getYahooSymbol,
  mergeAssetResults,
  searchAssets,
  searchAssetsRemote,
  type AssetMarket,
  type AssetSearchItem,
} from '../data/assetUniverse';
import type { QuotesMap, Market } from '../types';

interface MarketsPageProps {
  quotes: QuotesMap;
  onSelectAsset: (symbol: string, name: string, market: Market) => void;
}

type MarketFilter = 'ALL' | AssetMarket;

const DISPLAY_LIMIT = 600;
const LIVE_QUOTE_LIMIT = 45;

function toAppMarket(market: AssetMarket): Market {
  if (market === 'NYSE') return 'US';
  return market as Market;
}

export default function MarketsPage({ quotes, onSelectAsset }: MarketsPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MarketFilter>('ALL');
  const [remoteResults, setRemoteResults] = useState<AssetSearchItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [marketQuotes, setMarketQuotes] = useState<QuotesMap>({});
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 1) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(async () => {
      setIsSearchingRemote(true);
      const rows = await searchAssetsRemote(q, filter, 50);
      if (!cancelled) {
        setRemoteResults(rows);
        setIsSearchingRemote(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [search, filter]);

  const filteredAssets = useMemo(() => {
    const q = search.trim();
    if (q.length >= 1) {
      const staticRows = searchAssets(q, 120);
      return filterByMarket(mergeAssetResults(staticRows, remoteResults), filter).slice(0, DISPLAY_LIMIT);
    }
    return filterByMarket(ALL_ASSETS, filter).slice(0, DISPLAY_LIMIT);
  }, [search, filter, remoteResults]);

  useEffect(() => {
    if (filteredAssets.length === 0) return;
    let cancelled = false;
    const symbols = Array.from(new Set(filteredAssets.slice(0, LIVE_QUOTE_LIMIT).map(getYahooSymbol)));
    setQuoteLoading(true);
    fetchQuotes(symbols)
      .then(fresh => {
        if (!cancelled && Object.keys(fresh).length > 0) {
          setMarketQuotes(prev => ({ ...prev, ...fresh }));
        }
      })
      .catch(err => console.warn('Market page quote refresh failed:', err))
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => { cancelled = true; };
  }, [filteredAssets]);

  const stats = useMemo(() => ({
    total: ALL_ASSETS.length,
    shown: filteredAssets.length,
    bist: ALL_ASSETS.filter(a => a.market === 'BIST').length,
    us: ALL_ASSETS.filter(a => a.market === 'NASDAQ' || a.market === 'NYSE').length,
    fund: ALL_ASSETS.filter(a => a.market === 'FUND').length,
  }), [filteredAssets.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-kum-text">Piyasalar</h1>
        <p className="text-sm text-kum-textMuted mt-1">
          BIST, ABD borsaları, fonlar, döviz ve emtia. Arama yapınca Twelve Data/BIST endpointinden ek sonuçlar da gelir.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-xs text-kum-textMuted">Yerel evren</p>
          <p className="text-lg font-bold text-kum-text">{stats.total}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-kum-textMuted">BIST</p>
          <p className="text-lg font-bold text-kum-text">{stats.bist}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-kum-textMuted">ABD / ETF</p>
          <p className="text-lg font-bold text-kum-text">{stats.us}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-kum-textMuted">Fon örnekleri</p>
          <p className="text-lg font-bold text-kum-text">{stats.fund}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kum-textMuted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="AAPL, Microsoft, ASELS, Garanti, fon kodu veya altın ara..."
          className="input pl-10 pr-10 w-full"
        />
        {isSearchingRemote && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-kum-primary animate-spin" />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['ALL', 'BIST', 'NASDAQ', 'NYSE', 'FX', 'METAL', 'FUND'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-kum-primary text-black'
                : 'bg-kum-card border border-kum-border text-kum-textMuted'
            }`}
          >
            {f === 'ALL' ? 'Tümü' : f === 'NYSE' ? 'NYSE / ABD' : f}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-kum-textMuted">
        <span>{stats.shown} sonuç gösteriliyor{ALL_ASSETS.length > DISPLAY_LIMIT && search.length === 0 ? `, ilk ${DISPLAY_LIMIT} kayıt` : ''}</span>
        <span className="flex items-center gap-1">
          {quoteLoading ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
          İlk {Math.min(LIVE_QUOTE_LIMIT, filteredAssets.length)} sonuç için canlı fiyat denenir
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAssets.map(asset => {
          const quoteSymbol = getYahooSymbol(asset);
          const q = marketQuotes[quoteSymbol] || quotes[quoteSymbol] || marketQuotes[asset.symbol] || quotes[asset.symbol];
          const isUp = (q?.changePercent || 0) >= 0;
          const live = isMarketOpen(toAppMarket(asset.market));
          const badge = getMarketBadge(toAppMarket(asset.market));

          return (
            <button
              key={`${asset.market}:${asset.symbol}`}
              onClick={() => onSelectAsset(quoteSymbol, asset.name, toAppMarket(asset.market))}
              className="card p-4 hover:border-kum-primary/30 transition-all text-left min-w-0"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-kum-bg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-kum-primary">{asset.symbol.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-kum-text text-sm">{asset.symbol}</span>
                      <span className={`badge ${badge.class} text-[10px]`}>{asset.market === 'NYSE' ? 'NYSE' : badge.label}</span>
                    </div>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${live ? 'bg-kum-success animate-pulse' : 'bg-kum-textDim'}`} />
              </div>
              <p className="text-xs text-kum-textMuted mb-2 truncate">{asset.name}</p>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-kum-text font-mono truncate">
                    {q?.price ? formatNumber(q.price, 2) : '—'}
                  </p>
                  <p className="text-[10px] text-kum-textDim truncate">{q?.source || 'Arama evreni'}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isUp ? <TrendingUp size={14} className="text-kum-success" /> : <TrendingDown size={14} className="text-kum-danger" />}
                  <span className={`text-xs font-medium ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                    {q?.changePercent !== undefined ? formatPercent(q.changePercent) : '—'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-kum-textMuted">Sonuç bulunamadı</p>
          <p className="text-xs text-kum-textDim mt-2">Sembolü direkt yazmayı da deneyebilirsin: AAPL, NVDA, ASELS gibi.</p>
        </div>
      )}
    </div>
  );
}
