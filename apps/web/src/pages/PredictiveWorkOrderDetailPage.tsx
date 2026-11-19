import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { GroupedChecklist } from '../components/GroupedChecklist';
import { CompletionCaptureFields, type FutureActionDraft, type ParticipantDraft, type SparePartDraft } from '../components/CompletionCaptureFields';
import { MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import type { WorkOrder, WorkOrderPredictiveReading } from '../lib/types';

interface ReadingDraft {
  numericValue?: number;
  passed?: boolean;
  observedText?: string;
  remarks?: string;
}

export function PredictiveWorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAct = hasTier(user?.tier, MAINTENANCE_TEAM);
  const queryClient = useQueryClient();

  const { data: wo, isLoading } = useQuery({
    queryKey: ['predictive-work-orders', id],
    queryFn: async () => (await api.get<WorkOrder>(`/predictive-work-orders/${id}`)).data,
  });

  const [drafts, setDrafts] = useState<Record<string, ReadingDraft>>({});
  const [spareParts, setSpareParts] = useState<SparePartDraft[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [futureActions, setFutureActions] = useState<FutureActionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wo?.predictiveReadings) {
      const initial: Record<string, ReadingDraft> = {};
      for (const r of wo.predictiveReadings) {
        initial[r.checkPointId] = {
          numericValue: r.numericValue ?? undefined,
          passed: r.passed ?? undefined,
          observedText: r.observedText ?? undefined,
          remarks: r.remarks ?? undefined,
        };
      }
      setDrafts(initial);
    }
  }, [wo?.predictiveReadings]);

  const start = useMutation({
    mutationFn: async () => api.post(`/predictive-work-orders/${id}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['predictive-work-orders', id] }),
  });

  const saveReadings = useMutation({
    mutationFn: async () => {
      const readings = Object.entries(drafts)
        .filter(([, d]) => d.numericValue != null || d.passed != null)
        .map(([checkPointId, d]) => ({ checkPointId, ...d }));
      if (readings.length === 0) return null;
      return api.put(`/predictive-work-orders/${id}/readings`, { readings });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['predictive-work-orders', id] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save readings — please try again';
      setError(message);
    },
  });

  const complete = useMutation({
    mutationFn: async () => {
      const readings = Object.entries(drafts)
        .filter(([, d]) => d.numericValue != null || d.passed != null)
        .map(([checkPointId, d]) => ({ checkPointId, ...d }));
      if (readings.length > 0) {
        await api.put(`/predictive-work-orders/${id}/readings`, { readings });
      }
      return api.post(`/predictive-work-orders/${id}/complete`, {
        spareParts: spareParts.filter((p) => p.sparePartId || p.description),
        participants,
        futureActions: futureActions.filter((a) => a.description),
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['predictive-work-orders', id] });
      queryClient.invalidateQueries({ queryKey: ['pending-job-sheet'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to complete check';
      setError(message);
    },
  });

  if (isLoading || !wo) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => navigate(-1)} className="w-fit text-sm text-gray-600 hover:text-gray-900 hover:underline">
        ← Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Predictive Check — {wo.asset.tag} ({wo.asset.name})
        </h1>
        <StatusBadge status={wo.status} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">
          Checklist: <span className="font-medium text-gray-800">{wo.predictiveSchedule?.checklistTemplate?.name ?? '—'}</span>
        </p>

        {wo.status === 'OPEN' && canAct && (
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Start Check
          </button>
        )}

        {wo.predictiveReadings && wo.predictiveReadings.length > 0 && (
          <div className="mt-4">
            <GroupedChecklist<WorkOrderPredictiveReading>
              items={wo.predictiveReadings}
              getGroup={(r) => r.checkPoint.equipmentGroup}
              getKey={(r) => r.id}
              getOrderIndex={(r) => r.checkPoint.orderIndex}
              isAnswered={(r) => {
                const draft = drafts[r.checkPointId] ?? {};
                return draft.numericValue != null || draft.passed != null;
              }}
              renderItem={(r) => {
                const draft = drafts[r.checkPointId] ?? {};
                const readOnly = wo.status === 'CLOSED' || !canAct || wo.status === 'OPEN';
                const cp = r.checkPoint;
                const meta =
                  cp.criteriaType === 'NUMERIC'
                    ? [cp.direction === 'ABOVE' ? `Must stay below ${cp.criticalThreshold ?? '—'}` : `Must stay above ${cp.criticalThreshold ?? '—'}`, cp.unit]
                        .filter(Boolean)
                        .join(' ')
                    : `Expected: ${cp.expectedValue ?? '—'}`;
                return (
                  <div className="flex flex-col gap-1 border-b border-gray-50 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">
                        {cp.checkPointName} {cp.mandatory && <span className="text-red-500">*</span>}
                      </span>
                      {cp.criteriaType === 'QUALITATIVE' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setDrafts((d) => ({ ...d, [r.checkPointId]: { ...d[r.checkPointId], passed: true } }))}
                            className={`rounded-md border px-3 py-1 text-xs ${draft.passed === true ? 'border-green-500 bg-green-100 text-green-800' : 'border-gray-300'}`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setDrafts((d) => ({ ...d, [r.checkPointId]: { ...d[r.checkPointId], passed: false } }))}
                            className={`rounded-md border px-3 py-1 text-xs ${draft.passed === false ? 'border-red-500 bg-red-100 text-red-800' : 'border-gray-300'}`}
                          >
                            Not OK
                          </button>
                        </div>
                      ) : (
                        <input
                          disabled={readOnly}
                          value={draft.numericValue ?? ''}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [r.checkPointId]: { ...d[r.checkPointId], numericValue: e.target.value === '' ? undefined : Number(e.target.value) },
                            }))
                          }
                          type="number"
                          step="any"
                          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{meta}</p>
                    {!readOnly && (
                      <div className="flex flex-col gap-1 sm:flex-row">
                        <input
                          value={draft.observedText ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.checkPointId]: { ...d[r.checkPointId], observedText: e.target.value } }))}
                          placeholder="Observed (optional)"
                          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs"
                        />
                        <input
                          value={draft.remarks ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.checkPointId]: { ...d[r.checkPointId], remarks: e.target.value } }))}
                          placeholder="Remarks (optional)"
                          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                    )}
                    {readOnly && (draft.observedText || draft.remarks) && (
                      <p className="text-xs text-gray-500">
                        {draft.observedText && <>Observed: {draft.observedText} </>}
                        {draft.remarks && <>· Remarks: {draft.remarks}</>}
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </div>
        )}

        {wo.status === 'ATTENDED' && canAct && (
          <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
            <CompletionCaptureFields
              spareParts={spareParts}
              onSparePartsChange={setSpareParts}
              participants={participants}
              onParticipantsChange={setParticipants}
              futureActions={futureActions}
              onFutureActionsChange={setFutureActions}
            />
            <div className="flex items-center gap-3">
              {wo.predictiveReadings && wo.predictiveReadings.length > 0 && (
                <button
                  onClick={() => saveReadings.mutate()}
                  disabled={saveReadings.isPending}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Save
                </button>
              )}
              <button
                onClick={() => complete.mutate()}
                disabled={complete.isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Complete
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        )}

        {((wo.spareParts && wo.spareParts.length > 0) || (wo.participants && wo.participants.length > 0)) && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Job Completion Details</h2>
            {wo.spareParts && wo.spareParts.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500">Spares consumed</p>
                <ul className="text-sm text-gray-700">
                  {wo.spareParts.map((p) => (
                    <li key={p.id}>
                      {p.description} — {p.quantity} {p.unit ?? ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {wo.participants && wo.participants.length > 0 && (
              <div>
                <p className="text-xs text-gray-500">People who worked on this</p>
                <p className="text-sm text-gray-700">
                  {wo.participants.map((p) => `${p.user.name}${p.hoursSpent ? ` (${p.hoursSpent}h)` : ''}`).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Status History</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {wo.statusHistory.map((h) => (
            <li key={h.id} className="flex justify-between border-b border-gray-50 pb-2">
              <span>
                <StatusBadge status={h.toStatus} /> — {h.notes}
              </span>
              <span className="text-gray-400">
                {new Date(h.changedAt).toLocaleString()} by {h.changedBy.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
