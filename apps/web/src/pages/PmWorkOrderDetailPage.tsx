import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { GroupedChecklist } from '../components/GroupedChecklist';
import { CompletionCaptureFields, type FutureActionDraft, type ParticipantDraft, type SparePartDraft } from '../components/CompletionCaptureFields';
import { MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import type { ChecklistResponse, PmSuggestion, WorkOrder } from '../lib/types';

interface ResponseDraft {
  value?: string;
  passed?: boolean;
  remarks?: string;
}

export function PmWorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAct = hasTier(user?.tier, MAINTENANCE_TEAM);
  const queryClient = useQueryClient();

  const { data: wo, isLoading } = useQuery({
    queryKey: ['pm-work-orders', id],
    queryFn: async () => (await api.get<WorkOrder>(`/pm-work-orders/${id}`)).data,
  });

  const [drafts, setDrafts] = useState<Record<string, ResponseDraft>>({});
  const [suggestion, setSuggestion] = useState<PmSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spareParts, setSpareParts] = useState<SparePartDraft[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [futureActions, setFutureActions] = useState<FutureActionDraft[]>([]);

  useEffect(() => {
    if (wo?.checklistResponses) {
      const initial: Record<string, ResponseDraft> = {};
      for (const r of wo.checklistResponses) {
        initial[r.checklistItemId] = { value: r.value ?? undefined, passed: r.passed ?? undefined, remarks: r.remarks ?? undefined };
      }
      setDrafts(initial);
    }
  }, [wo?.checklistResponses]);

  useEffect(() => {
    if (wo?.asset.id) {
      api.get<PmSuggestion>('/ai-suggestions/pm', { params: { assetId: wo.asset.id } }).then(({ data }) => setSuggestion(data));
    }
  }, [wo?.asset.id]);

  const start = useMutation({
    mutationFn: async () => api.post(`/pm-work-orders/${id}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pm-work-orders', id] }),
  });

  const saveResponses = useMutation({
    mutationFn: async () => {
      const responses = Object.entries(drafts)
        .filter(([, d]) => d.value != null || d.passed != null)
        .map(([checklistItemId, d]) => ({ checklistItemId, ...d }));
      if (responses.length === 0) return null;
      return api.put(`/pm-work-orders/${id}/responses`, { responses });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['pm-work-orders', id] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save checklist — please try again';
      setError(message);
    },
  });

  const complete = useMutation({
    mutationFn: async () => {
      const responses = Object.entries(drafts)
        .filter(([, d]) => d.value != null || d.passed != null)
        .map(([checklistItemId, d]) => ({ checklistItemId, ...d }));
      if (responses.length > 0) {
        await api.put(`/pm-work-orders/${id}/responses`, { responses });
      }
      return api.post(`/pm-work-orders/${id}/complete`, {
        spareParts: spareParts.filter((p) => p.sparePartId || p.description),
        participants,
        futureActions: futureActions.filter((a) => a.description),
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['pm-work-orders', id] });
      queryClient.invalidateQueries({ queryKey: ['pending-job-sheet'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to complete PM';
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
          PM — {wo.asset.tag} ({wo.asset.name})
        </h1>
        <StatusBadge status={wo.status} />
      </div>

      {suggestion && suggestion.recentFindings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">{suggestion.summary}</p>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
            {suggestion.recentFindings.map((f, i) => (
              <li key={i}>{f.instruction}</li>
            ))}
          </ul>
        </div>
      )}

      {wo.status === 'OPEN' && canAct && (
        <button
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="w-fit rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Start PM
        </button>
      )}

      {wo.checklistResponses && wo.checklistResponses.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">PM Checklist</h2>
          <GroupedChecklist<ChecklistResponse>
            items={wo.checklistResponses}
            getGroup={(r) => r.checklistItem.equipmentGroup}
            getKey={(r) => r.id}
            getOrderIndex={(r) => r.checklistItem.orderIndex}
            isAnswered={(r) => {
              const draft = drafts[r.checklistItemId] ?? {};
              return draft.value != null || draft.passed != null;
            }}
            renderItem={(r) => {
              const draft = drafts[r.checklistItemId] ?? {};
              const readOnly = wo.status === 'CLOSED' || !canAct || wo.status === 'OPEN';
              const meta = [r.checklistItem.trade, r.checklistItem.frequency, r.checklistItem.criteria && `Criteria: ${r.checklistItem.criteria}`]
                .filter(Boolean)
                .join(' · ');
              return (
                <div className="flex flex-col gap-1 border-b border-gray-50 pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {r.checklistItem.instruction} {r.checklistItem.mandatory && <span className="text-red-500">*</span>}
                      {r.checklistItem.priorToPm && <span className="ml-1 text-xs text-gray-400">(pre-PM check)</span>}
                    </span>
                    {r.checklistItem.inputType === 'PASS_FAIL' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setDrafts((d) => ({ ...d, [r.checklistItemId]: { ...d[r.checklistItemId], passed: true } }))}
                          className={`rounded-md border px-3 py-1 text-xs ${draft.passed === true ? 'border-green-500 bg-green-100 text-green-800' : 'border-gray-300'}`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => setDrafts((d) => ({ ...d, [r.checklistItemId]: { ...d[r.checklistItemId], passed: false } }))}
                          className={`rounded-md border px-3 py-1 text-xs ${draft.passed === false ? 'border-red-500 bg-red-100 text-red-800' : 'border-gray-300'}`}
                        >
                          Fail
                        </button>
                      </div>
                    ) : (
                      <input
                        disabled={readOnly}
                        value={draft.value ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.checklistItemId]: { ...d[r.checklistItemId], value: e.target.value } }))}
                        type={r.checklistItem.inputType === 'NUMERIC' ? 'number' : 'text'}
                        className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                      />
                    )}
                  </div>
                  {meta && <p className="text-xs text-gray-400">{meta}</p>}
                  {!readOnly && (
                    <input
                      disabled={readOnly}
                      value={draft.remarks ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.checklistItemId]: { ...d[r.checklistItemId], remarks: e.target.value } }))}
                      placeholder="Remarks (optional)"
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-50"
                    />
                  )}
                  {readOnly && draft.remarks && <p className="text-xs text-gray-500">Remarks: {draft.remarks}</p>}
                </div>
              );
            }}
          />
        </div>
      )}

      {wo.status === 'ATTENDED' && canAct && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <CompletionCaptureFields
              spareParts={spareParts}
              onSparePartsChange={setSpareParts}
              participants={participants}
              onParticipantsChange={setParticipants}
              futureActions={futureActions}
              onFutureActionsChange={setFutureActions}
            />
            <div className="flex items-center gap-3">
              {wo.checklistResponses && wo.checklistResponses.length > 0 && (
                <button
                  onClick={() => saveResponses.mutate()}
                  disabled={saveResponses.isPending}
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
                Complete PM
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {((wo.spareParts && wo.spareParts.length > 0) || (wo.participants && wo.participants.length > 0)) && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Job Completion Details</h2>
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
  );
}
