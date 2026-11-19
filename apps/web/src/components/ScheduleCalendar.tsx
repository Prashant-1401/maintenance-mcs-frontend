import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { PmCalendarColor, PmCalendarEntry } from '../lib/types';

const COLOR_CLASSES: Record<PmCalendarColor, string> = {
  GREY: 'bg-gray-200 text-gray-700',
  PURPLE: 'bg-purple-200 text-purple-800',
  GREEN: 'bg-green-200 text-green-800',
  RED: 'bg-red-200 text-red-800',
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  workOrderType: 'PM' | 'PREDICTIVE';
  detailBasePath: string;
}

export function ScheduleCalendar({ workOrderType, detailBasePath }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);

  const viewMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const from = useMemo(() => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1), [viewMonth]);
  const to = useMemo(() => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0, 23, 59, 59), [viewMonth]);

  const { data: entries } = useQuery({
    queryKey: ['schedule-calendar', workOrderType, from.toISOString(), to.toISOString()],
    queryFn: async () =>
      (
        await api.get<PmCalendarEntry[]>('/work-orders/calendar', {
          params: { type: workOrderType, from: from.toISOString(), to: to.toISOString() },
        })
      ).data,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, PmCalendarEntry[]>();
    for (const e of entries ?? []) {
      const key = toDateKey(new Date(e.dueDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  const daysInMonth = to.getDate();
  const firstWeekday = from.getDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
            ←
          </button>
          <span className="text-sm font-medium text-gray-700">
            {viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMonthOffset((m) => m + 1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
            →
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-gray-200" /> Scheduled
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-purple-200" /> Due today
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-green-200" /> On time
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-red-200" /> Overdue / late
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-gray-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = toDateKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
            const dayEntries = byDay.get(key) ?? [];
            return (
              <div key={i} className="min-h-[80px] rounded-md border border-gray-100 p-1">
                <p className="text-xs text-gray-400">{day}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {dayEntries.map((e) => (
                    <Link
                      key={e.id}
                      to={`${detailBasePath}/${e.id}`}
                      title={`${e.assetTag} — ${e.assetName}`}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${COLOR_CLASSES[e.color]}`}
                    >
                      {e.assetTag}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
