import { useMemo, useState } from 'react';

export type Preset = '1m' | '3m' | '6m' | '1y' | 'custom';
const PRESET_LABELS: Record<Preset, string> = { '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '1y': '1 Year', custom: 'Custom' };

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === '1m') from.setMonth(from.getMonth() - 1);
  else if (preset === '3m') from.setMonth(from.getMonth() - 3);
  else if (preset === '1y') from.setFullYear(from.getFullYear() - 1);
  else from.setMonth(from.getMonth() - 6);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** 1 and 3 month windows are broken down daily; everything longer is monthly. */
export function granularityForPreset(preset: Preset): 'day' | 'month' {
  return preset === '1m' || preset === '3m' ? 'day' : 'month';
}

export function useTimelineRange(initial: Preset = '6m') {
  const [preset, setPreset] = useState<Preset>(initial);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => (preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset)), [preset, customFrom, customTo]);
  const granularity = granularityForPreset(preset);
  const ready = !!range.from && !!range.to;

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range, granularity, ready };
}

export function TimelineSelector({ state }: { state: ReturnType<typeof useTimelineRange> }) {
  const { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range, ready } = state;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <span className="text-xs font-medium text-gray-500">Timeline:</span>
      <div className="flex rounded-md border border-gray-300 text-sm">
        {(['1m', '3m', '6m', '1y', 'custom'] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`px-3 py-1 first:rounded-l-md last:rounded-r-md ${preset === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
          <span className="text-gray-400">to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </>
      )}
      {ready && (
        <span className="ml-auto text-xs text-gray-400">
          {range.from} → {range.to}
        </span>
      )}
    </div>
  );
}
