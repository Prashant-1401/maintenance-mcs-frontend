import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import type { KpiMetric, KpiTrendValuePoint } from '../lib/types';

interface Props {
  metric: KpiMetric;
  label: string;
  isPercent?: boolean;
  unitSuffix?: string;
  range: { from: string; to: string };
  granularity: 'day' | 'month';
  onClose: () => void;
}

export function KpiTrendModal({ metric, label, isPercent, unitSuffix, range, granularity, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['kpi-trend', metric, range.from, range.to, granularity],
    queryFn: async () =>
      (await api.get<KpiTrendValuePoint[]>('/kpi/kpi-trend', { params: { metric, ...range, granularity } })).data,
  });

  const formatted = data?.map((d) => ({ ...d, displayValue: d.value == null ? 0 : isPercent ? Math.round(d.value * 100) : Math.round(d.value * 10) / 10 }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{label} Trend</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          {range.from} → {range.to}
        </p>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !formatted || formatted.length === 0 ? (
          <p className="text-sm text-gray-500">No data in this range.</p>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={formatted} margin={{ bottom: 24, left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} label={{ value: 'Period', position: 'insideBottom', offset: -16 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  unit={isPercent ? '%' : unitSuffix}
                  label={{ value: `${label}${isPercent ? ' (%)' : unitSuffix ?? ''}`, angle: -90, position: 'insideLeft' }}
                />
                <Tooltip formatter={(v) => [`${v}${isPercent ? '%' : unitSuffix ?? ''}`, label]} />
                <Bar dataKey="displayValue" name={label} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
