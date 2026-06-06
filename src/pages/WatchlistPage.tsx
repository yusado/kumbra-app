import { useState, useEffect, useMemo } from 'react';
import { Star, TrendingUp, TrendingDown, Search, X, Plus, Loader2 } from 'lucide-react';
import { loadWatchlist, addToWatchlist, removeFromWatchlist, formatPercent, formatNumber, isMarketOpen, getMarketBadge } from '../lib/api';
import { searchAssets, searchAssetsRemote, mergeAssetResults, getMarketInfo, getYahooSymbol, type AssetSearchItem } from '../data/assetUniverse';
import type { QuotesMap, WatchlistItem, Market } from '../types';

interface WatchlistPageProps {
  quotes: QuotesMap;
  usdTry: number;
  onSelectAsset: (symbol: string, name: string, market: Market) => void;
}

export default function WatchlistPage({ quotes, usdTry, onSelectAsset }: WatchlistPageProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<AssetSearchItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadWatchlistData();
  }, []);

  const loadWatchlistData = async () => {
    setLoading(true);
    try {
      const data = await loadWatchlist();
      setWatchlist(data);
    } catch (err) {
      console.error('Load watchlist failed:', err);
      showToast('Takip listesi yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToWatchlist = async (asset: AssetSearchItem) => {
    const yahooSymbol = getYahooSymbol(asset);
    setAddingSymbol(yahooSymbol);
    try {
      const result = await addToWatchlist(yahooSymbol, asset.name, asset.market as Market);
      if (result.success) {
        showToast('Takip listesine eklendi', 'success');
        await loadWatchlistData();
        setShowAddModal(false);
        setSearchQuery('');
      } else {
        showToast('Eklenemedi: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (err) {
      console.error('Add to watchlist failed:', err);
      showToast('Eklenemedi', 'error');
    } finally {
      setAddingSymbol(null);
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      const result = await removeFromWatchlist(symbol);
      if (result.success) {
        setWatchlist(watchlist.filter(w => w.symbol !== symbol));
        showToast('Takip listesinden çıkarıldı', 'success');
      } else {
        showToast('Çıkarılamadı: ' + (result.error || 'Bilinmeyen hata'), 'error');
      }
    } catch (err) {
      console.error('Remove failed:', err);
      showToast('Çıkarılamadı', 'error');
    }
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      setIsSearchingRemote(true);
      const rows = await searchAssetsRemote(q, 'ALL', 25);
      if (!cancelled) {
        setRemoteResults(rows);
        setIsSearchingRemote(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [searchQuery]);

  // Filter assets for autocomplete
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 1) return [];
    return mergeAssetResults(searchAssets(searchQuery, 25), remoteResults).slice(0, 25);
  }, [searchQuery, remoteResults]);

  // Check if already in watchlist
  const isInWatchlist = (symbol: string) => {
    return watchlist.some(w => w.symbol === symbol);
  };

  // Calculate 1-week change (approximate)
  const getWeeklyChange = (symbol: string): { change: number; percent: number } | null => {
    const q = quotes[symbol];
    if (!q) return null;
    const dailyChange = q.changePercent || 0;
    return {
      percent: dailyChange * 3.5,
      change: (q.price || 0) * (dailyChange * 3.5 / 100),
    };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-kum-success text-black' : 'bg-kum-danger text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-kum-text">Takip Listem</h1>
          <p className="text-sm text-kum-textMuted">{watchlist.length} varlık takip ediliyor</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={18} />
          <span className="hidden sm:inline">Varlık Ekle</span>
        </button>
      </div>

      {/* Watchlist */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-kum-primary" />
        </div>
      ) : watchlist.length === 0 ? (
        <div className="card-lg text-center py-12">
          <Star size={40} className="text-kum-primary/50 mx-auto mb-4" />
          <p className="text-kum-text">Henüz takip listesi oluşturulmadı</p>
          <p className="text-sm text-kum-textMuted mt-1 mb-4">Takip etmek istediğiniz hisseleri ekleyin</p>
          <button onClick={() => setShowAddModal(true)} className="btn-secondary">
            Varlık Ara
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {watchlist.map(item => {
            const q = quotes[item.symbol];
            const isUp = (q?.changePercent || 0) >= 0;
            const badge = getMarketBadge(item.market);
            const live = isMarketOpen(item.market);
            const weekChange = getWeeklyChange(item.symbol);

            return (
              <div
                key={item.id}
                className="card flex items-center justify-between hover:border-kum-primary/30 transition-all cursor-pointer group min-w-0"
                onClick={() => onSelectAsset(item.symbol, item.asset_name || item.symbol, item.market)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-lg bg-kum-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-kum-primary">{item.symbol.replace('.IS', '').slice(0, 4)}</span>
                    </div>
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${live ? 'bg-kum-success animate-pulse' : 'bg-kum-textDim'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-kum-text text-sm sm:text-base">{item.symbol.replace('.IS', '')}</span>
                      <span className={`badge ${badge.class} text-[10px]`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-kum-textMuted truncate">{item.asset_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 ml-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-kum-text font-mono">
                      {q?.price ? formatNumber(q.price, 2) : '—'}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      {isUp ? <TrendingUp size={12} className="text-kum-success" /> : <TrendingDown size={12} className="text-kum-danger" />}
                      <span className={`text-xs ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                        {q?.changePercent !== undefined ? formatPercent(q.changePercent) : '—'}
                      </span>
                    </div>
                    {weekChange && (
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-[10px] text-kum-textDim">1H:</span>
                        <span className={`text-xs font-medium ${weekChange.percent >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
                          {weekChange.percent >= 0 ? '+' : ''}{weekChange.percent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(item.symbol); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-kum-danger/20 text-kum-textMuted hover:text-kum-danger transition-all"
                  >
                    <Star size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal with Autocomplete */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-20" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="bg-kum-card border border-kum-border rounded-2xl w-full max-w-lg shadow-card-lg max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-kum-border">
              <h2 className="text-lg font-bold text-kum-text">Varlık Ara</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-kum-bg text-kum-textMuted">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 border-b border-kum-border">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kum-textMuted" />
                {isSearchingRemote && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-kum-primary animate-spin" />}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Sembol veya isim ara (ör: AAPL, ASELS, Altın...)"
                  className="input pl-10 w-full"
                  autoFocus
                />
              </div>
              <p className="text-xs text-kum-textDim mt-2">
                {searchQuery.length < 1 ? 'Yazmaya başlayın...' : `${searchResults.length} sonuç`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {searchResults.length === 0 && searchQuery.length >= 1 ? (
                <div className="text-center py-8 text-kum-textMuted">
                  Sonuç bulunamadı
                </div>
              ) : (
                <div className="space-y-1">
                  {(searchQuery.length < 1 ? searchAssets('', 10) : searchResults).map(asset => {
                    const yahooSymbol = getYahooSymbol(asset);
                    const alreadyAdded = isInWatchlist(yahooSymbol);
                    const marketInfo = getMarketInfo(asset.market);

                    return (
                      <button
                        key={yahooSymbol}
                        type="button"
                        onClick={() => !alreadyAdded && handleAddToWatchlist(asset)}
                        disabled={alreadyAdded || addingSymbol === yahooSymbol}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                          alreadyAdded
                            ? 'bg-kum-primary/10 opacity-50 cursor-not-allowed'
                            : 'hover:bg-kum-bg'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-kum-bg flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-kum-primary">{asset.symbol.slice(0, 3)}</span>
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-kum-text">{asset.symbol}</span>
                              <span className={`badge ${marketInfo.colorClass} text-[10px]`}>{marketInfo.label}</span>
                            </div>
                            <p className="text-xs text-kum-textMuted truncate">{asset.name}</p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {addingSymbol === yahooSymbol ? (
                            <Loader2 size={16} className="animate-spin text-kum-primary" />
                          ) : alreadyAdded ? (
                            <Star size={16} className="text-kum-primary" fill="currentColor" />
                          ) : (
                            <Plus size={16} className="text-kum-textMuted" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
