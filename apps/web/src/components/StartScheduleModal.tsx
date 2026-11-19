import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkloadResponse } from '../lib/types';

interface Props {
  apiBase: '/pm-schedules' | '/predictive-schedules';
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

export function StartScheduleModal({ apiBase, scheduleId, scheduleName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [assignedToId, setAssignedToId] = useState('');
  const [reason, setReason] = useState('');
  const [plannedNotes, setPlannedNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: workload } = useQuery({
    queryKey: ['work-orders-workload'],
    queryFn: async () => (await api.get<WorkloadResponse>('/work-orders/workload')).data,
  });

  const start = useMutation({
    mutationFn: async () =>
      api.post(`${apiBase}/${scheduleId}/start`, {
        assignedToId,
        reason: reason || undefined,
        plannedNotes: plannedNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase.slice(1)] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-open'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-workload'] });
      queryClient.invalidateQueries({ queryKey: [`${apiBase.slice(1)}-history`, scheduleId] });
      onClose();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to start';
      setError(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Start — {scheduleName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start.mutate();
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Who's doing it</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select a technician…</option>
              {workload?.technicians.map((w) => (
                <option key={w.technician.id} value={w.technician.id}>
                  {w.technician.name} ({w.technician.role.name}) — {w.utilizationPct}% utilized
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Reason (only if starting early or late)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. asset unavailable earlier, spares just arrived…"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Planned spares / notes (optional)</label>
            <textarea
              value={plannedNotes}
              onChange={(e) => setPlannedNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={start.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Start
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
