import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import type { PredictiveHeatmapAssetEntry, PredictiveHeatmapGroup } from '../lib/types';

const TILE_CLASSES: Record<string, string> = {
  NORMAL: 'bg-transparent border-gray-200 hover:bg-gray-50 text-gray-700 hover:border-gray-300',
  WARNING: 'bg-amber-100/90 border-amber-400 hover:bg-amber-200 text-amber-950 font-semibold shadow-xs',
  CRITICAL: 'bg-rose-100 border-rose-400 hover:bg-rose-200 text-rose-950 font-bold shadow-sm ring-1 ring-rose-300',
};

function AssetDetailModal({ entry, onClose }: { entry: PredictiveHeatmapAssetEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {entry.asset.tag} — {entry.asset.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <p className="mb-1 text-xs font-medium text-gray-500">Latest check-point readings</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500">
              <th className="py-1">Check point</th>
              <th className="py-1">Value</th>
              <th className="py-1">Status</th>
              <th className="py-1">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {entry.checkPoints.map((cp) => (
              <tr key={cp.label} className={`border-b border-gray-50 ${cp.status !== 'NORMAL' ? 'bg-red-50/50' : ''}`}>
                <td className="py-1">{cp.label}</td>
                <td className="py-1">{cp.value}</td>
                <td className="py-1">
                  <StatusBadge status={cp.status} />
                </td>
                <td className="py-1 text-xs text-gray-500">{new Date(cp.recordedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PredictiveHeatmapPage() {
  const [selected, setSelected] = useState<PredictiveHeatmapAssetEntry | null>(null);
  const [mode, setMode] = useState<'status' | 'deviations'>('status');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['predictive-heatmap', mode],
    queryFn: async () => (await api.get<PredictiveHeatmapGroup[]>('/predictive/heatmap', { params: { mode } })).data,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Predictive Heatmap</h1>
        <div className="flex rounded-md border border-gray-300 text-sm">
          <button
            onClick={() => setMode('status')}
            className={`rounded-l-md px-3 py-1.5 ${mode === 'status' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Reading Status
          </button>
          <button
            onClick={() => setMode('deviations')}
            className={`rounded-r-md px-3 py-1.5 ${mode === 'deviations' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Deviations
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-gray-300 bg-transparent" /> Normal (No Action Needed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-amber-400 bg-amber-200" /> Action: Warning Threshold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-rose-400 bg-rose-200" /> Action: Critical Alert
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-sm text-gray-500">{mode === 'status' ? 'No predictive readings logged yet.' : 'No deviation notes in the last 180 days.'}</p>
      ) : (
        groups.map((group) => (
          <div key={group.locationId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{group.locationName}</h2>
            <div className="flex flex-wrap gap-3">
              {group.assets.map((entry) => (
                <button
                  key={entry.asset.id}
                  onClick={() => setSelected(entry)}
                  className={`w-40 rounded-lg border p-3 text-left transition-colors ${TILE_CLASSES[entry.worstStatus]}`}
                >
                  <p className="text-sm font-medium text-gray-900">{entry.asset.tag}</p>
                  <p className="text-xs text-gray-600">{entry.asset.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {mode === 'status' ? `${entry.checkPoints.length} check point(s)` : `${entry.deviationCount ?? 0} deviation(s)`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {selected && mode === 'status' && <AssetDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
