import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { MasterDataToolbar } from '../components/MasterDataToolbar';
import { ADMIN_ONLY, hasTier } from '../lib/roles';
import type { Asset, Location } from '../lib/types';

export function AssetsPage() {
  const { user } = useAuth();
  const canManage = hasTier(user?.tier, ADMIN_ONLY);
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get<Location[]>('/locations')).data,
  });

  const plants = useMemo(() => locations?.filter((l) => !l.parentId) ?? [], [locations]);
  const linesByPlant = useMemo(() => {
    const map = new Map<string, Location[]>();
    locations?.forEach((l) => {
      if (l.parentId) {
        map.set(l.parentId, [...(map.get(l.parentId) ?? []), l]);
      }
    });
    return map;
  }, [locations]);

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);

  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [assetPlantId, setAssetPlantId] = useState('');
  const [locationId, setLocationId] = useState('');

  const [locationKind, setLocationKind] = useState<'PLANT' | 'LINE'>('LINE');
  const [locationName, setLocationName] = useState('');
  const [parentId, setParentId] = useState('');

  const createAsset = useMutation({
    mutationFn: async () =>
      api.post('/assets', { tag, name, category: category || undefined, criticality, locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowAssetForm(false);
      setTag('');
      setName('');
      setCategory('');
      setAssetPlantId('');
      setLocationId('');
    },
  });

  const createLocation = useMutation({
    mutationFn: async () =>
      api.post('/locations', { name: locationName, parentId: locationKind === 'LINE' ? parentId : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowLocationForm(false);
      setLocationName('');
      setParentId('');
    },
  });

  const locationName_ = (id: string | null) => locations?.find((l) => l.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Machine Master</h1>
          <p className="text-sm text-gray-500">Plants, Lines, and the machines registered under each.</p>
        </div>
        <div className="flex items-start gap-3">
          <MasterDataToolbar resource="assets" onImported={() => queryClient.invalidateQueries({ queryKey: ['assets'] })} />
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowLocationForm((v) => !v)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                + Plant / Line
              </button>
              <button
                onClick={() => setShowAssetForm((v) => !v)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Machine
              </button>
            </div>
          )}
        </div>
      </div>

      {showLocationForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createLocation.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Type</label>
            <select
              value={locationKind}
              onChange={(e) => {
                setLocationKind(e.target.value as 'PLANT' | 'LINE');
                setParentId('');
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="PLANT">Plant</option>
              <option value="LINE">Line</option>
            </select>
          </div>
          {locationKind === 'LINE' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Plant</label>
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">Select…</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">{locationKind === 'PLANT' ? 'Plant name' : 'Line name'}</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              required
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save
          </button>
        </form>
      )}

      {showAssetForm && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createAsset.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Plant</label>
            <select
              value={assetPlantId}
              onChange={(e) => {
                setAssetPlantId(e.target.value);
                setLocationId('');
              }}
              required
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Line</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
              disabled={!assetPlantId}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
            >
              <option value="">Select…</option>
              {(linesByPlant.get(assetPlantId) ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Machine Code</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Machine Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Criticality</label>
            <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </div>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Save
          </button>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Machine Code</th>
                <th className="px-4 py-2">Machine Name</th>
                <th className="px-4 py-2">Plant</th>
                <th className="px-4 py-2">Line</th>
                <th className="px-4 py-2">Criticality</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets?.map((asset) => (
                <tr key={asset.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link to={`/assets/${asset.id}`} className="font-medium text-indigo-600 hover:underline">
                      {asset.tag}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{asset.name}</td>
                  <td className="px-4 py-2 text-gray-500">{locationName_(asset.location?.parentId ?? null)}</td>
                  <td className="px-4 py-2">{asset.location?.name}</td>
                  <td className="px-4 py-2">{asset.criticality}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={asset.status} />
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
