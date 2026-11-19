import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { KanbanBoard, type KanbanColumn } from '../components/KanbanBoard';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { usePersistedState } from '../lib/usePersistedState';
import { useTableFilters, type FilterColumn } from '../lib/useTableFilters';
import type { Asset, PendingJobSheetItem, PendingJobSheetStatus, UserRef } from '../lib/types';

const STATUSES: PendingJobSheetStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE'];
const COLUMNS: KanbanColumn[] = STATUSES.map((s) => ({ key: s, label: s.replace('_', ' ') }));

function sourcePath(item: PendingJobSheetItem): string | null {
  if (!item.workOrderId) return null;
  if (item.workOrder?.type === 'PM') return `/pm-work-orders/${item.workOrderId}`;
  if (item.workOrder?.type === 'PREDICTIVE') return `/predictive-work-orders/${item.workOrderId}`;
  return `/breakdowns/${item.workOrderId}`;
}

export function PendingJobSheetPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = usePersistedState<'list' | 'kanban'>('pending-job-sheet-view', 'list');
  const [showForm, setShowForm] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ['pending-job-sheet', statusFilter],
    queryFn: async () =>
      (await api.get<PendingJobSheetItem[]>('/pending-job-sheet', { params: statusFilter ? { status: statusFilter } : {} })).data,
  });
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserRef[]>('/users')).data,
  });
  const technicians = users?.filter((u) => u.role.tier === 'TECHNICIAN') ?? [];

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PendingJobSheetStatus }) =>
      api.patch(`/pending-job-sheet/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-job-sheet'] }),
  });

  const filterColumns: FilterColumn<PendingJobSheetItem>[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', type: 'text', getValue: (item) => item.asset?.tag ?? '' },
      { key: 'assignedTo', label: 'Assigned to', type: 'select', getValue: (item) => item.assignedTo?.name ?? 'Unassigned' },
    ],
    [],
  );
  const tableFilters = useTableFilters(items ?? [], filterColumns);

  const [assetId, setAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const createItem = useMutation({
    mutationFn: async () =>
      api.post('/pending-job-sheet', {
        assetId,
        description,
        assignedToId: assignedToId || undefined,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-job-sheet'] });
      setShowForm(false);
      setAssetId('');
      setDescription('');
      setAssignedToId('');
      setDueDate('');
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Pending Job Sheet</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 text-sm">
            <button
              onClick={() => setView('list')}
              className={`rounded-l-md px-3 py-1.5 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`rounded-r-md px-3 py-1.5 ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Kanban
            </button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + New Action
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createItem.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Asset</label>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Select…</option>
              {assets?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">Action / description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Assign to</label>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Unassigned</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save
          </button>
        </form>
      )}

      {items && items.length > 0 && (
        <ColumnFilterBar
          columns={filterColumns}
          rows={items}
          values={tableFilters.values}
          onChange={tableFilters.setValue}
          onClear={tableFilters.clear}
          active={tableFilters.active}
        />
      )}

      {isLoading ? (
        <p className="p-4 text-sm text-gray-500">Loading…</p>
      ) : items?.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">No pending actions.</p>
      ) : tableFilters.filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">No actions match the current filters.</p>
      ) : view === 'kanban' ? (
        <KanbanBoard
          columns={COLUMNS}
          items={tableFilters.filtered}
          getId={(item) => item.id}
          getStatus={(item) => item.status}
          onMove={(item, status) => updateStatus.mutate({ id: item.id, status: status as PendingJobSheetStatus })}
          renderCard={(item) => {
            const path = sourcePath(item);
            return (
              <div>
                <p className="font-medium text-gray-900">{item.asset?.tag ?? '—'}</p>
                <p className="text-gray-700">{item.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Raised by {item.raisedBy?.name ?? '—'}
                  {item.assignedTo && <> · Assigned to {item.assignedTo.name}</>}
                  {item.dueDate && <> · Due {new Date(item.dueDate).toLocaleDateString()}</>}
                </p>
                {path && (
                  <Link to={path} className="text-xs text-indigo-600 hover:underline">
                    Source
                  </Link>
                )}
              </div>
            );
          }}
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Asset</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Raised by</th>
                <th className="px-4 py-2">Assigned to</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Update</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tableFilters.filtered.map((item) => {
                const path = sourcePath(item);
                return (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">{item.asset?.tag ?? '—'}</td>
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2">{item.raisedBy?.name ?? '—'}</td>
                    <td className="px-4 py-2">{item.assignedTo?.name ?? '—'}</td>
                    <td className="px-4 py-2">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.status}
                        onChange={(e) => updateStatus.mutate({ id: item.id, status: e.target.value as PendingJobSheetStatus })}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      {path ? (
                        <Link to={path} className="text-indigo-600 hover:underline">
                          Source
                        </Link>
                      ) : (
                        <span className="text-gray-400">Manual</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
