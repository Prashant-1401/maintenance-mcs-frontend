import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { SparePartMaster } from '../lib/types';
import { MasterDataToolbar } from '../components/MasterDataToolbar';

export function SparePartsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: parts, isLoading } = useQuery({
    queryKey: ['spare-parts'],
    queryFn: async () => (await api.get<SparePartMaster[]>('/spare-parts')).data,
  });

  const createPart = useMutation({
    mutationFn: async () =>
      api.post('/spare-parts', { itemCode, name, unit: unit || undefined, unitCost: unitCost ? Number(unitCost) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      setShowForm(false);
      setItemCode('');
      setName('');
      setUnit('');
      setUnitCost('');
      setError(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create spare part';
      setError(message);
    },
  });

  const updatePart = useMutation({
    mutationFn: async ({ id, unitCost: uc }: { id: string; unitCost: number }) => api.patch(`/spare-parts/${id}`, { unitCost: uc }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spare-parts'] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Spare Parts Master</h1>
          <p className="text-sm text-gray-500">Item code / name catalog technicians pick from when logging spares consumed.</p>
        </div>
        <div className="flex items-start gap-3">
          <Link
            to="/inventory"
            className="rounded-md border border-indigo-600 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            📊 Inventory & Usage
          </Link>
          <MasterDataToolbar resource="spare-parts" onImported={() => queryClient.invalidateQueries({ queryKey: ['spare-parts'] })} />
          <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + New Spare Part
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPart.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Item code</label>
            <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Unit</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Unit cost</label>
            <input
              type="number"
              step="any"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
              className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : parts?.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No spare parts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Item Code</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {parts?.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium">{p.itemCode}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">{p.unit ?? '—'}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      defaultValue={p.unitCost ?? ''}
                      placeholder="—"
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (e.target.value !== '' && value !== p.unitCost) updatePart.mutate({ id: p.id, unitCost: value });
                      }}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
