import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_ONLY, hasTier } from '../lib/roles';
import { MasterDataToolbar } from '../components/MasterDataToolbar';
import { ExcelImportPreview } from '../components/ExcelImportPreview';
import type { CriteriaType, MaintenanceType, ParsedPredictiveWorkbook, PredictiveChecklistTemplate, ThresholdDirection } from '../lib/types';

interface CheckPointDraft {
  orderIndex: number;
  equipmentGroup: string;
  checkPointName: string;
  mandatory: boolean;
  criteriaType: CriteriaType;
  unit: string;
  criticalThreshold: string;
  direction: ThresholdDirection;
  expectedValue: string;
}

function emptyCheckPoint(orderIndex: number): CheckPointDraft {
  return {
    orderIndex,
    equipmentGroup: '',
    checkPointName: '',
    mandatory: true,
    criteriaType: 'NUMERIC',
    unit: '',
    criticalThreshold: '',
    direction: 'ABOVE',
    expectedValue: '',
  };
}

export function PredictiveChecklistTemplatesPage() {
  const { user } = useAuth();
  const canManage = hasTier(user?.tier, ADMIN_ONLY);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [assetCategory, setAssetCategory] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('OTHER');
  const [checkPoints, setCheckPoints] = useState<CheckPointDraft[]>([emptyCheckPoint(1)]);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['predictive-checklist-templates'],
    queryFn: async () => (await api.get<PredictiveChecklistTemplate[]>('/predictive-checklist-templates')).data,
  });

  const createTemplate = useMutation({
    mutationFn: async () =>
      api.post('/predictive-checklist-templates', {
        name,
        assetCategory: assetCategory || undefined,
        maintenanceType,
        checkPoints: checkPoints.map((cp) => ({
          ...cp,
          unit: cp.unit || undefined,
          criticalThreshold: cp.criticalThreshold ? Number(cp.criticalThreshold) : undefined,
          direction: cp.criteriaType === 'NUMERIC' ? cp.direction : undefined,
          expectedValue: cp.criteriaType === 'QUALITATIVE' ? cp.expectedValue || undefined : undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictive-checklist-templates'] });
      setShowForm(false);
      setName('');
      setAssetCategory('');
      setCheckPoints([emptyCheckPoint(1)]);
    },
  });

  const updateCheckPoint = (index: number, patch: Partial<CheckPointDraft>) => {
    setCheckPoints((prev) => prev.map((cp, i) => (i === index ? { ...cp, ...patch } : cp)));
  };
  const addCheckPoint = () => setCheckPoints((prev) => [...prev, emptyCheckPoint(prev.length + 1)]);
  const removeCheckPoint = (index: number) => setCheckPoints((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Predictive Checklist Templates</h1>
        <MasterDataToolbar resource="predictive-checklist-templates" importable={false} />
      </div>

      {canManage && (
        <ExcelImportPreview<ParsedPredictiveWorkbook>
          title="Import from Excel (imports every equipment sheet as its own template)"
          onUpload={async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post<ParsedPredictiveWorkbook>('/predictive-checklist-templates/import/preview', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
          }}
          onCommit={async (data) => {
            for (const template of data.templates) {
              const flatCheckPoints = [];
              let orderIndex = 0;
              for (const group of template.equipmentGroups) {
                for (const cp of group.checkPoints) {
                  orderIndex += 1;
                  flatCheckPoints.push({ ...cp, orderIndex });
                }
              }
              await api.post('/predictive-checklist-templates/import/commit', { name: template.templateName, checkPoints: flatCheckPoints });
            }
            queryClient.invalidateQueries({ queryKey: ['predictive-checklist-templates'] });
          }}
          renderSummary={(data) => (
            <div className="flex flex-col gap-3">
              {data.templates.map((t) => (
                <div key={t.templateName}>
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{t.templateName}</span> — {t.totalCheckPoints} check point(s) across {t.equipmentGroups.length} equipment
                    group(s)
                  </p>
                  <ul className="max-h-32 overflow-y-auto pl-2 text-xs text-gray-600">
                    {t.equipmentGroups.map((g) => (
                      <li key={g.name}>
                        {g.name} — {g.checkPoints.length} check point(s)
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {data.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                  <p className="mb-1 text-xs font-medium text-amber-900">{data.warnings.length} row(s) to review</p>
                  <ul className="max-h-32 overflow-y-auto text-xs text-amber-800">
                    {data.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        />
      )}

      {canManage && (
        <div>
          <button onClick={() => setShowForm((v) => !v)} className="text-sm text-indigo-600 hover:underline">
            {showForm ? '− Hide manual template builder' : '+ Build a template manually instead'}
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTemplate.mutate();
          }}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Template name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Asset category (optional)</label>
              <input
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Maintenance type / trade</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="MECHANICAL">Mechanical</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-700">Check points</p>
            {checkPoints.map((cp, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 p-2">
                <input
                  placeholder="Equipment group"
                  value={cp.equipmentGroup}
                  onChange={(e) => updateCheckPoint(i, { equipmentGroup: e.target.value })}
                  required
                  className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  placeholder="Check point"
                  value={cp.checkPointName}
                  onChange={(e) => updateCheckPoint(i, { checkPointName: e.target.value })}
                  required
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={cp.criteriaType}
                  onChange={(e) => updateCheckPoint(i, { criteriaType: e.target.value as CriteriaType })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="NUMERIC">Numeric</option>
                  <option value="QUALITATIVE">Qualitative</option>
                </select>
                {cp.criteriaType === 'NUMERIC' ? (
                  <>
                    <select
                      value={cp.direction}
                      onChange={(e) => updateCheckPoint(i, { direction: e.target.value as ThresholdDirection })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="ABOVE">Must stay below</option>
                      <option value="BELOW">Must stay above</option>
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="Threshold"
                      value={cp.criticalThreshold}
                      onChange={(e) => updateCheckPoint(i, { criticalThreshold: e.target.value })}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="Unit"
                      value={cp.unit}
                      onChange={(e) => updateCheckPoint(i, { unit: e.target.value })}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </>
                ) : (
                  <input
                    placeholder="Expected value (e.g. No Abnormal Noise)"
                    value={cp.expectedValue}
                    onChange={(e) => updateCheckPoint(i, { expectedValue: e.target.value })}
                    className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                )}
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input type="checkbox" checked={cp.mandatory} onChange={(e) => updateCheckPoint(i, { mandatory: e.target.checked })} />
                  Mandatory
                </label>
                {checkPoints.length > 1 && (
                  <button type="button" onClick={() => removeCheckPoint(i)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addCheckPoint} className="w-fit text-xs text-indigo-600 hover:underline">
              + Add check point
            </button>
          </div>

          <button type="submit" className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save Template
          </button>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {templates?.map((t) => {
              const groups = new Map<string, typeof t.checkPoints>();
              for (const cp of [...t.checkPoints].sort((a, b) => a.orderIndex - b.orderIndex)) {
                if (!groups.has(cp.equipmentGroup)) groups.set(cp.equipmentGroup, []);
                groups.get(cp.equipmentGroup)!.push(cp);
              }
              return (
                <li key={t.id} className="p-4">
                  <p className="font-medium text-gray-900">
                    {t.name} <span className="text-xs text-gray-400">v{t.version}</span>{' '}
                    <span className="text-xs text-gray-400">
                      ({t.assetCategory ? `${t.assetCategory}, ` : ''}
                      {t.maintenanceType})
                    </span>
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    {[...groups.entries()].map(([groupName, groupCheckPoints]) => (
                      <div key={groupName} className="text-xs text-gray-500">
                        <p className="font-medium text-gray-600">{groupName}</p>
                        <ul className="flex flex-col gap-0.5 pl-2">
                          {groupCheckPoints.map((cp) => (
                            <li key={cp.id}>
                              {cp.checkPointName} {cp.mandatory && '(mandatory)'} —{' '}
                              {cp.criteriaType === 'NUMERIC'
                                ? `${cp.direction === 'ABOVE' ? '<' : '>'} ${cp.criticalThreshold ?? '—'} ${cp.unit ?? ''}`
                                : cp.expectedValue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
