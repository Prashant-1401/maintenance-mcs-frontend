import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MaintenanceType, PermissionTier, Role } from '../lib/types';
import { MasterDataToolbar } from '../components/MasterDataToolbar';

export function RolesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<PermissionTier>('TECHNICIAN');
  const [rank, setRank] = useState(100);
  const [capacity, setCapacity] = useState(5);
  const [hourlyRate, setHourlyRate] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  });

  const createRole = useMutation({
    mutationFn: async () =>
      api.post('/roles', {
        name,
        tier,
        rank,
        capacity,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        maintenanceType: maintenanceType || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowForm(false);
      setName('');
      setError(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create role';
      setError(message);
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      tier?: PermissionTier;
      rank?: number;
      capacity?: number;
      hourlyRate?: number;
    }) => api.patch(`/roles/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Roles</h1>
          <p className="text-sm text-gray-500">
            Define job titles for your team (e.g. "Welder") and map each to a permission tier that controls
            what they can do in the app.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <MasterDataToolbar resource="roles" onImported={() => queryClient.invalidateQueries({ queryKey: ['roles'] })} />
          <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + New Role
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createRole.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Role name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Permission tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value as PermissionTier)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option value="ADMIN">Admin (full system control)</option>
              <option value="MANAGEMENT">Management (oversight, assign work)</option>
              <option value="TECHNICIAN">Technician (hands-on work)</option>
              <option value="REQUESTER">Requester (raise & track own only)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Hierarchy rank</label>
            <input
              type="number"
              value={rank}
              onChange={(e) => setRank(Number(e.target.value))}
              className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Capacity (concurrent jobs)</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Hourly rate (labor cost)</label>
            <input
              type="number"
              step="any"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
              className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          {tier === 'TECHNICIAN' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Trade</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Other</option>
                <option value="MECHANICAL">Mechanical</option>
                <option value="ELECTRICAL">Electrical</option>
              </select>
            </div>
          )}
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Capacity</th>
                <th className="px-4 py-2">Hourly Rate</th>
                <th className="px-4 py-2">Trade</th>
              </tr>
            </thead>
            <tbody>
              {roles?.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      defaultValue={r.rank}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== r.rank) updateRole.mutate({ id: r.id, rank: value });
                      }}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">
                    <input
                      defaultValue={r.name}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== r.name) {
                          updateRole.mutate({ id: r.id, name: e.target.value });
                        }
                      }}
                      className="w-full rounded-md border border-transparent px-1 py-0.5 hover:border-gray-300 focus:border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={r.tier}
                      onChange={(e) => updateRole.mutate({ id: r.id, tier: e.target.value as PermissionTier })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGEMENT">Management</option>
                      <option value="TECHNICIAN">Technician</option>
                      <option value="REQUESTER">Requester</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      defaultValue={r.capacity}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value && value !== r.capacity) updateRole.mutate({ id: r.id, capacity: value });
                      }}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      defaultValue={r.hourlyRate ?? ''}
                      placeholder="—"
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (e.target.value !== '' && value !== r.hourlyRate) updateRole.mutate({ id: r.id, hourlyRate: value });
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-500">{r.maintenanceType ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
