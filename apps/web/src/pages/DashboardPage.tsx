import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { MAINTENANCE_TEAM, hasTier } from '../lib/roles';
import { TimelineSelector, useTimelineRange } from '../components/TimelineSelector';
import { KpiTrendModal } from '../components/KpiTrendModal';
import type {
  Asset,
  AssetKpi,
  CostTrendPoint,
  EquipmentPerformanceEntry,
  KpiDashboard,
  KpiMetric,
  KpiTrendPoint,
  LineKpi,
} from '../lib/types';

interface OpenMetric {
  metric: KpiMetric;
  label: string;
  isPercent?: boolean;
  unitSuffix?: string;
}

function StatCard({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : 'cursor-default'}`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      {onClick && <p className="mt-1 text-xs text-indigo-500">View trend →</p>}
    </button>
  );
}

function pct(n: number | null) {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

/** Shared summary KPI row — identical on Overall/By Line/By Machine so the tabs stay visually aligned. */
function KpiStatCards({ data, range, granularity }: { data: KpiDashboard; range: { from: string; to: string }; granularity: 'day' | 'month' }) {
  const [openMetric, setOpenMetric] = useState<OpenMetric | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="MTTR"
          value={data.mttrMinutes != null ? `${Math.round(data.mttrMinutes)} min` : '—'}
          sub="Mean time to repair"
          onClick={() => setOpenMetric({ metric: 'mttr', label: 'MTTR', unitSuffix: ' min' })}
        />
        <StatCard
          label="MTBF"
          value={data.mtbfDaysOverall != null ? `${data.mtbfDaysOverall.toFixed(1)} days` : '—'}
          sub="Mean time between failures"
          onClick={() => setOpenMetric({ metric: 'mtbf', label: 'MTBF', unitSuffix: ' days' })}
        />
        <StatCard
          label="Breakdowns (closed)"
          value={String(data.breakdownCount)}
          onClick={() => setOpenMetric({ metric: 'breakdownCount', label: 'Breakdowns' })}
        />
        <StatCard
          label="PM Compliance"
          value={pct(data.pm.pmComplianceRate)}
          sub={`${data.pm.closedPm} / ${data.pm.totalPm} closed`}
          onClick={() => setOpenMetric({ metric: 'pmCompliance', label: 'PM Compliance', isPercent: true })}
        />
        <StatCard
          label="Predictive Compliance"
          value={pct(data.predictive.predictiveComplianceRate)}
          sub={`${data.predictive.closedPredictive} / ${data.predictive.totalPredictive} closed`}
          onClick={() => setOpenMetric({ metric: 'predictiveCompliance', label: 'Predictive Compliance', isPercent: true })}
        />
        <StatCard
          label="RCA Closure Rate"
          value={pct(data.rca.rcaClosureRate)}
          sub={`${data.rca.doneOrVerified} / ${data.rca.totalActionItems} done`}
          onClick={() => setOpenMetric({ metric: 'rcaClosureRate', label: 'RCA Closure Rate', isPercent: true })}
        />
        <StatCard label="Overdue RCA Actions" value={String(data.rca.overdueActionItems)} />
        <StatCard
          label="Predictive Readings (30d)"
          value={String(data.predictiveTrend.normal + data.predictiveTrend.warning + data.predictiveTrend.critical)}
          sub={`${data.predictiveTrend.critical} critical, ${data.predictiveTrend.warning} warning`}
        />
      </div>

      {openMetric && <KpiTrendModal {...openMetric} range={range} granularity={granularity} onClose={() => setOpenMetric(null)} />}
    </>
  );
}

function BreakdownTrendChart({ trends }: { trends: KpiTrendPoint[] }) {
  if (trends.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Breakdown Trend</h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={trends} margin={{ bottom: 24, left: 12, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} label={{ value: 'Period', position: 'insideBottom', offset: -16 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              label={{ value: 'Breakdowns', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              label={{ value: 'Downtime (min)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar yAxisId="left" dataKey="breakdownCount" name="Breakdowns" fill="#6366f1" />
            <Bar yAxisId="right" dataKey="downtimeMinutes" name="Downtime (min)" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CostTrendChart({ costTrend }: { costTrend: CostTrendPoint[] }) {
  if (costTrend.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Maintenance Cost Trend — Manpower vs Spares</h2>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={costTrend} margin={{ bottom: 24, left: 12, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} label={{ value: 'Period', position: 'insideBottom', offset: -16 }} />
            <YAxis tick={{ fontSize: 12 }} label={{ value: 'Cost', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar dataKey="manpowerCost" name="Manpower" stackId="cost" fill="#6366f1" />
            <Bar dataKey="sparesCost" name="Spares" stackId="cost" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function OverallTab({ data }: { data: KpiDashboard }) {
  const timeline = useTimelineRange('6m');
  const { range, granularity, ready } = timeline;

  const { data: trends } = useQuery({
    queryKey: ['kpi-trends', range.from, range.to, granularity],
    queryFn: async () => (await api.get<KpiTrendPoint[]>('/kpi/trends', { params: { ...range, granularity } })).data,
    enabled: ready,
  });
  const { data: costTrend } = useQuery({
    queryKey: ['kpi-cost-trend', range.from, range.to, granularity],
    queryFn: async () => (await api.get<CostTrendPoint[]>('/kpi/cost-trend', { params: { ...range, granularity } })).data,
    enabled: ready,
  });
  const { data: equipmentPerformance } = useQuery({
    queryKey: ['kpi-equipment-performance', range.from, range.to],
    queryFn: async () => (await api.get<EquipmentPerformanceEntry[]>('/kpi/equipment-performance', { params: range })).data,
    enabled: ready,
  });

  return (
    <div className="flex flex-col gap-6">
      <KpiStatCards data={data} range={range} granularity={granularity} />

      <TimelineSelector state={timeline} />

      {trends && <BreakdownTrendChart trends={trends} />}
      {costTrend && <CostTrendChart costTrend={costTrend} />}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Equipment Performance</h2>
        {!equipmentPerformance || equipmentPerformance.length === 0 ? (
          <p className="text-sm text-gray-500">No breakdown history in this range.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-2">Asset</th>
                <th className="py-2">Breakdowns</th>
                <th className="py-2">MTTR</th>
                <th className="py-2">MTBF</th>
                <th className="py-2">Availability</th>
              </tr>
            </thead>
            <tbody>
              {equipmentPerformance.map((e) => (
                <tr key={e.assetId} className="border-b border-gray-50">
                  <td className="py-2">
                    {e.assetTag} — {e.assetName}
                  </td>
                  <td className="py-2">{e.breakdownCount}</td>
                  <td className="py-2">{e.mttrMinutes != null ? `${Math.round(e.mttrMinutes)} min` : '—'}</td>
                  <td className="py-2">{e.mtbfDays != null ? `${e.mtbfDays.toFixed(1)} days` : '—'}</td>
                  <td className="py-2">{pct(e.availability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Top Failing Assets</h2>
        {data.topFailingAssets.length === 0 ? (
          <p className="text-sm text-gray-500">No breakdown history yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-2">Asset</th>
                <th className="py-2">Breakdowns</th>
                <th className="py-2">Cumulative Downtime</th>
              </tr>
            </thead>
            <tbody>
              {data.topFailingAssets.map((a) => (
                <tr key={a.assetId} className="border-b border-gray-50">
                  <td className="py-2">
                    {a.assetTag} — {a.assetName}
                  </td>
                  <td className="py-2">{a.count}</td>
                  <td className="py-2">{Math.round(a.downtimeMinutes)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LinesTab({ data }: { data: KpiDashboard }) {
  const [locationId, setLocationId] = useState('');
  const timeline = useTimelineRange('6m');
  const { range, granularity, ready } = timeline;

  const { data: lines, isLoading } = useQuery({
    queryKey: ['kpi-lines', range.from, range.to],
    queryFn: async () => (await api.get<LineKpi[]>('/kpi/lines', { params: range })).data,
    enabled: ready,
  });

  const selectedLine = useMemo(() => lines?.find((l) => l.location.id === locationId), [lines, locationId]);

  const { data: trends } = useQuery({
    queryKey: ['kpi-trends', range.from, range.to, granularity, locationId],
    queryFn: async () =>
      (
        await api.get<KpiTrendPoint[]>('/kpi/trends', {
          params: { ...range, granularity, ...(locationId ? { locationId } : {}) },
        })
      ).data,
    enabled: ready,
  });

  const { data: costTrend } = useQuery({
    queryKey: ['kpi-cost-trend', range.from, range.to, granularity, locationId],
    queryFn: async () =>
      (
        await api.get<CostTrendPoint[]>('/kpi/cost-trend', {
          params: { ...range, granularity, ...(locationId ? { locationId } : {}) },
        })
      ).data,
    enabled: ready,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Filter by Plant Line:</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Plant Lines (Aggregated)</option>
            {lines?.map((l) => (
              <option key={l.location.id} value={l.location.id}>
                {l.location.name} ({l.breakdownCount} breakdowns)
              </option>
            ))}
          </select>
        </div>
        {selectedLine && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Active Filter: {selectedLine.location.name}
          </span>
        )}
      </div>

      {selectedLine ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label={`${selectedLine.location.name} Breakdowns`} value={String(selectedLine.breakdownCount)} />
          <StatCard
            label="Line MTTR"
            value={selectedLine.mttrMinutes != null ? `${Math.round(selectedLine.mttrMinutes)} min` : '—'}
          />
          <StatCard label="Total Line Downtime" value={`${Math.round(selectedLine.downtimeMinutes)} min`} />
          <StatCard
            label="Avg Downtime / Event"
            value={selectedLine.breakdownCount > 0 ? `${Math.round(selectedLine.downtimeMinutes / selectedLine.breakdownCount)} min` : '—'}
          />
        </div>
      ) : (
        <KpiStatCards data={data} range={range} granularity={granularity} />
      )}

      <TimelineSelector state={timeline} />

      {trends && <BreakdownTrendChart trends={trends} />}
      {costTrend && <CostTrendChart costTrend={costTrend} />}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900">Line Reliability Comparison</h2>
          <p className="text-xs text-gray-500">Click a line from the dropdown above to filter historical trends.</p>
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : lines && lines.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-4 py-2">Line</th>
                <th className="px-4 py-2">Breakdowns</th>
                <th className="px-4 py-2">Downtime</th>
                <th className="px-4 py-2">MTTR</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.location.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${
                    locationId === l.location.id ? 'bg-indigo-50 font-medium' : ''
                  }`}
                >
                  <td className="px-4 py-2">{l.location.name}</td>
                  <td className="px-4 py-2">{l.breakdownCount}</td>
                  <td className="px-4 py-2">{Math.round(l.downtimeMinutes)} min</td>
                  <td className="px-4 py-2">{l.mttrMinutes != null ? `${Math.round(l.mttrMinutes)} min` : '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setLocationId(locationId === l.location.id ? '' : l.location.id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {locationId === l.location.id ? 'Clear' : 'View Trends'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-gray-500">No breakdown history in this range.</p>
        )}
      </div>
    </div>
  );
}

