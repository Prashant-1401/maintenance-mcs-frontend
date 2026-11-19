import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import type { WorkOrder } from '../lib/types';

interface Props {
  apiBase: '/pm-schedules' | '/predictive-schedules';
  scheduleId: string;
  detailBasePath: string;
}

export function ScheduleHistory({ apiBase, scheduleId, detailBasePath }: Props) {
  const [open, setOpen] = useState(false);

  const { data: history } = useQuery({
    queryKey: [`${apiBase.slice(1)}-history`, scheduleId],
    queryFn: async () => (await api.get<WorkOrder[]>(`${apiBase}/${scheduleId}/history`)).data,
    enabled: open,
  });

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-indigo-600 hover:underline">
        {open ? 'Hide' : 'View'} history
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 p-2">
          {!history ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-500">No past instances yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="py-1 pr-2">Due</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Completed</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((wo) => (
                  <tr key={wo.id} className="border-t border-gray-200">
                    <td className="py-1 pr-2">{wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="py-1 pr-2">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="py-1 pr-2">{wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : '—'}</td>
                    <td className="py-1">
                      <Link to={`${detailBasePath}/${wo.id}`} className="text-indigo-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
