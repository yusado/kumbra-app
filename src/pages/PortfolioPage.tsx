import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, Trash2, Search, X, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { loadAssets, addAsset, deleteAsset, fetchQuotes, loadSnapshots, formatCurrency, formatPercent, formatNumber, isMarketOpen, getMarketBadge } from '../lib/api';
import { searchAssets, searchAssetsRemote, mergeAssetResults, getMarketInfo, getYahooSymbol, type AssetSearchItem } from '../data/assetUniverse';
import type { Asset, AssetWithQuote, QuotesMap, NewAssetForm, Market } from '../types';

interface PortfolioPageProps {
  quotes: QuotesMap;
  usdTry: number;
  onSelectAsset: (symbol: string, name: string, market: Market) => void;
}

export default function PortfolioPage({ quotes, usdTry, onSelectAsset }: PortfolioPageProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [snapshots, setSnapshots] = useState<{ recorded_at: string; total_value_usd: number }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAssets(), loadSnapshots()])
      .then(([a, s]) => {
        setAssets((a || []) as Asset[]);
        setSnapshots((s || []).map((x: any) => ({ recorded_at: x.recorded_at, total_value_usd: x.total_value_usd })));
      })
      .catch(err => console.error('Load failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // Calculate holdings with quotes
  const holdings: AssetWithQuote[] = assets.map(asset => {
    const yahooTicker = asset.exchange === 'BIST' ? `${asset.ticker.replace(/\.IS$/i, '')}.IS` : asset.ticker;
    const quote = quotes[yahooTicker];
    const currentPrice = quote?.price || asset.purchase_price;
    const currentValueUSD = asset.exchange === 'BIST' ? (currentPrice * asset.quantity) / usdTry : currentPrice * asset.quantity;
    const purchaseValueUSD = asset.exchange === 'BIST' ? (asset.purchase_price * asset.quantity) / usdTry : asset.purchase_price * asset.quantity;
    const profitLossUSD = currentValueUSD - purchaseValueUSD;
    const profitLossPercent = purchaseValueUSD > 0 ? (profitLossUSD / purchaseValueUSD) * 100 : 0;

    return {
      ...asset,
      currentPrice,
      currentValueUSD,
      currentValueTRY: currentValueUSD * usdTry,
      purchaseValueUSD,
      profitLossUSD,
      profitLossPercent,
      changePercent: quote?.changePercent || 0,
    };
  });

  const totalUSD = holdings.reduce((s, a) => s + a.currentValueUSD, 0);
  const totalTRY = totalUSD * usdTry;
  const totalInvested = holdings.reduce((s, a) => s + a.purchaseValueUSD, 0);
  const totalPL = totalUSD - totalInvested;
  const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const handleAddAsset = async (form: NewAssetForm, name: string) => {
    try {
      const newAsset = await addAsset(form, name);
      setAssets([...assets, newAsset]);
      setShowAddModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Portföy varlığı eklenemedi';
      console.error('Add portfolio asset failed:', err);
      alert(message);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAsset(id);
    setAssets(assets.filter(a => a.id !== id));
  };

  // Pie chart data
  const pieData = holdings.map(h => ({
    name: h.ticker,
    value: h.currentValueUSD,
    color: h.exchange === 'BIST' ? '#FF7A00' : '#3B82F6',
  }));

  // Line chart data
  const chartData = snapshots.slice(-30).map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    value: s.total_value_usd * usdTry,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Stats */}
      <div className="card-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted uppercase mb-1">Toplam Portföy Değeri</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-kum-text font-mono truncate">
              {formatCurrency(totalTRY, 'TRY')}
            </h2>
            <p className="text-sm text-kum-textMuted">{formatCurrency(totalUSD, 'USD')}</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center justify-center gap-2 flex-shrink-0">
            <Plus size={18} />
            Varlık Ekle
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Yatırılan</p>
            <p className="text-lg font-bold text-kum-text font-mono truncate">{formatCurrency(totalInvested * usdTry, 'TRY')}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Toplam Kâr/Zarar</p>
            <p className={`text-lg font-bold font-mono truncate ${totalPL >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
              {formatPercent(totalPLPercent)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Hisse Sayısı</p>
            <p className="text-lg font-bold text-kum-text font-mono">{holdings.length}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-kum-textMuted truncate">Bugünkü Değişim</p>
            <p className={`text-lg font-bold font-mono truncate ${holdings.reduce((s, h) => s + h.changePercent, 0) >= 0 ? 'text-kum-success' : 'text-kum-danger'}`}>
              {formatPercent(holdings.reduce((s, h) => s + h.changePercent, 0) / (holdings.length || 1))}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation Pie */}
          <div className="card">
            <h3 className="text-sm font-semibold text-kum-text mb-4">Varlık Dağılımı</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={pieData[i].color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'USD')} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-kum-textMuted">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Value Timeline */}
          {chartData.length > 1 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-kum-text mb-4">Portföy Tarihi</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF7A00" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FF7A00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={50} />
                    <Tooltip formatter={(value: number) => formatCurrency(value, 'TRY')} />
                    <Area type="monotone" dataKey="value" stroke="#FF7A00" strokeWidth={2} fill="url(#portGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Holdings List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-kum-text mb-4">Varlıklarım</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-kum-primary" />
          </div>
        ) : holdings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-kum-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={24} className="text-kum-primary" />
            </div>
            <p className="text-kum-textMuted">Henüz varlık eklenmedi</p>
            <button onClick={() => setShowAddModal(true)} className="btn-secondary mt-4">
              İlk Varlığınızı Ekleyin
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {holdings.map(asset => {
              const isUp = asset.changePercent >= 0;
              const isPL = asset.profitLossPercent >= 0;
              const badge = getMarketBadge(asset.exchange === 'BIST' ? 'BIST' : 'US');
              return (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-kum-bg hover:bg-kum-cardHover transition-colors cursor-pointer group gap-3"
                  onClick={() => onSelectAsset(asset.exchange === 'BIST' ? `${asset.ticker.replace(/\.IS$/i, '')}.IS` : asset.ticker, asset.name, asset.exchange === 'BIST' ? 'BIST' : 'US')}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-lg bg-kum-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-kum-primary">{asset.ticker.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-kum-text">{asset.ticker}</span>
                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-kum-textMuted truncate">{asset.name}</p>
                      <p className="text-xs text-kum-textDim">{formatNumber(asset.quantity, 2)} adet @ {formatNumber(asset.purchase_price, 2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-kum-text font-mono">
                        {asset.currentPrice > 0 ? formatCurrency(asset.currentValueTRY, 'TRY') : '—'}
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {isUp ? <TrendingUp size={12} className="text-kum-success" /> : <TrendingDown size={12} className="text-kum-danger" />}
                        <span className={`text-xs ${isUp ? 'text-kum-success' : 'text-kum-danger'}`}>
                          {formatPercent(asset.changePercent)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right w-20">
                      <p className={`text-sm font-semibold ${isPL ? 'text-kum-success' : 'text-kum-danger'}`}>
                        {formatPercent(asset.profitLossPercent)}
                      </p>
                      <p className={`text-xs ${isPL ? 'text-kum-success' : 'text-kum-danger'}`}>
                        {formatCurrency(asset.profitLossUSD, 'USD')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-kum-danger/20 text-kum-textMuted hover:text-kum-danger transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddAssetModal onClose={() => setShowAddModal(false)} onSubmit={handleAddAsset} />
      )}
    </div>
  );
}

// Add Asset Modal with Autocomplete
function AddAssetModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (form: NewAssetForm, name: string) => void }) {
  const [form, setForm] = useState<NewAssetForm>({ ticker: '', exchange: 'US', quantity: '', purchase_price: '' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchItem | null>(null);
  const [remoteResults, setRemoteResults] = useState<AssetSearchItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

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
      const rows = await searchAssetsRemote(q, 'ALL', 20);
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

  const searchResults = searchQuery.length >= 1
    ? mergeAssetResults(searchAssets(searchQuery, 20), remoteResults).slice(0, 20)
    : [];

  const handleSelectAsset = (asset: AssetSearchItem) => {
    setSelectedAsset(asset);
    setForm(f => ({
      ...f,
      ticker: asset.symbol,
      exchange: asset.market === 'BIST' ? 'BIST' : 'US',
    }));
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker.trim()) return;
    setLoading(true);
    try {
      const name = selectedAsset?.name || form.ticker;
      await onSubmit(form, name);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-kum-card border border-kum-border rounded-2xl w-full max-w-md shadow-card-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-kum-border">
          <h2 className="text-lg font-bold text-kum-text">Yeni Varlık Ekle</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-kum-bg text-kum-textMuted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Autocomplete Search */}
          <div>
            <label className="text-xs text-kum-textMuted mb-1.5 block">Varlık Ara</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kum-textMuted" />
              {isSearchingRemote && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-kum-primary animate-spin" />}
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sembol veya isim ara..."
                className="input pl-10 w-full"
                disabled={!!selectedAsset}
              />
            </div>
            {searchResults.length > 0 && !selectedAsset && (
              <div className="mt-2 bg-kum-bg border border-kum-border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map(asset => {
                  const info = getMarketInfo(asset.market);
                  return (
                    <button
                      key={asset.symbol}
                      type="button"
                      onClick={() => handleSelectAsset(asset)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-kum-cardHover text-left"
                    >
                      <div className="w-8 h-8 rounded bg-kum-card flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-kum-primary">{asset.symbol.slice(0, 3)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-kum-text">{asset.symbol}</span>
                          <span className={`badge ${info.colorClass} text-[10px]`}>{info.label}</span>
                        </div>
                        <p className="text-xs text-kum-textMuted truncate">{asset.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedAsset && (
              <div className="mt-2 p-3 bg-kum-primary/10 border border-kum-primary/30 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-medium text-kum-text">{selectedAsset.symbol}</span>
                  <span className="text-xs text-kum-textMuted ml-2">{selectedAsset.name}</span>
                </div>
                <button type="button" onClick={() => { setSelectedAsset(null); setForm(f => ({ ...f, ticker: '', exchange: 'US' })); }} className="text-kum-textMuted hover:text-kum-text">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-kum-textMuted mb-1.5 block">Adet</label>
              <input
                type="number"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="input"
                placeholder="10"
                required
                min="0"
                step="0.0001"
              />
            </div>
            <div>
              <label className="text-xs text-kum-textMuted mb-1.5 block">
                Alış Fiyatı ({selectedAsset?.currency || (form.exchange === 'BIST' ? 'TL' : 'USD')})
              </label>
              <input
                type="number"
                value={form.purchase_price}
                onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                className="input"
                placeholder="100.00"
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !form.ticker} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Ekleniyor...' : 'Varlık Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
