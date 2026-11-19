import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { ADMIN_MANAGEMENT, hasTier } from '../lib/roles';
import { useTableFilters, type FilterColumn } from '../lib/useTableFilters';
import type { WorkOrder, WorkloadResponse } from '../lib/types';

type Bucket = 'PM' | 'PREDICTIVE' | 'MECHANICAL_BREAKDOWN' | 'ELECTRICAL_BREAKDOWN' | 'OTHER_BREAKDOWN';

const BUCKET_ORDER: { key: Bucket; label: string }[] = [
  { key: 'PM', label: 'PM' },
  { key: 'PREDICTIVE', label: 'Predictive' },
  { key: 'MECHANICAL_BREAKDOWN', label: 'Mechanical Breakdown' },
  { key: 'ELECTRICAL_BREAKDOWN', label: 'Electrical Breakdown' },
  { key: 'OTHER_BREAKDOWN', label: 'Other Breakdown' },
];

function bucketOf(wo: WorkOrder): Bucket {
  if (wo.type === 'PM') return 'PM';
  if (wo.type === 'PREDICTIVE') return 'PREDICTIVE';
  const category = wo.breakdownDetail?.failureCategory;
  if (category === 'MECHANICAL') return 'MECHANICAL_BREAKDOWN';
  if (category === 'ELECTRICAL') return 'ELECTRICAL_BREAKDOWN';
  return 'OTHER_BREAKDOWN';
}

function utilizationColor(pct: number) {
  if (pct >= 100) return 'text-red-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-green-600';
}

export function OpenOrdersPage() {
  const { user } = useAuth();
  const canReassign = hasTier(user?.tier, ADMIN_MANAGEMENT);
  const queryClient = useQueryClient();
  const [assigningOrder, setAssigningOrder] = useState<WorkOrder | null>(null);

  const { data: openOrders, isLoading } = useQuery({
    queryKey: ['work-orders-open'],
    queryFn: async () => (await api.get<WorkOrder[]>('/work-orders/open')).data,
  });
  const { data: workload } = useQuery({
    queryKey: ['work-orders-workload'],
    queryFn: async () => (await api.get<WorkloadResponse>('/work-orders/workload')).data,
  });

  const assign = useMutation({
    mutationFn: async ({ id, assignedToId }: { id: string; assignedToId: string | null }) =>
      api.patch(`/work-orders/${id}/assign`, { assignedToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders-open'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-workload'] });
      setAssigningOrder(null);
    },
  });

  const detailPath = (wo: WorkOrder) => {
    if (wo.type === 'BREAKDOWN') return `/breakdowns/${wo.id}`;
    if (wo.type === 'PREDICTIVE') return `/predictive-work-orders/${wo.id}`;
    return `/pm-work-orders/${wo.id}`;
  };

  const filterColumns: FilterColumn<WorkOrder>[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', type: 'text', getValue: (wo) => `${wo.asset?.tag ?? ''} ${wo.asset?.name ?? ''}`.trim() },
      { key: 'assignedTo', label: 'Assigned to', type: 'select', getValue: (wo) => wo.assignedTo?.name ?? 'Unassigned' },
      { key: 'status', label: 'Status', type: 'select', getValue: (wo) => wo.status },
    ],
    [],
  );
  const tableFilters = useTableFilters(openOrders ?? [], filterColumns);

  const grouped = useMemo(() => {
    const map = new Map<Bucket, WorkOrder[]>();
    for (const b of BUCKET_ORDER) map.set(b.key, []);
    for (const wo of tableFilters.filtered) map.get(bucketOf(wo))!.push(wo);
    return map;
  }, [tableFilters.filtered]);

  const unassignedTotal =
    (workload?.unassignedByType.PM ?? 0) + (workload?.unassignedByType.PREDICTIVE ?? 0) + (workload?.unassignedByType.BREAKDOWN ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Open Orders</h1>

      {workload && workload.technicians.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Technician Workload</h2>
            {unassignedTotal > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {unassignedTotal} unassigned ({workload.unassignedByType.PM} PM, {workload.unassignedByType.PREDICTIVE} Predictive,{' '}
                {workload.unassignedByType.BREAKDOWN} Breakdown)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {workload.technicians.map((w) => (
              <div key={w.technician.id} className="rounded-md border border-gray-100 p-3">
                <p className="text-sm font-medium text-gray-900">{w.technician.name}</p>
                <p className="text-xs text-gray-500">{w.technician.role.name}</p>
                <p className="mt-1 text-lg font-semibold">
                  {w.totalCount} <span className="text-xs font-normal text-gray-400">/ {w.capacity} active</span>
                </p>
                <p className="text-xs text-gray-500">
                  {w.openCount} open, {w.attendedCount} in progress
                </p>
                <p className={`text-xs font-semibold ${utilizationColor(w.utilizationPct)}`}>{w.utilizationPct}% utilized</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {openOrders && openOrders.length > 0 && (
        <ColumnFilterBar
          columns={filterColumns}
          rows={openOrders}
          values={tableFilters.values}
          onChange={tableFilters.setValue}
          onClear={tableFilters.clear}
          active={tableFilters.active}
        />
      )}

      {isLoading ? (
        <p className="p-4 text-sm text-gray-500">Loading…</p>
      ) : openOrders?.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          No open work orders — all caught up.
        </p>
      ) : tableFilters.filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          No open work orders match the current filters.
        </p>
      ) : (
        BUCKET_ORDER.map(({ key, label }) => {
          const rows = grouped.get(key) ?? [];
          if (rows.length === 0) return null;
          return (
            <div key={key} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  {label} <span className="font-normal text-gray-400">({rows.length})</span>
                </h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-4 py-2">Asset</th>
                    <th className="px-4 py-2">Summary</th>
                    <th className="px-4 py-2">Assigned to</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((wo) => (
                    <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {wo.asset?.tag} — {wo.asset?.name}
                      </td>
                      <td className="px-4 py-2">{wo.breakdownDetail?.symptom ?? '—'}</td>
                      <td className="px-4 py-2">
                        {canReassign ? (
                          <button onClick={() => setAssigningOrder(wo)} className="text-indigo-600 hover:underline">
                            {wo.assignedTo?.name ?? 'Unassigned — assign'}
                          </button>
                        ) : (
                          wo.assignedTo?.name ?? '—'
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="px-4 py-2">
                        <Link to={detailPath(wo)} className="text-indigo-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {assigningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setAssigningOrder(null)}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Assign — {assigningOrder.asset?.tag ?? 'Asset'} ({assigningOrder.type})
              </h3>
              <button onClick={() => setAssigningOrder(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-500">Choose a technician. Current utilization shown live.</p>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              <button
                onClick={() => assign.mutate({ id: assigningOrder.id, assignedToId: null })}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span className="text-gray-500">Unassigned</span>
              </button>
              {(workload?.technicians ?? []).map((w) => (
                <button
                  key={w.technician.id}
                  onClick={() => assign.mutate({ id: assigningOrder.id, assignedToId: w.technician.id })}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-gray-50 ${
                    assigningOrder.assignedTo?.id === w.technician.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <span>
                    <span className="font-medium text-gray-900">{w.technician.name}</span>{' '}
                    <span className="text-xs text-gray-500">({w.technician.role.name})</span>
                  </span>
                  <span className={`text-xs font-semibold ${utilizationColor(w.utilizationPct)}`}>
                    {w.utilizationPct}% ({w.totalCount}/{w.capacity})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
