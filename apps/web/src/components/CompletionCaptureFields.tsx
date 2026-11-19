import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SparePartMaster, UserRef } from '../lib/types';

export interface SparePartDraft {
  sparePartId?: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
}

export interface ParticipantDraft {
  userId: string;
  hoursSpent?: number;
}

export interface FutureActionDraft {
  description: string;
  assignedToId?: string;
  dueDate?: string;
}

interface Props {
  spareParts: SparePartDraft[];
  onSparePartsChange: (v: SparePartDraft[]) => void;
  participants: ParticipantDraft[];
  onParticipantsChange: (v: ParticipantDraft[]) => void;
  futureActions: FutureActionDraft[];
  onFutureActionsChange: (v: FutureActionDraft[]) => void;
}

export function CompletionCaptureFields({
  spareParts,
  onSparePartsChange,
  participants,
  onParticipantsChange,
  futureActions,
  onFutureActionsChange,
}: Props) {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserRef[]>('/users')).data,
  });
  const { data: sparePartsMaster } = useQuery({
    queryKey: ['spare-parts'],
    queryFn: async () => (await api.get<SparePartMaster[]>('/spare-parts')).data,
  });
  const technicians = users?.filter((u) => u.role.tier === 'TECHNICIAN') ?? [];

  const toggleParticipant = (userId: string) => {
    onParticipantsChange(
      participants.some((p) => p.userId === userId)
        ? participants.filter((p) => p.userId !== userId)
        : [...participants, { userId }],
    );
  };

  const setHoursSpent = (userId: string, hoursSpent: number) => {
    onParticipantsChange(participants.map((p) => (p.userId === userId ? { ...p, hoursSpent } : p)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-medium text-gray-700">Spares consumed (optional)</p>
        <div className="flex flex-col gap-2">
          {spareParts.map((part, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={part.sparePartId ?? ''}
                onChange={(e) => {
                  const sparePartId = e.target.value || undefined;
                  const master = sparePartsMaster?.find((p) => p.id === sparePartId);
                  onSparePartsChange(
                    spareParts.map((p, idx) =>
                      idx === i ? { ...p, sparePartId, description: undefined, unit: master?.unit ?? p.unit } : p,
                    ),
                  );
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Custom item…</option>
                {sparePartsMaster?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.itemCode} — {p.name}
                  </option>
                ))}
              </select>
              {!part.sparePartId && (
                <input
                  placeholder="Description"
                  value={part.description ?? ''}
                  onChange={(e) =>
                    onSparePartsChange(spareParts.map((p, idx) => (idx === i ? { ...p, description: e.target.value } : p)))
                  }
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              )}
              <input
                type="number"
                step="any"
                placeholder="Qty"
                value={part.quantity || ''}
                onChange={(e) =>
                  onSparePartsChange(spareParts.map((p, idx) => (idx === i ? { ...p, quantity: Number(e.target.value) } : p)))
                }
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <input
                placeholder="Unit"
                value={part.unit ?? ''}
                onChange={(e) =>
                  onSparePartsChange(spareParts.map((p, idx) => (idx === i ? { ...p, unit: e.target.value } : p)))
                }
                disabled={!!part.sparePartId}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
              />
              {part.sparePartId ? (
                (() => {
                  const master = sparePartsMaster?.find((p) => p.id === part.sparePartId);
                  return (
                    <span className="w-24 text-xs text-gray-500">
                      {master?.unitCost != null ? `₹${master.unitCost}/unit` : 'no cost set'}
                    </span>
                  );
                })()
              ) : (
                <input
                  type="number"
                  step="any"
                  placeholder="Unit cost"
                  value={part.unitCost ?? ''}
                  onChange={(e) =>
                    onSparePartsChange(
                      spareParts.map((p, idx) => (idx === i ? { ...p, unitCost: Number(e.target.value) } : p)),
                    )
                  }
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => onSparePartsChange(spareParts.filter((_, idx) => idx !== i))}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onSparePartsChange([...spareParts, { quantity: 1 }])}
            className="w-fit text-xs text-indigo-600 hover:underline"
          >
            + Add spare part
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-700">People who worked on this</p>
        <div className="flex flex-col gap-2">
          {technicians.map((tech) => {
            const participant = participants.find((p) => p.userId === tech.id);
            return (
              <div key={tech.id} className="flex items-center gap-2 text-sm text-gray-700">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={!!participant} onChange={() => toggleParticipant(tech.id)} />
                  {tech.name}
                </label>
                {participant && (
                  <input
                    type="number"
                    step="any"
                    placeholder="Hours"
                    value={participant.hoursSpent ?? ''}
                    onChange={(e) => setHoursSpent(tech.id, Number(e.target.value))}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-700">Future action required (optional — goes to Pending Job Sheet)</p>
        <div className="flex flex-col gap-2">
          {futureActions.map((action, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Description"
                value={action.description}
                onChange={(e) =>
                  onFutureActionsChange(futureActions.map((a, idx) => (idx === i ? { ...a, description: e.target.value } : a)))
                }
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <select
                value={action.assignedToId ?? ''}
                onChange={(e) =>
                  onFutureActionsChange(futureActions.map((a, idx) => (idx === i ? { ...a, assignedToId: e.target.value } : a)))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Unassigned</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={action.dueDate ?? ''}
                onChange={(e) =>
                  onFutureActionsChange(futureActions.map((a, idx) => (idx === i ? { ...a, dueDate: e.target.value } : a)))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => onFutureActionsChange(futureActions.filter((_, idx) => idx !== i))}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onFutureActionsChange([...futureActions, { description: '' }])}
            className="w-fit text-xs text-indigo-600 hover:underline"
          >
            + Add follow-up action
          </button>
        </div>
      </div>
    </div>
  );
}
