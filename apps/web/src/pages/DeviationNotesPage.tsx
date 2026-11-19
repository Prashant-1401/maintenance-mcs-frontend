import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_MANAGEMENT, hasTier } from '../lib/roles';
import { StatusBadge } from '../components/StatusBadge';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { useTableFilters, type FilterColumn } from '../lib/useTableFilters';
import type { DeviationNote, DeviationNoteStatus, WorkOrderType } from '../lib/types';

const STATUSES: DeviationNoteStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export function DeviationNotesPage() {
  const { user } = useAuth();
  const canApprove = hasTier(user?.tier, ADMIN_MANAGEMENT);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = (searchParams.get('type') as WorkOrderType | null) ?? '';
  const [statusFilter, setStatusFilter] = useState<DeviationNoteStatus | ''>('PENDING');

  const { data: notes, isLoading } = useQuery({
    queryKey: ['deviation-notes', typeFilter, statusFilter],
    queryFn: async () =>
      (
        await api.get<DeviationNote[]>('/deviation-notes', {
          params: { type: typeFilter || undefined, status: statusFilter || undefined },
        })
      ).data,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => api.patch(`/deviation-notes/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviation-notes'] });
      queryClient.invalidateQueries({ queryKey: ['pm-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['predictive-schedules'] });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => api.patch(`/deviation-notes/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deviation-notes'] }),
  });

  const filterColumns: FilterColumn<DeviationNote>[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', type: 'text', getValue: (n) => `${n.workOrder?.asset?.tag ?? ''} ${n.workOrder?.asset?.name ?? ''}`.trim() },
      { key: 'reason', label: 'Reason', type: 'text', getValue: (n) => n.reason },
      { key: 'raisedBy', label: 'Raised by', type: 'select', getValue: (n) => n.raisedBy?.name ?? '' },
    ],
    [],
  );
  const tableFilters = useTableFilters(notes ?? [], filterColumns);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Deviation Notes</h1>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setSearchParams(e.target.value ? { type: e.target.value } : {})}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All types</option>
            <option value="PM">Preventive</option>
            <option value="PREDICTIVE">Predictive</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeviationNoteStatus | '')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notes && notes.length > 0 && (
        <ColumnFilterBar
          columns={filterColumns}
          rows={notes}
          values={tableFilters.values}
          onChange={tableFilters.setValue}
          onClear={tableFilters.clear}
          active={tableFilters.active}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : notes?.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No deviation notes.</p>
        ) : tableFilters.filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No deviation notes match the current filters.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Asset</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Original due</th>
                <th className="px-4 py-2">Proposed</th>
                <th className="px-4 py-2">Raised by</th>
                <th className="px-4 py-2">Status</th>
                {canApprove && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {tableFilters.filtered.map((n) => (
                <tr key={n.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    {n.workOrder?.asset?.tag ?? '—'} — {n.workOrder?.asset?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2">{n.workOrder?.type === 'PM' ? 'Preventive' : 'Predictive'}</td>
                  <td className="px-4 py-2">{n.reason}</td>
                  <td className="px-4 py-2">{new Date(n.originalDueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{new Date(n.proposedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{n.raisedBy?.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={n.status} />
                  </td>
                  {canApprove && (
                    <td className="px-4 py-2">
                      {n.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button onClick={() => approve.mutate(n.id)} className="text-green-600 hover:underline">
                            Approve
                          </button>
                          <button onClick={() => reject.mutate(n.id)} className="text-red-600 hover:underline">
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
