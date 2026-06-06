import { TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import type { AssetWithQuote } from '../types';

interface AssetRowProps {
  asset: AssetWithQuote;
  onDelete: (id: string) => void;
  onSelect: (asset: AssetWithQuote) => void;
}

function fmt(v: number, currency: string) {
  return new Intl.NumberFormat(currency === 'TRY' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

function isMarketOpen(exchange: 'US' | 'BIST'): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcDay = now.getUTCDay(); // 0=Sun,6=Sat
  const isWeekday = utcDay >= 1 && utcDay <= 5;
  if (!isWeekday) return false;

  if (exchange === 'BIST') {
    // BIST: 07:00–15:00 UTC (10:00–18:00 TRT)
    const mins = utcH * 60 + utcM;
    return mins >= 7 * 60 && mins < 15 * 60;
  }
  // US: 13:30–20:00 UTC (NYSE/Nasdaq)
  const mins = utcH * 60 + utcM;
  return mins >= 13 * 60 + 30 && mins < 20 * 60;
}

export default function AssetRow({ asset, onDelete, onSelect }: AssetRowProps) {
  const isProfit = asset.profitLossPercent >= 0;
  const isPriceUp = asset.changePercent >= 0;
  const marketOpen = isMarketOpen(asset.exchange);

  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer"
      onClick={() => onSelect(asset)}
    >
      {/* Ticker badge */}
      <div className="flex-shrink-0 w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
        <span className="text-emerald-700 font-bold text-xs text-center leading-tight">
          {asset.ticker.replace('.IS', '').slice(0, 4)}
        </span>
      </div>

      {/* Name and exchange */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate text-sm">{asset.ticker}</p>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            asset.exchange === 'US'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-orange-50 text-orange-600'
          }`}>
            {asset.exchange === 'US' ? 'NYSE/NQ' : 'BIST'}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            marketOpen
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {marketOpen ? 'CANLI' : 'KAPALI'}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{asset.name} · {asset.quantity} adet</p>
      </div>

      {/* Current price */}
      <div className="hidden sm:block text-right">
        <p className="text-sm font-semibold text-gray-900 tabular-nums">
          {asset.currentPrice > 0
            ? fmt(asset.currentPrice, asset.currency)
            : <span className="text-gray-300">—</span>
          }
        </p>
        {asset.currentPrice > 0 && (
          <div className={`flex items-center gap-0.5 justify-end text-xs font-medium ${
            isPriceUp ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {isPriceUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPriceUp ? '+' : ''}{asset.changePercent.toFixed(2)}%
          </div>
        )}
      </div>

      {/* Total value */}
      <div className="hidden md:block text-right min-w-[100px]">
        <p className="text-sm font-semibold text-gray-900 tabular-nums">
          {asset.currentValueUSD > 0 ? fmt(asset.currentValueUSD, 'USD') : <span className="text-gray-300">—</span>}
        </p>
        <p className="text-xs text-gray-400 tabular-nums">
          {asset.currentValueTRY > 0 ? fmt(asset.currentValueTRY, 'TRY') : ''}
        </p>
      </div>

      {/* P&L */}
      <div className="text-right min-w-[80px]">
        {asset.purchaseValueUSD > 0 && asset.currentValueUSD > 0 ? (
          <>
            <p className={`text-sm font-bold tabular-nums ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
              {isProfit ? '+' : ''}{asset.profitLossPercent.toFixed(2)}%
            </p>
            <p className={`text-xs tabular-nums ${isProfit ? 'text-emerald-500' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}{fmt(asset.profitLossUSD, 'USD')}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-300">—</p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

