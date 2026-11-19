import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_MANAGEMENT, MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { StartScheduleModal } from '../components/StartScheduleModal';
import { DelayScheduleModal } from '../components/DelayScheduleModal';
import { ScheduleHistory } from '../components/ScheduleHistory';
import { MachineScopePicker } from '../components/MachineScopePicker';
import { usePersistedState } from '../lib/usePersistedState';
import type { Asset, ChecklistTemplate, Location, PmSchedule } from '../lib/types';

export function PmSchedulesPage() {
  const { user } = useAuth();
  const canManage = hasTier(user?.tier, ADMIN_MANAGEMENT);
  const canStart = hasTier(user?.tier, MAINTENANCE_TEAM);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = usePersistedState<'list' | 'calendar'>('pm-schedules-view', 'list');
  const [startingSchedule, setStartingSchedule] = useState<PmSchedule | null>(null);
  const [delayingSchedule, setDelayingSchedule] = useState<PmSchedule | null>(null);

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['pm-schedules'],
    queryFn: async () => (await api.get<PmSchedule[]>('/pm-schedules')).data,
  });
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get<Location[]>('/locations')).data,
  });
  const { data: templates } = useQuery({
    queryKey: ['pm-checklist-templates'],
    queryFn: async () => (await api.get<ChecklistTemplate[]>('/pm-checklist-templates')).data,
  });

  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [intervalDays, setIntervalDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [checklistTemplateId, setChecklistTemplateId] = useState('');

  const createSchedule = useMutation({
    mutationFn: async () =>
      Promise.all(
        assetIds.map((assetId) =>
          api.post('/pm-schedules', {
            assetId,
            name,
            triggerType: 'TIME',
            triggerConfig: { intervalDays },
            leadTimeDays,
            checklistTemplateId: checklistTemplateId || undefined,
          }),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-schedules'] });
      setShowForm(false);
      setName('');
      setAssetIds([]);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">PM Schedules</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 text-sm">
            <button
              onClick={() => setView('list')}
              className={`rounded-l-md px-3 py-1.5 ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`rounded-r-md px-3 py-1.5 ${view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Calendar
            </button>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setView('list');
                setShowForm((v) => !v);
              }}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New Schedule
            </button>
          )}
        </div>
      </div>

      {view === 'calendar' && <ScheduleCalendar workOrderType="PM" detailBasePath="/pm-work-orders" />}

      {view === 'list' && showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSchedule.mutate();
          }}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Applies to</label>
            <MachineScopePicker assets={assets ?? []} locations={locations ?? []} selectedAssetIds={assetIds} onChange={setAssetIds} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Schedule name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Interval (days)</label>
              <input
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Lead time (days)</label>
              <input
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Checklist template</label>
              <select
                value={checklistTemplateId}
                onChange={(e) => setChecklistTemplateId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">None</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={assetIds.length === 0}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save {assetIds.length > 1 ? `(${assetIds.length} schedules)` : ''}
            </button>
          </div>
        </form>
      )}

      {view === 'list' && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Asset</th>
                  <th className="px-4 py-2">Interval</th>
                  <th className="px-4 py-2">Last generated</th>
                  <th className="px-4 py-2">History</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {schedules?.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2">{s.asset?.tag}</td>
                    <td className="px-4 py-2">
                      {s.triggerType === 'TIME' && typeof s.triggerConfig.intervalDays === 'number'
                        ? `every ${s.triggerConfig.intervalDays}d`
                        : s.triggerType}
                    </td>
                    <td className="px-4 py-2">{s.lastGeneratedAt ? new Date(s.lastGeneratedAt).toLocaleString() : 'Never'}</td>
                    <td className="px-4 py-2">
                      <ScheduleHistory apiBase="/pm-schedules" scheduleId={s.id} detailBasePath="/pm-work-orders" />
                    </td>
                    <td className="px-4 py-2">
                      {canStart && (
                        <div className="flex gap-3">
                          <button onClick={() => setStartingSchedule(s)} className="text-indigo-600 hover:underline">
                            Start
                          </button>
                          <button onClick={() => setDelayingSchedule(s)} className="text-amber-600 hover:underline">
                            Delay it
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {startingSchedule && (
        <StartScheduleModal
          apiBase="/pm-schedules"
          scheduleId={startingSchedule.id}
          scheduleName={startingSchedule.name}
          onClose={() => setStartingSchedule(null)}
        />
      )}

      {delayingSchedule && (
        <DelayScheduleModal
          apiBase="/pm-schedules"
          scheduleId={delayingSchedule.id}
          scheduleName={delayingSchedule.name}
          onClose={() => setDelayingSchedule(null)}
        />
      )}
    </div>
  );
}
