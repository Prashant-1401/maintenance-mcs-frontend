import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_ONLY, hasTier } from '../lib/roles';
import { MasterDataToolbar } from '../components/MasterDataToolbar';
import { ExcelImportPreview } from '../components/ExcelImportPreview';
import type { ChecklistInputType, ChecklistTemplate, MaintenanceType, ParsedPmItem, ParsedPmTemplate } from '../lib/types';

interface ItemDraft {
  orderIndex: number;
  instruction: string;
  mandatory: boolean;
  inputType: ChecklistInputType;
  equipmentGroup: string;
}

export function PmChecklistTemplatesPage() {
  const { user } = useAuth();
  const canManage = hasTier(user?.tier, ADMIN_ONLY);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [assetCategory, setAssetCategory] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('OTHER');
  const [items, setItems] = useState<ItemDraft[]>([
    { orderIndex: 1, instruction: '', mandatory: true, inputType: 'CHECKBOX', equipmentGroup: '' },
  ]);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['pm-checklist-templates'],
    queryFn: async () => (await api.get<ChecklistTemplate[]>('/pm-checklist-templates')).data,
  });

  const createTemplate = useMutation({
    mutationFn: async () =>
      api.post('/pm-checklist-templates', { name, assetCategory: assetCategory || undefined, maintenanceType, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-checklist-templates'] });
      setShowForm(false);
      setName('');
      setAssetCategory('');
      setItems([{ orderIndex: 1, instruction: '', mandatory: true, inputType: 'CHECKBOX', equipmentGroup: '' }]);
    },
  });

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () =>
    setItems((prev) => [...prev, { orderIndex: prev.length + 1, instruction: '', mandatory: true, inputType: 'CHECKBOX', equipmentGroup: '' }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">PM Checklist Templates</h1>
        <MasterDataToolbar resource="pm-checklist-templates" importable={false} />
      </div>

      {canManage && (
        <ExcelImportPreview<ParsedPmTemplate>
          title="Import from Excel"
          onUpload={async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post<ParsedPmTemplate>(
              `/pm-checklist-templates/import/preview?templateName=${encodeURIComponent(file.name.replace(/\.[^.]+$/, ''))}`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return data;
          }}
          onCommit={async (data) => {
            const flatItems: (ParsedPmItem & { orderIndex: number })[] = [];
            let orderIndex = 0;
            for (const group of data.equipmentGroups) {
              for (const item of group.items) {
                orderIndex += 1;
                flatItems.push({ ...item, orderIndex });
              }
            }
            await api.post('/pm-checklist-templates/import/commit', { name: data.templateName, items: flatItems });
            queryClient.invalidateQueries({ queryKey: ['pm-checklist-templates'] });
          }}
          renderSummary={(data) => (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{data.templateName}</span> — {data.totalItems} item(s) across {data.equipmentGroups.length} equipment group(s)
              </p>
              <ul className="max-h-48 overflow-y-auto text-xs text-gray-600">
                {data.equipmentGroups.map((g) => (
                  <li key={g.name}>
                    {g.name} — {g.items.length} item(s)
                  </li>
                ))}
              </ul>
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
            <p className="text-xs font-medium text-gray-700">Checklist items</p>
            {items.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 p-2">
                <input
                  placeholder="Equipment group"
                  value={item.equipmentGroup}
                  onChange={(e) => updateItem(i, { equipmentGroup: e.target.value })}
                  required
                  className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  placeholder="Instruction"
                  value={item.instruction}
                  onChange={(e) => updateItem(i, { instruction: e.target.value })}
                  required
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={item.inputType}
                  onChange={(e) => updateItem(i, { inputType: e.target.value as ChecklistInputType })}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="CHECKBOX">CHECKBOX</option>
                  <option value="NUMERIC">NUMERIC</option>
                  <option value="TEXT">TEXT</option>
                  <option value="PASS_FAIL">PASS_FAIL</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input type="checkbox" checked={item.mandatory} onChange={(e) => updateItem(i, { mandatory: e.target.checked })} />
                  Mandatory
                </label>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="w-fit text-xs text-indigo-600 hover:underline">
              + Add item
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
              const groups = new Map<string, typeof t.items>();
              for (const item of [...t.items].sort((a, b) => a.orderIndex - b.orderIndex)) {
                if (!groups.has(item.equipmentGroup)) groups.set(item.equipmentGroup, []);
                groups.get(item.equipmentGroup)!.push(item);
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
                    {[...groups.entries()].map(([groupName, groupItems]) => (
                      <div key={groupName} className="text-xs text-gray-500">
                        <p className="font-medium text-gray-600">{groupName}</p>
                        <ul className="flex flex-col gap-0.5 pl-2">
                          {groupItems.map((item) => (
                            <li key={item.id}>
                              {item.instruction} {item.mandatory && '(mandatory)'} — {item.inputType}
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
