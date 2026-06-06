import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PortfolioSnapshot } from '../types';

interface PortfolioLineChartProps {
  snapshots: PortfolioSnapshot[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold text-gray-900">
        ${payload[0].value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

export default function PortfolioLineChart({ snapshots }: PortfolioLineChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between h-64">
        <div>
          <h2 className="font-semibold text-gray-900 mb-1">Değer Geçmişi</h2>
          <p className="text-xs text-gray-400">30 günlük portföy değeri</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-300 text-sm">Yeterli veri yok</p>
        </div>
      </div>
    );
  }

  const data = snapshots.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
    value: parseFloat(s.total_value_usd.toFixed(2)),
  }));

  const minVal = Math.min(...data.map(d => d.value));
  const maxVal = Math.max(...data.map(d => d.value));
  const padding = (maxVal - minVal) * 0.1 || 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Değer Geçmişi</h2>
      <p className="text-xs text-gray-400 mb-4">30 günlük portföy değeri (USD)</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#lineGradient)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#059669', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