function MachinesTab({ data }: { data: KpiDashboard }) {
  const [assetId, setAssetId] = useState('');
  const timeline = useTimelineRange('6m');
  const { range, granularity, ready } = timeline;

  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });

  const selectedAsset = useMemo(() => assets?.find((a) => a.id === assetId), [assets, assetId]);

  const { data: assetKpi } = useQuery({
    queryKey: ['kpi-asset', assetId, range.from, range.to],
    queryFn: async () => (await api.get<AssetKpi>(`/kpi/assets/${assetId}`, { params: range })).data,
    enabled: !!assetId && ready,
  });

  const { data: trends } = useQuery({
    queryKey: ['kpi-trends', range.from, range.to, granularity, assetId],
    queryFn: async () =>
      (
        await api.get<KpiTrendPoint[]>('/kpi/trends', {
          params: { ...range, granularity, ...(assetId ? { assetId } : {}) },
        })
      ).data,
    enabled: ready,
  });

  const { data: costTrend } = useQuery({
    queryKey: ['kpi-cost-trend', range.from, range.to, granularity, assetId],
    queryFn: async () =>
      (
        await api.get<CostTrendPoint[]>('/kpi/cost-trend', {
          params: { ...range, granularity, ...(assetId ? { assetId } : {}) },
        })
      ).data,
    enabled: ready,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Select Machine / Asset:</label>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Machines (Overall Plant Overview)</option>
            {assets?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag} — {a.name} ({a.category || 'General'})
              </option>
            ))}
          </select>
        </div>
        {selectedAsset && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Selected: {selectedAsset.tag} — {selectedAsset.name}
          </span>
        )}
      </div>

      {assetId && assetKpi ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label={`${selectedAsset?.tag ?? 'Machine'} Breakdowns`} value={String(assetKpi.breakdownCount)} />
          <StatCard
            label="Machine MTTR"
            value={assetKpi.mttrMinutes != null ? `${Math.round(assetKpi.mttrMinutes)} min` : '—'}
          />
          <StatCard
            label="Machine MTBF"
            value={assetKpi.mtbfDays != null ? `${assetKpi.mtbfDays.toFixed(1)} days` : '—'}
            sub={assetKpi.breakdownCount < 2 ? 'Requires ≥ 2 breakdowns' : undefined}
          />
          <StatCard
            label="PM Compliance"
            value={pct(assetKpi.pm.pmComplianceRate)}
            sub={`${assetKpi.pm.closedPm} / ${assetKpi.pm.totalPm} closed`}
          />
          <StatCard
            label="RCA Closure Rate"
            value={pct(assetKpi.rca.rcaClosureRate)}
            sub={`${assetKpi.rca.doneOrVerified} / ${assetKpi.rca.totalActionItems} done`}
          />
        </div>
      ) : (
        <KpiStatCards data={data} range={range} granularity={granularity} />
      )}

      <TimelineSelector state={timeline} />

      {trends && <BreakdownTrendChart trends={trends} />}
      {costTrend && <CostTrendChart costTrend={costTrend} />}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canViewKpi = hasTier(user?.tier, MAINTENANCE_TEAM);
  const [tab, setTab] = useState<'overall' | 'lines' | 'machines'>('overall');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['kpi-dashboard'],
    queryFn: async () => (await api.get<KpiDashboard>('/kpi/dashboard')).data,
    enabled: canViewKpi,
  });

  if (!canViewKpi) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-sm text-gray-500">
          The KPI dashboard is available to Admins, Managers, and Technicians. Use the sidebar to raise a
          breakdown slip or track your submissions.
        </p>
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-600">Couldn't load the dashboard. Please try again.</p>;
  }

  if (isLoading || !data) {
    return <p className="text-gray-500">Loading dashboard…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">KPI Dashboard</h1>
        <div className="flex rounded-md border border-gray-300 text-sm">
          {(['overall', 'lines', 'machines'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 capitalize first:rounded-l-md last:rounded-r-md ${
                tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'overall' ? 'Overall' : t === 'lines' ? 'By Line' : 'By Machine'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overall' && <OverallTab data={data} />}
      {tab === 'lines' && <LinesTab data={data} />}
      {tab === 'machines' && <MachinesTab data={data} />}
    </div>
  );
}
