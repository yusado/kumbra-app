import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AssetWithQuote } from '../types';

const COLORS = [
  '#059669', '#10b981', '#34d399', '#6ee7b7',
  '#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4',
  '#0891b2', '#06b6d4',
];

interface PortfolioPieChartProps {
  assets: AssetWithQuote[];
}

interface ChartEntry {
  name: string;
  value: number;
  pct: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartEntry;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{d.name}</p>
      <p className="text-gray-500">${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
      <p className="text-emerald-600 font-medium">{d.pct.toFixed(1)}%</p>
    </div>
  );
}

export default function PortfolioPieChart({ assets }: PortfolioPieChartProps) {
  const total = assets.reduce((s, a) => s + a.currentValueUSD, 0);

  const data: ChartEntry[] = assets
    .filter(a => a.currentValueUSD > 0)
    .map(a => ({
      name: a.ticker,
      value: parseFloat(a.currentValueUSD.toFixed(2)),
      pct: total > 0 ? (a.currentValueUSD / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center h-64">
        <p className="text-gray-300 text-sm">Veri yok</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Dağılım</h2>
      <p className="text-xs text-gray-400 mb-4">Portföy ağırlıkları</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs text-gray-600 font-medium">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
