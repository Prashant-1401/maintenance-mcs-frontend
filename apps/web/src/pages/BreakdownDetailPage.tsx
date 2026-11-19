import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { CompletionCaptureFields, type FutureActionDraft, type ParticipantDraft, type SparePartDraft } from '../components/CompletionCaptureFields';
import { ADMIN_ONLY, MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import type { FailureCategory, WorkOrder } from '../lib/types';

export function BreakdownDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAct = hasTier(user?.tier, MAINTENANCE_TEAM);
  const isAdmin = hasTier(user?.tier, ADMIN_ONLY);
  const queryClient = useQueryClient();
  const [actionTaken, setActionTaken] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [spareParts, setSpareParts] = useState<SparePartDraft[]>([]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [futureActions, setFutureActions] = useState<FutureActionDraft[]>([]);

  const [showEditForm, setShowEditForm] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editSymptom, setEditSymptom] = useState('');
  const [editFailureCategory, setEditFailureCategory] = useState<FailureCategory>('MECHANICAL');
  const [editActionTaken, setEditActionTaken] = useState('');
  const [editSpareParts, setEditSpareParts] = useState<SparePartDraft[]>([]);
  const [editParticipants, setEditParticipants] = useState<ParticipantDraft[]>([]);

  const { data: wo, isLoading } = useQuery({
    queryKey: ['breakdowns', id],
    queryFn: async () => (await api.get<WorkOrder>(`/breakdowns/${id}`)).data,
  });

  const attend = useMutation({
    mutationFn: async () => api.post(`/breakdowns/${id}/attend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breakdowns', id] }),
  });

  const close = useMutation({
    mutationFn: async () =>
      api.post(`/breakdowns/${id}/close`, {
        actionTaken,
        spareParts: spareParts.filter((p) => p.sparePartId || p.description),
        participants,
        futureActions: futureActions.filter((a) => a.description),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakdowns', id] });
      queryClient.invalidateQueries({ queryKey: ['pending-job-sheet'] });
      setShowCloseForm(false);
    },
  });

  const editBreakdown = useMutation({
    mutationFn: async () =>
      api.patch(`/breakdowns/${id}`, {
        reason: editReason,
        symptom: editSymptom,
        failureCategory: editFailureCategory,
        actionTaken: editActionTaken,
        spareParts: editSpareParts.filter((p) => p.sparePartId || p.description),
        participants: editParticipants,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breakdowns', id] });
      setShowEditForm(false);
    },
  });

  const openEditForm = () => {
    if (!wo) return;
    setEditSymptom(wo.breakdownDetail?.symptom ?? '');
    setEditFailureCategory(wo.breakdownDetail?.failureCategory ?? 'MECHANICAL');
    setEditActionTaken(wo.breakdownDetail?.actionTaken ?? '');
    setEditSpareParts((wo.spareParts ?? []).map((p) => ({ description: p.description, quantity: p.quantity, unit: p.unit ?? undefined, unitCost: p.unitCost ?? undefined })));
    setEditParticipants((wo.participants ?? []).map((p) => ({ userId: p.user.id, hoursSpent: p.hoursSpent ?? undefined })));
    setEditReason('');
    setShowEditForm(true);
  };

  if (isLoading || !wo) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => navigate(-1)} className="w-fit text-sm text-gray-600 hover:text-gray-900 hover:underline">
        ← Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Breakdown — {wo.asset?.tag} ({wo.asset?.name})
          </h1>
          <p className="text-sm text-gray-500">
            <Link to={`/assets/${wo.asset.id}`} className="text-indigo-600 hover:underline">
              View asset history
            </Link>
          </p>
        </div>
        <StatusBadge status={wo.status} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Breakdown Slip</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">Occurred at</dt>
            <dd>{wo.breakdownDetail && new Date(wo.breakdownDetail.occurredAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Failure category</dt>
            <dd>{wo.breakdownDetail?.failureCategory}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Reported by</dt>
            <dd>{wo.breakdownDetail?.reportedBy.name}</dd>
          </div>
          <div className="col-span-2 md:col-span-3">
            <dt className="text-xs text-gray-500">Symptom</dt>
            <dd>{wo.breakdownDetail?.symptom}</dd>
          </div>
          {wo.breakdownDetail?.attendedAt && (
            <div>
              <dt className="text-xs text-gray-500">Attended at</dt>
              <dd>
                {new Date(wo.breakdownDetail.attendedAt).toLocaleString()} by {wo.breakdownDetail.attendedBy?.name}
              </dd>
            </div>
          )}
          {wo.breakdownDetail?.restoredAt && (
            <div>
              <dt className="text-xs text-gray-500">Restored at</dt>
              <dd>{new Date(wo.breakdownDetail.restoredAt).toLocaleString()}</dd>
            </div>
          )}
          {wo.breakdownDetail?.actionTaken && (
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-gray-500">Action taken</dt>
              <dd>{wo.breakdownDetail.actionTaken}</dd>
            </div>
          )}
        </dl>

        {canAct && wo.status === 'OPEN' && (
          <button
            onClick={() => attend.mutate()}
            disabled={attend.isPending}
            className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Attend
          </button>
        )}

        {canAct && wo.status === 'ATTENDED' && !showCloseForm && (
          <button
            onClick={() => setShowCloseForm(true)}
            className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Close
          </button>
        )}

        {canAct && wo.status === 'ATTENDED' && showCloseForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              close.mutate();
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Action taken</label>
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                required
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <CompletionCaptureFields
              spareParts={spareParts}
              onSparePartsChange={setSpareParts}
              participants={participants}
              onParticipantsChange={setParticipants}
              futureActions={futureActions}
              onFutureActionsChange={setFutureActions}
            />

            <button
              type="submit"
              disabled={close.isPending}
              className="w-fit rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Confirm Close
            </button>
          </form>
        )}

        {wo.status === 'CLOSED' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to={`/rca?workOrderId=${wo.id}`}
              className="inline-block rounded-md border border-indigo-300 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
            >
              File RCA for this breakdown
            </Link>
            {isAdmin && !showEditForm && (
              <button
                onClick={openEditForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
            )}
          </div>
        )}

        {isAdmin && showEditForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              editBreakdown.mutate();
            }}
            className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4"
          >
            <p className="text-xs font-medium text-amber-700">
              Editing a closed breakdown — this is audited and does not reopen the work order or change asset status.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Failure category</label>
                <select
                  value={editFailureCategory}
                  onChange={(e) => setEditFailureCategory(e.target.value as FailureCategory)}
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
              <label className="mb-1 block text-xs font-medium text-gray-700">Symptom</label>
              <textarea
                value={editSymptom}
                onChange={(e) => setEditSymptom(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Action taken</label>
              <textarea
                value={editActionTaken}
                onChange={(e) => setEditActionTaken(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <CompletionCaptureFields
              spareParts={editSpareParts}
              onSparePartsChange={setEditSpareParts}
              participants={editParticipants}
              onParticipantsChange={setEditParticipants}
              futureActions={[]}
              onFutureActionsChange={() => {}}
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Reason for edit (required, kept in the audit trail)</label>
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={editBreakdown.isPending}
                className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Changes
              </button>
              <button type="button" onClick={() => setShowEditForm(false)} className="text-sm text-gray-600 hover:underline">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

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
