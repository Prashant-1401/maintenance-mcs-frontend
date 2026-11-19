import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Props {
  apiBase: '/pm-schedules' | '/predictive-schedules';
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
}

export function DelayScheduleModal({ apiBase, scheduleId, scheduleName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const delay = useMutation({
    mutationFn: async () => api.post(`${apiBase}/${scheduleId}/delay`, { reason, proposedDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase.slice(1)] });
      queryClient.invalidateQueries({ queryKey: ['deviation-notes'] });
      setSuccess(true);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to raise deviation note';
      setError(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Delay — {scheduleName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {success ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              Deviation note submitted — the due date won't change until a Manager/Admin approves it.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              delay.mutate();
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs text-gray-500">
              This submits a deviation note for approval — it does not change the due date by itself.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Reason for delay</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Proposed new date</label>
              <input
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                required
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
                disabled={delay.isPending}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Submit deviation note
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
