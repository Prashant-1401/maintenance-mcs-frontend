import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import { useTableFilters, type FilterColumn } from '../lib/useTableFilters';
import type { RcaActionGroup, RcaActionItem, RcaActionStatus } from '../lib/types';

interface FlatActionRow {
  group: RcaActionGroup;
  item: RcaActionItem;
}

const STATUSES: RcaActionStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED'];

export function RcaTrackerPage() {
  const { user } = useAuth();
  const canAct = hasTier(user?.tier, MAINTENANCE_TEAM);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['rca-actions', statusFilter],
    queryFn: async () =>
      (await api.get<RcaActionGroup[]>('/rca-actions', { params: statusFilter ? { status: statusFilter } : {} })).data,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RcaActionStatus }) =>
      api.patch(`/rca-actions/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rca-actions'] }),
  });

  const flatRows: FlatActionRow[] = useMemo(
    () => (groups ?? []).flatMap((group) => group.actionItems.map((item) => ({ group, item }))),
    [groups],
  );
  const filterColumns: FilterColumn<FlatActionRow>[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', type: 'text', getValue: (row) => `${row.group.asset.tag} ${row.group.asset.name}` },
      { key: 'owner', label: 'Owner', type: 'select', getValue: (row) => row.item.owner.name },
      { key: 'type', label: 'Type', type: 'select', getValue: (row) => row.item.type },
    ],
    [],
  );
  const tableFilters = useTableFilters(flatRows, filterColumns);

  const filteredGroups: RcaActionGroup[] = useMemo(() => {
    const byRecord = new Map<string, RcaActionGroup>();
    for (const { group, item } of tableFilters.filtered) {
      const existing = byRecord.get(group.rcaRecordId);
      if (existing) {
        existing.actionItems.push(item);
      } else {
        byRecord.set(group.rcaRecordId, { ...group, actionItems: [item] });
      }
    }
    return (groups ?? []).filter((g) => byRecord.has(g.rcaRecordId)).map((g) => byRecord.get(g.rcaRecordId)!);
  }, [tableFilters.filtered, groups]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">RCA Tracker</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {flatRows.length > 0 && (
        <ColumnFilterBar
          columns={filterColumns}
          rows={flatRows}
          values={tableFilters.values}
          onChange={tableFilters.setValue}
          onClear={tableFilters.clear}
          active={tableFilters.active}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups?.length === 0 ? (
        <p className="text-sm text-gray-500">No action items yet.</p>
      ) : filteredGroups.length === 0 ? (
        <p className="text-sm text-gray-500">No action items match the current filters.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredGroups.map((group) => (
            <div key={group.rcaRecordId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {group.asset?.tag ?? 'Asset'} — {group.method.replace('_', ' ')} RCA
                </p>
                <Link to={`/rca`} className="text-xs text-indigo-600 hover:underline">
                  View RCA sheet
                </Link>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="py-1">Action</th>
                    <th className="py-1">Type</th>
                    <th className="py-1">Owner</th>
                    <th className="py-1">Due</th>
                    <th className="py-1">Status</th>
                    {canAct && <th className="py-1">Update</th>}
                  </tr>
                </thead>
                <tbody>
                  {group.actionItems.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-50 ${item.overdue ? 'bg-red-50' : ''}`}>
                      <td className="py-1">{item.description}</td>
                      <td className="py-1">{item.type}</td>
                      <td className="py-1">{item.owner.name}</td>
                      <td className="py-1">
                        {new Date(item.dueDate).toLocaleDateString()} {item.overdue && <span className="text-red-600">(overdue)</span>}
                      </td>
                      <td className="py-1">
                        <StatusBadge status={item.status} />
                      </td>
                      {canAct && (
                        <td className="py-1">
                          <select
                            value={item.status}
                            onChange={(e) => updateStatus.mutate({ id: item.id, status: e.target.value as RcaActionStatus })}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
