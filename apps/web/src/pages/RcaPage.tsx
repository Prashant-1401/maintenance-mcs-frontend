import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import { StatusBadge } from '../components/StatusBadge';
import type { RcaRecord, RcaRecordStatus, UserRef, WorkOrder } from '../lib/types';

interface WhyStepDraft {
  why: string;
  because: string;
}

interface ActionItemDraft {
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  ownerId: string;
  dueDate: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

function RcaRecordCard({ record, canEdit }: { record: RcaRecord; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rootCause, setRootCause] = useState(record.rootCause ?? '');
  const [remarks, setRemarks] = useState(record.remarks ?? '');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async (status: RcaRecordStatus) => api.patch(`/rca/${record.id}`, { rootCause, remarks, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rca'] });
      queryClient.invalidateQueries({ queryKey: ['rca-actions'] });
      setEditing(false);
      setError(null);
    },
    onError: (err: unknown) => setError(errorMessage(err, 'Failed to save')),
  });

  const corrective = record.actionItems.filter((a) => a.type === 'CORRECTIVE');
  const preventive = record.actionItems.filter((a) => a.type === 'PREVENTIVE');

  return (
    <li className="p-4">
      <div className="flex items-start justify-between">
        <p className="font-medium text-gray-900">
          {record.workOrder?.asset.tag} — {record.method.replace('_', ' ')}{' '}
          <StatusBadge status={record.status} />
        </p>
        {canEdit && !editing && (
          <button
            onClick={() => {
              setRootCause(record.rootCause ?? '');
              setRemarks(record.remarks ?? '');
              setEditing(true);
            }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Root cause</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="w-fit rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            {record.status === 'DRAFT' && (
              <button
                onClick={() => update.mutate('DRAFT')}
                disabled={update.isPending}
                className="w-fit rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Save as Draft
              </button>
            )}
            <button
              onClick={() => update.mutate('FINAL')}
              disabled={update.isPending}
              className="w-fit rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              {record.status === 'DRAFT' ? 'Finalize' : 'Save'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">Root cause: {record.rootCause || '—'}</p>
          {record.remarks && <p className="mt-1 text-sm text-gray-500">Remarks: {record.remarks}</p>}
        </>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-700">Corrective actions ({corrective.length})</p>
          {corrective.length === 0 ? (
            <p className="text-xs text-gray-400">None</p>
          ) : (
            <ul className="text-xs text-gray-600">
              {corrective.map((a) => (
                <li key={a.id}>
                  {a.description} — {a.owner.name} ({a.status})
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-700">Preventive actions ({preventive.length})</p>
          {preventive.length === 0 ? (
            <p className="text-xs text-gray-400">None</p>
          ) : (
            <ul className="text-xs text-gray-600">
              {preventive.map((a) => (
                <li key={a.id}>
                  {a.description} — {a.owner.name} ({a.status})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

const EMPTY_ACTION_ITEMS: ActionItemDraft[] = [{ description: '', type: 'CORRECTIVE', ownerId: '', dueDate: '' }];
const EMPTY_WHY_STEPS: WhyStepDraft[] = [{ why: '', because: '' }];
const EMPTY_FISHBONE: Record<string, string> = { Man: '', Machine: '', Method: '', Material: '', Environment: '' };

export function RcaPage() {
  const { user } = useAuth();
  const canCreate = hasTier(user?.tier, MAINTENANCE_TEAM);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prefilledWorkOrderId = searchParams.get('workOrderId') ?? '';

  const [showForm, setShowForm] = useState(!!prefilledWorkOrderId);
  const [workOrderId, setWorkOrderId] = useState(prefilledWorkOrderId);
  const [method, setMethod] = useState<'FIVE_WHY' | 'FISHBONE'>('FIVE_WHY');
  const [whySteps, setWhySteps] = useState<WhyStepDraft[]>(EMPTY_WHY_STEPS);
  const [fishbone, setFishbone] = useState<Record<string, string>>(EMPTY_FISHBONE);
  const [rootCause, setRootCause] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionItems, setActionItems] = useState<ActionItemDraft[]>(EMPTY_ACTION_ITEMS);
  const [formError, setFormError] = useState<string | null>(null);

  const [filterAsset, setFilterAsset] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { data: records, isLoading } = useQuery({
    queryKey: ['rca'],
    queryFn: async () => (await api.get<RcaRecord[]>('/rca')).data,
  });
  const { data: closedBreakdowns } = useQuery({
    queryKey: ['breakdowns'],
    queryFn: async () => (await api.get<WorkOrder[]>('/breakdowns')).data,
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserRef[]>('/users')).data,
    enabled: canCreate,
  });

  const resetForm = () => {
    setShowForm(false);
    setWorkOrderId('');
    setMethod('FIVE_WHY');
    setWhySteps(EMPTY_WHY_STEPS);
    setFishbone(EMPTY_FISHBONE);
    setRootCause('');
    setRemarks('');
    setActionItems(EMPTY_ACTION_ITEMS);
    setFormError(null);
  };

  const createRca = useMutation({
    mutationFn: async (status: RcaRecordStatus) =>
      api.post('/rca', {
        workOrderId,
        method,
        whySteps: method === 'FIVE_WHY' ? whySteps.filter((s) => s.why) : undefined,
        fishboneCauses:
          method === 'FISHBONE'
            ? Object.fromEntries(
                Object.entries(fishbone)
                  .filter(([, v]) => v.trim())
                  .map(([k, v]) => [k, v.split('\n').filter(Boolean)]),
              )
            : undefined,
        rootCause: rootCause || undefined,
        remarks: remarks || undefined,
        status,
        actionItems: actionItems
          .filter((a) => a.description && a.ownerId && a.dueDate)
          .map((a) => ({ ...a, dueDate: new Date(a.dueDate).toISOString() })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rca'] });
      queryClient.invalidateQueries({ queryKey: ['rca-actions'] });
      resetForm();
    },
    onError: (err: unknown) => setFormError(errorMessage(err, 'Failed to save RCA')),
  });

  const closedWithoutRca = closedBreakdowns?.filter((wo) => wo.status === 'CLOSED') ?? [];

  const assetOptions = useMemo(() => {
    const map = new Map<string, string>();
    records?.forEach((r) => {
      if (r.workOrder?.asset) map.set(r.workOrder.asset.id, r.workOrder.asset.tag);
    });
    return [...map.entries()];
  }, [records]);

  const filteredRecords = useMemo(() => {
    return (records ?? []).filter((r) => {
      if (filterAsset && r.workOrder?.asset.id !== filterAsset) return false;
      if (filterMethod && r.method !== filterMethod) return false;
      if (filterFrom && new Date(r.createdAt) < new Date(filterFrom)) return false;
      if (filterTo && new Date(r.createdAt) > new Date(`${filterTo}T23:59:59.999`)) return false;
      return true;
    });
  }, [records, filterAsset, filterMethod, filterFrom, filterTo]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">RCA Capturing Sheets</h1>
        {canCreate && (
          <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + New RCA
          </button>
        )}
      </div>

      {showForm && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Breakdown (closed)</label>
              <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">Select…</option>
                {closedWithoutRca.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.asset?.tag ?? '—'} — {wo.breakdownDetail?.symptom?.slice(0, 40) ?? 'No description'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as 'FIVE_WHY' | 'FISHBONE')} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                <option value="FIVE_WHY">5-Why</option>
                <option value="FISHBONE">Fishbone</option>
              </select>
            </div>
          </div>

          {method === 'FIVE_WHY' ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-gray-700">Why steps</p>
              {whySteps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Why...?"
                    value={step.why}
                    onChange={(e) => setWhySteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, why: e.target.value } : s)))}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <input
                    placeholder="Because..."
                    value={step.because}
                    onChange={(e) => setWhySteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, because: e.target.value } : s)))}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
              <button type="button" onClick={() => setWhySteps((prev) => [...prev, { why: '', because: '' }])} className="w-fit text-xs text-indigo-600 hover:underline">
                + Add why
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.keys(fishbone).map((cat) => (
                <div key={cat}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{cat} (one cause per line)</label>
                  <textarea
                    value={fishbone[cat]}
                    onChange={(e) => setFishbone((prev) => ({ ...prev, [cat]: e.target.value }))}
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Root cause (required to finalize)</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-700">Action items</p>
            {actionItems.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 p-2">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => setActionItems((prev) => prev.map((a, idx) => (idx === i ? { ...a, description: e.target.value } : a)))}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={item.type}
                  onChange={(e) => setActionItems((prev) => prev.map((a, idx) => (idx === i ? { ...a, type: e.target.value as 'CORRECTIVE' | 'PREVENTIVE' } : a)))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="PREVENTIVE">Preventive</option>
                </select>
                <select
                  value={item.ownerId}
                  onChange={(e) => setActionItems((prev) => prev.map((a, idx) => (idx === i ? { ...a, ownerId: e.target.value } : a)))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">Owner…</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => setActionItems((prev) => prev.map((a, idx) => (idx === i ? { ...a, dueDate: e.target.value } : a)))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setActionItems((prev) => [...prev, { description: '', type: 'CORRECTIVE', ownerId: '', dueDate: '' }])}
              className="w-fit text-xs text-indigo-600 hover:underline"
            >
              + Add action item
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Remarks (optional)</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={resetForm} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={!workOrderId || createRca.isPending}
              onClick={() => createRca.mutate('DRAFT')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={!workOrderId || createRca.isPending}
              onClick={() => createRca.mutate('FINAL')}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save RCA
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Asset</label>
          <select value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All</option>
            {assetOptions.map(([id, tag]) => (
              <option key={id} value={id}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Method</label>
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">All</option>
            <option value="FIVE_WHY">5-Why</option>
            <option value="FISHBONE">Fishbone</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">From</label>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">To</label>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        {(filterAsset || filterMethod || filterFrom || filterTo) && (
          <button
            onClick={() => {
              setFilterAsset('');
              setFilterMethod('');
              setFilterFrom('');
              setFilterTo('');
            }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : filteredRecords.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No RCA records match the current filters.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredRecords.map((r) => (
              <RcaRecordCard key={r.id} record={r} canEdit={canCreate} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
