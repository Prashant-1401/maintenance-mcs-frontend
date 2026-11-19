import { useMemo, useState } from 'react';
import type { Asset, Location } from '../lib/types';

interface MachineScopePickerProps {
  assets: Asset[];
  locations: Location[];
  selectedAssetIds: string[];
  onChange: (assetIds: string[]) => void;
}

/** Cascading Plant → Line → Machine(s) picker — lets an admin scope a schedule to one or more machines at once. */
export function MachineScopePicker({ assets, locations, selectedAssetIds, onChange }: MachineScopePickerProps) {
  const plants = useMemo(() => locations.filter((l) => !l.parentId), [locations]);
  const linesByPlant = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const l of locations) {
      if (l.parentId) map.set(l.parentId, [...(map.get(l.parentId) ?? []), l]);
    }
    return map;
  }, [locations]);

  const [plantId, setPlantId] = useState('');
  const [lineId, setLineId] = useState('');

  const lines = plantId ? (linesByPlant.get(plantId) ?? []) : [];
  const machinesInLine = lineId ? assets.filter((a) => a.locationId === lineId) : [];

  const toggleMachine = (id: string) => {
    onChange(selectedAssetIds.includes(id) ? selectedAssetIds.filter((x) => x !== id) : [...selectedAssetIds, id]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Plant</label>
          <select
            value={plantId}
            onChange={(e) => {
              setPlantId(e.target.value);
              setLineId('');
            }}
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
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            disabled={!plantId}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-100"
          >
            <option value="">Select…</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {lineId && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-gray-200 p-2">
          {machinesInLine.length === 0 ? (
            <p className="text-xs text-gray-400">No machines on this line.</p>
          ) : (
            machinesInLine.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedAssetIds.includes(a.id)} onChange={() => toggleMachine(a.id)} />
                {a.tag} — {a.name}
              </label>
            ))
          )}
        </div>
      )}

      {selectedAssetIds.length > 0 && (
        <p className="text-xs text-gray-500">
          {selectedAssetIds.length} machine(s) selected —{' '}
          {selectedAssetIds.map((id) => assets.find((a) => a.id === id)?.tag).filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  );
}
