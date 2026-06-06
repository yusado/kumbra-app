import { TrendingUp, TrendingDown, DollarSign, Banknote } from 'lucide-react';

interface TotalValueCardProps {
  totalUSD: number;
  totalTRY: number;
  totalCostUSD: number;
  usdTry: number;
  isLoading: boolean;
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
}

function formatTRY(v: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
}

export default function TotalValueCard({ totalUSD, totalTRY, totalCostUSD, usdTry, isLoading }: TotalValueCardProps) {
  const pnl = totalUSD - totalCostUSD;
  const pnlPct = totalCostUSD > 0 ? (pnl / totalCostUSD) * 100 : 0;
  const isProfit = pnl >= 0;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-200">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-24 translate-x-24 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-12 -translate-x-12 pointer-events-none" />

      <div className="relative">
        <p className="text-emerald-100 text-sm font-medium mb-1">Toplam Portföy Değeri</p>

        {isLoading ? (
          <div className="space-y-2 mt-2">
            <div className="h-10 bg-white/20 rounded-lg animate-pulse w-56" />
            <div className="h-5 bg-white/10 rounded animate-pulse w-36" />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                  {formatUSD(totalUSD)}
                </p>
                <p className="text-emerald-100 text-lg mt-1 font-medium tabular-nums">
                  {formatTRY(totalTRY)}
                </p>
              </div>

              {totalCostUSD > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold mb-1 ${
                  isProfit ? 'bg-white/20 text-white' : 'bg-red-500/30 text-red-100'
                }`}>
                  {isProfit
                    ? <TrendingUp size={16} />
                    : <TrendingDown size={16} />
                  }
                  {isProfit ? '+' : ''}{formatUSD(pnl)} ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-6 mt-5 pt-5 border-t border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
            <div>
              <p className="text-emerald-100 text-xs">USD/TRY</p>
              <p className="text-white font-semibold text-sm tabular-nums">
                {usdTry > 0 ? usdTry.toFixed(2) : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Banknote size={14} />
            </div>
            <div>
              <p className="text-emerald-100 text-xs">Maliyet</p>
              <p className="text-white font-semibold text-sm tabular-nums">
                {totalCostUSD > 0 ? formatUSD(totalCostUSD) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
