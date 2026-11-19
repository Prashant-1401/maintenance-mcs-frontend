import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import type { PmSchedule, PreventiveHeatmapAssetEntry, PreventiveHeatmapGroup, WorkOrder } from '../lib/types';

const TILE_CLASSES: Record<string, string> = {
  DONE: 'bg-transparent border-gray-200 hover:bg-gray-50 text-gray-700 hover:border-gray-300',
  PARTIAL: 'bg-amber-100/90 border-amber-400 hover:bg-amber-200 text-amber-950 font-semibold shadow-xs',
  NOT_DONE: 'bg-rose-100 border-rose-400 hover:bg-rose-200 text-rose-950 font-bold shadow-sm ring-1 ring-rose-300',
};

function ScheduleHistoryRow({ schedule }: { schedule: PmSchedule }) {
  const { data: history } = useQuery({
    queryKey: ['pm-schedules-history', schedule.id],
    queryFn: async () => (await api.get<WorkOrder[]>(`/pm-schedules/${schedule.id}/history`)).data,
  });

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-gray-700">{schedule.name}</p>
      {!history || history.length === 0 ? (
        <p className="text-xs text-gray-400">No instances yet.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1">Due</th>
              <th className="py-1">Status</th>
              <th className="py-1">Completed</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 5).map((wo) => (
              <tr key={wo.id} className="border-t border-gray-100">
                <td className="py-1">{wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '—'}</td>
                <td className="py-1">
                  <StatusBadge status={wo.status} />
                </td>
                <td className="py-1">{wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AssetDetailModal({ entry, onClose }: { entry: PreventiveHeatmapAssetEntry; onClose: () => void }) {
  const { data: schedules } = useQuery({
    queryKey: ['pm-schedules'],
    queryFn: async () => (await api.get<PmSchedule[]>('/pm-schedules')).data,
  });
  const assetSchedules = schedules?.filter((s) => s.asset?.id === entry.asset.id) ?? [];

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
        <p className="mb-3 text-xs text-gray-500">
          Current cycle: <StatusBadge status={entry.status} />
        </p>
        {assetSchedules.length === 0 ? (
          <p className="text-sm text-gray-500">No PM schedules for this asset.</p>
        ) : (
          assetSchedules.map((s) => <ScheduleHistoryRow key={s.id} schedule={s} />)
        )}
      </div>
    </div>
  );
}

export function PreventiveHeatmapPage() {
  const [selected, setSelected] = useState<PreventiveHeatmapAssetEntry | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['preventive-heatmap'],
    queryFn: async () => (await api.get<PreventiveHeatmapGroup[]>('/pm-schedules/reports/heatmap')).data,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Preventive Heatmap</h1>
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-gray-300 bg-transparent" /> Done (No Action Needed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-amber-400 bg-amber-200" /> Action: Partial / Due Soon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-rose-400 bg-rose-200" /> Action: Overdue / Not Done
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-sm text-gray-500">No active PM schedules yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.locationId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{group.locationName}</h2>
            <div className="flex flex-wrap gap-3">
              {group.assets.map((entry) => (
                <button
                  key={entry.asset.id}
                  onClick={() => setSelected(entry)}
                  className={`w-40 rounded-lg border p-3 text-left transition-colors ${TILE_CLASSES[entry.status]}`}
                >
                  <p className="text-sm font-medium text-gray-900">{entry.asset.tag}</p>
                  <p className="text-xs text-gray-600">{entry.asset.name}</p>
                  <p className="mt-1 text-xs font-medium text-gray-700">{entry.status.replace('_', ' ')}</p>
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
