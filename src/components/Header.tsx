import { TrendingUp, PiggyBank, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
}

export default function Header({ onRefresh, isRefreshing, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <PiggyBank className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">Kumbara</span>
            <div className="flex items-center gap-1 -mt-0.5">
              <TrendingUp size={10} className="text-emerald-500" />
              <span className="text-[10px] text-emerald-600 font-medium">Varlık Takip</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} güncellendi
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg hover:bg-emerald-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>
      </div>
    </header>
  );
}
