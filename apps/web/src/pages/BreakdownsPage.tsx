import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { KanbanBoard, type KanbanColumn } from '../components/KanbanBoard';
import { ColumnFilterBar } from '../components/ColumnFilterBar';
import { usePersistedState } from '../lib/usePersistedState';
import { useTableFilters, type FilterColumn } from '../lib/useTableFilters';
import type { Asset, BreakdownSuggestion, WorkOrder } from '../lib/types';

import { MasterDataToolbar } from '../components/MasterDataToolbar';

const COLUMNS: KanbanColumn[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'ATTENDED', label: 'Attended' },
  { key: 'CLOSED', label: 'Closed' },
];

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BreakdownsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = usePersistedState<'list' | 'kanban'>('breakdowns-view', 'list');

  const { data: breakdowns, isLoading } = useQuery({
    queryKey: ['breakdowns'],
    queryFn: async () => (await api.get<WorkOrder[]>('/breakdowns')).data,
  });
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });

  const [assetId, setAssetId] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue(new Date()));
  const [failureCategory, setFailureCategory] = useState('MECHANICAL');
  const [symptom, setSymptom] = useState('');
  const [suggestion, setSuggestion] = useState<BreakdownSuggestion | null>(null);
  const [checkingSuggestion, setCheckingSuggestion] = useState(false);

  const checkSuggestions = async () => {
    if (!assetId || !symptom) return;
    setCheckingSuggestion(true);
    try {
      const { data } = await api.get<BreakdownSuggestion>('/ai-suggestions/breakdown', {
        params: { assetId, symptom },
      });
      setSuggestion(data);
    } finally {
      setCheckingSuggestion(false);
    }
  };

  const raiseBreakdown = useMutation({
    mutationFn: async () =>
      api.post<WorkOrder>('/breakdowns', {
        assetId,
        occurredAt: new Date(occurredAt).toISOString(),
        failureCategory,
        symptom,
      }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['breakdowns'] });
      navigate(`/breakdowns/${data.id}`);
    },
  });

  const attend = useMutation({
    mutationFn: async (id: string) => api.post(`/breakdowns/${id}/attend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breakdowns'] }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update';
      window.alert(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const filterColumns: FilterColumn<WorkOrder>[] = useMemo(
    () => [
      { key: 'asset', label: 'Asset', type: 'text', getValue: (wo) => `${wo.asset?.tag ?? ''} ${wo.asset?.name ?? ''}`.trim() },
      { key: 'reportedBy', label: 'Reported by', type: 'select', getValue: (wo) => wo.breakdownDetail?.reportedBy?.name ?? '' },
      { key: 'status', label: 'Status', type: 'select', getValue: (wo) => wo.status },
    ],
    [],
  );
  const tableFilters = useTableFilters(breakdowns ?? [], filterColumns);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Breakdown Slips</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MasterDataToolbar
            resource="breakdowns"
            onImported={() => {
              queryClient.invalidateQueries({ queryKey: ['breakdowns'] });
              queryClient.invalidateQueries({ queryKey: ['kpi-dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['kpi-trends'] });
            }}
          />
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
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Raise Breakdown Slip
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            raiseBreakdown.mutate();
          }}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Asset</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Select…</option>
                {assets?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tag} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Occurred at</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Failure category</label>
              <select
                value={failureCategory}
                onChange={(e) => setFailureCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option>MECHANICAL</option>
                <option>ELECTRICAL</option>
                <option>UTILITY</option>
                <option>INSTRUMENTATION</option>
                <option>OTHER</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Symptom / description</label>
            <textarea
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={checkSuggestions}
              disabled={!assetId || !symptom || checkingSuggestion}
              className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {checkingSuggestion ? 'Checking…' : 'Check similar past cases (AI)'}
            </button>
          </div>

          {suggestion && (
            <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-sm">
              <p className="mb-2 font-medium text-indigo-900">{suggestion.summary}</p>
              {suggestion.similarCases.map((c) => (
                <div key={c.workOrderId} className="mb-2 rounded bg-white p-2 text-xs">
                  <p className="text-gray-700">
                    <strong>{new Date(c.occurredAt).toLocaleDateString()}:</strong> {c.symptom}
                  </p>
                  {c.rootCause && <p className="text-gray-600">Root cause: {c.rootCause}</p>}
                  {c.actionTaken && <p className="text-gray-600">Action taken: {c.actionTaken}</p>}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={raiseBreakdown.isPending}
            className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit Breakdown Slip
          </button>
        </form>
      )}

      {breakdowns && breakdowns.length > 0 && (
        <ColumnFilterBar
          columns={filterColumns}
          rows={breakdowns}
          values={tableFilters.values}
          onChange={tableFilters.setValue}
          onClear={tableFilters.clear}
          active={tableFilters.active}
        />
      )}

      {isLoading ? (
        <p className="p-4 text-sm text-gray-500">Loading…</p>
      ) : view === 'kanban' ? (
        <KanbanBoard
          columns={COLUMNS}
          items={tableFilters.filtered}
          getId={(wo) => wo.id}
          getStatus={(wo) => wo.status}
          onMove={(wo, newStatus) => {
            if (newStatus === 'ATTENDED' && wo.status === 'OPEN') {
              attend.mutate(wo.id);
            } else {
              navigate(`/breakdowns/${wo.id}`);
            }
          }}
          renderCard={(wo) => (
            <div>
              <p className="font-medium text-gray-900">
                {wo.asset?.tag} — {wo.asset?.name}
              </p>
              <p className="text-gray-700">{wo.breakdownDetail?.symptom}</p>
              <p className="mt-1 text-xs text-gray-500">Reported by {wo.breakdownDetail?.reportedBy.name}</p>
              <Link to={`/breakdowns/${wo.id}`} className="text-xs text-indigo-600 hover:underline">
                View
              </Link>
            </div>
          )}
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Asset</th>
                <th className="px-4 py-2">Symptom</th>
                <th className="px-4 py-2">Reported by</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tableFilters.filtered.map((wo) => (
                <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {wo.asset?.tag} — {wo.asset?.name}
                  </td>
                  <td className="px-4 py-2">{wo.breakdownDetail?.symptom}</td>
                  <td className="px-4 py-2">{wo.breakdownDetail?.reportedBy.name}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={wo.status} />
                  </td>
                  <td className="px-4 py-2">
                    <Link to={`/breakdowns/${wo.id}`} className="text-indigo-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
