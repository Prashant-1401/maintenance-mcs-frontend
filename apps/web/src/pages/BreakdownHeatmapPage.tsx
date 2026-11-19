import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import type { BreakdownHeatmapAssetEntry, BreakdownHeatmapGroup, BreakdownHistory } from '../lib/types';

const TILE_CLASSES: Record<string, string> = {
  NORMAL: 'bg-transparent border-gray-200 hover:bg-gray-50 text-gray-700 hover:border-gray-300',
  WARNING: 'bg-amber-100/90 border-amber-400 hover:bg-amber-200 text-amber-950 font-semibold shadow-xs',
  CRITICAL: 'bg-rose-100 border-rose-400 hover:bg-rose-200 text-rose-950 font-bold shadow-sm ring-1 ring-rose-300',
};

function AssetDetailModal({ entry, onClose }: { entry: BreakdownHeatmapAssetEntry; onClose: () => void }) {
  const { data: history } = useQuery({
    queryKey: ['breakdown-history-asset', entry.asset.id],
    queryFn: async () => (await api.get<BreakdownHistory>(`/breakdowns/asset/${entry.asset.id}/history`)).data,
  });

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

        <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Breakdowns</p>
            <p className="font-semibold text-gray-900">{entry.breakdownCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">MTTR</p>
            <p className="font-semibold text-gray-900">{entry.mttrMinutes != null ? `${Math.round(entry.mttrMinutes)} min` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">MTBF</p>
            <p className="font-semibold text-gray-900">{entry.mtbfDays != null ? `${entry.mtbfDays.toFixed(1)} days` : '—'}</p>
          </div>
        </div>

        <p className="mb-1 text-xs font-medium text-gray-500">History</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500">
              <th className="py-1">Occurred</th>
              <th className="py-1">Symptom</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {history?.breakdowns.map((wo) => (
              <tr key={wo.id} className="border-b border-gray-50">
                <td className="py-1">{wo.breakdownDetail ? new Date(wo.breakdownDetail.occurredAt).toLocaleString() : '—'}</td>
                <td className="py-1">{wo.breakdownDetail?.symptom}</td>
                <td className="py-1">
                  <StatusBadge status={wo.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BreakdownHeatmapPage() {
  const [selected, setSelected] = useState<BreakdownHeatmapAssetEntry | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['breakdown-heatmap'],
    queryFn: async () => (await api.get<BreakdownHeatmapGroup[]>('/breakdowns/heatmap')).data,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Breakdown Heatmap</h1>
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-gray-300 bg-transparent" /> Normal (0–1 breakdowns)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-amber-400 bg-amber-200" /> Action: Warning (2 breakdowns)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-rose-400 bg-rose-200" /> Action: Critical (3+ breakdowns)
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-sm text-gray-500">No breakdown history yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.locationId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{group.locationName}</h2>
            <div className="flex flex-wrap gap-3">
              {group.assets.map((entry) => (
                <button
                  key={entry.asset.id}
                  onClick={() => setSelected(entry)}
                  className={`w-44 rounded-lg border p-3 text-left transition-colors ${TILE_CLASSES[entry.worstStatus]}`}
                >
                  <p className="text-sm font-medium text-gray-900">{entry.asset.tag}</p>
                  <p className="text-xs text-gray-600">{entry.asset.name}</p>
                  <p className="mt-1 text-xs text-gray-700">{entry.breakdownCount} breakdown(s)</p>
                  <p className="text-xs text-gray-500">
                    MTTR {entry.mttrMinutes != null ? `${Math.round(entry.mttrMinutes)}m` : '—'} · MTBF{' '}
                    {entry.mtbfDays != null ? `${entry.mtbfDays.toFixed(1)}d` : '—'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {selected && <AssetDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
