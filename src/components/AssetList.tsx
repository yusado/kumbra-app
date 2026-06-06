import type { AssetWithQuote } from '../types';
import AssetRow from './AssetRow';
import { Plus } from 'lucide-react';

interface AssetListProps {
  assets: AssetWithQuote[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  onSelect: (asset: AssetWithQuote) => void;
}

export default function AssetList({ assets, onDelete, onAdd, onSelect }: AssetListProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="font-semibold text-gray-900">Varlıklarım</h2>
          <p className="text-xs text-gray-400 mt-0.5">{assets.length} hisse senedi</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm shadow-emerald-200"
        >
          <Plus size={15} />
          Varlık Ekle
        </button>
      </div>

      <div className="px-2 pb-3">
        {assets.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Plus size={22} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Henüz varlık eklenmedi</p>
            <p className="text-xs mt-1">Portföyünüzü oluşturmak için varlık ekleyin.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} onDelete={onDelete} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
