import { useState } from 'react';
import { X, Search, AlertCircle } from 'lucide-react';
import type { NewAssetForm, Exchange } from '../types';

interface AddAssetModalProps {
  onClose: () => void;
  onSubmit: (form: NewAssetForm) => Promise<void>;
}

const POPULAR_US = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'GOOGL'];
const POPULAR_BIST = ['GARAN', 'THYAO', 'ASELS', 'EREGL', 'BIMAS', 'SISE'];

export default function AddAssetModal({ onClose, onSubmit }: AddAssetModalProps) {
  const [form, setForm] = useState<NewAssetForm>({
    ticker: '',
    exchange: 'US',
    quantity: '',
    purchase_price: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const popular = form.exchange === 'US' ? POPULAR_US : POPULAR_BIST;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticker.trim()) return setError('Ticker sembolü gerekli.');
    if (!form.quantity || parseFloat(form.quantity) <= 0) return setError('Geçerli bir adet girin.');
    if (!form.purchase_price || parseFloat(form.purchase_price) <= 0) return setError('Geçerli bir fiyat girin.');

    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Yeni Varlık Ekle</h2>
            <p className="text-xs text-gray-400 mt-0.5">Portföyünüze hisse senedi ekleyin</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Exchange selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Borsa</label>
            <div className="grid grid-cols-2 gap-2">
              {(['US', 'BIST'] as Exchange[]).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, exchange: ex, ticker: '' }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.exchange === ex
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  {ex === 'US' ? 'Nasdaq / NYSE' : 'Borsa Istanbul'}
                </button>
              ))}
            </div>
          </div>

          {/* Ticker input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Ticker Sembolü
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder={form.exchange === 'US' ? 'AAPL, MSFT, TSLA...' : 'GARAN, THYAO...'}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 uppercase placeholder:normal-case"
              />
            </div>
            {/* Popular tickers */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {popular.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, ticker: t }))}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                    form.ticker === t
                      ? 'bg-emerald-100 text-emerald-700 font-medium'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Adet</label>
              <input
                type="number"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                min="0"
                step="0.0001"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Alış Fiyatı ({form.exchange === 'BIST' ? 'TRY' : 'USD'})
              </label>
              <input
                type="number"
                value={form.purchase_price}
                onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm shadow-emerald-200"
          >
            {loading ? 'Ekleniyor...' : 'Varlık Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
}
