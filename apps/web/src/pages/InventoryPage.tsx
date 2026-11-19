import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../lib/api';
import type { Asset, SparePartInventoryItem, SparePartInventoryResponse } from '../lib/types';

const PIE_COLORS = ['#ef4444', '#3b82f6', '#8b5cf6'];

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [assetFilter, setAssetFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SparePartInventoryItem | null>(null);

  // Fetch Assets for dropdown filter
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });

  // Fetch Inventory & Usage Analytics
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['spare-parts-inventory', search, typeFilter, assetFilter, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (assetFilter) params.set('assetId', assetFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const res = await api.get<SparePartInventoryResponse>(`/spare-parts/inventory?${params.toString()}`);
      return res.data;
    },
  });

  const summary = inventoryData?.summary;
  const rawItems = inventoryData?.items ?? [];
  const items = onlyUsed ? rawItems.filter((i) => i.timesUsed > 0) : rawItems;

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    if (assetFilter) params.set('assetId', assetFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    window.open(`${api.defaults.baseURL}/spare-parts/inventory/export?${params.toString()}`, '_blank');
  };

  const pieData = [
    { name: 'Breakdown', value: summary?.totalBreakdownUsages || 0 },
    { name: 'Preventive (PM)', value: summary?.totalPmUsages || 0 },
    { name: 'Predictive (PdM)', value: summary?.totalPredictiveUsages || 0 },
  ].filter((d) => d.value > 0);

  const topUsedBarData = (summary?.topUsedItems || []).map((item) => ({
    name: item.name.length > 15 ? `${item.name.substring(0, 15)}…` : item.name,
    fullName: item.name,
    itemCode: item.itemCode,
    timesUsed: item.timesUsed,
    totalQty: item.totalQuantityUsed,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Spare Usage</h1>
          <p className="text-sm text-gray-500">
            Real-time track of spare parts consumption frequency, total quantities used, and maintenance history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/spare-parts"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            Catalog Master
          </Link>
          <button
            onClick={() => handleExport('xlsx')}
            className="rounded-md border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 shadow-sm"
          >
            Export Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="rounded-md border border-rose-600 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 shadow-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Master Catalog Spares</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">{summary?.totalMasterParts ?? 0}</span>
            <span className="text-xs font-medium text-gray-400">Registered</span>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Unique Spares Consumed</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-900">{summary?.totalUniqueUsed ?? 0}</span>
            <span className="text-xs font-medium text-indigo-600">Active In Work Orders</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Quantity Consumed</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-900">{summary?.totalQuantityConsumed ?? 0}</span>
            <span className="text-xs font-medium text-emerald-600">Units / Parts</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Total Spare Cost</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-900">
              ${(summary?.totalCostSpent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-medium text-amber-600">Spend To Date</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts (Top used & Usage Breakdown) */}
      {summary && summary.totalUniqueUsed > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top 5 Most Replaced Spares */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Top 5 Most Replaced Spares (Frequency vs Qty)</h3>
              <span className="text-xs text-gray-400">By Times Logged in Work Orders</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsedBarData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val, name) => [val, name === 'timesUsed' ? 'Times Replaced' : 'Total Qty']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="timesUsed" name="timesUsed" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalQty" name="totalQty" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Maintenance Type Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Usage by Maintenance Category</h3>
            <p className="text-xs text-gray-500 mb-2">Breakdown vs Preventive vs Predictive demand</p>
            <div className="flex-1 min-h-[200px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">No usage data recorded</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Search Spare Part</label>
            <input
              type="text"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Maintenance Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Maintenance Types</option>
              <option value="BREAKDOWN">Breakdown Maintenance</option>
              <option value="PM">Preventive Maintenance (PM)</option>
              <option value="PREDICTIVE">Predictive Maintenance (PdM)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Filter by Machine</label>
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Machines / Assets</option>
              {assets?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between border-t border-gray-100 pt-3 text-xs">
          <label className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyUsed}
              onChange={(e) => setOnlyUsed(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show only spares used at least once ({summary?.totalUniqueUsed ?? 0})
          </label>

          {(search || typeFilter || assetFilter || fromDate || toDate || onlyUsed) && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setAssetFilter('');
                setFromDate('');
                setToDate('');
                setOnlyUsed(false);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Inventory & Usage Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Spare Parts Consumption List ({items.length} {items.length === 1 ? 'item' : 'items'})
          </h2>
          <span className="text-xs text-gray-500">Sorted by most frequently used</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading inventory data…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No spare parts found matching the criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50/50 text-gray-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Spare Part Name</th>
                  <th className="px-4 py-3 text-center">Times Used (Frequency)</th>
                  <th className="px-4 py-3 text-right">Total Qty Used</th>
                  <th className="px-4 py-3 text-center">Type Breakdown</th>
                  <th className="px-4 py-3 text-center">Last Used</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((part) => (
                  <tr key={part.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      {part.itemCode === 'ADHOC' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Ad-hoc
                        </span>
                      ) : (
                        part.itemCode
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{part.name}</td>
                    <td className="px-4 py-3 text-center">
                      {part.timesUsed > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                          {part.timesUsed} {part.timesUsed === 1 ? 'time' : 'times'}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">0 times</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {part.totalQuantityUsed > 0 ? (
                        <span className="text-gray-900 font-semibold">
                          {part.totalQuantityUsed} {part.unit ?? ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {part.timesUsed > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-[10px]">
                          {part.breakdownCount > 0 && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700" title="Breakdowns">
                              {part.breakdownCount} BD
                            </span>
                          )}
                          {part.pmCount > 0 && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700" title="PM Work Orders">
                              {part.pmCount} PM
                            </span>
                          )}
                          {part.predictiveCount > 0 && (
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-700" title="Predictive Work Orders">
                              {part.predictiveCount} PdM
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {part.lastUsedAt ? new Date(part.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {part.timesUsed > 0 ? (
                        <button
                          onClick={() => setSelectedItem(part)}
                          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                        >
                          View History ({part.timesUsed})
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">No logs</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage History Modal / Detail Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {selectedItem.itemCode}
                  </span>
                  <h3 className="text-base font-bold text-gray-900">{selectedItem.name}</h3>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Total Used: <span className="font-bold text-gray-700">{selectedItem.timesUsed} times</span> | Total Qty:{' '}
                  <span className="font-bold text-gray-700">
                    {selectedItem.totalQuantityUsed} {selectedItem.unit ?? ''}
                  </span>{' '}
                  | Total Spend: <span className="font-bold text-gray-700">${selectedItem.totalCost.toFixed(2)}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Content Table */}
            <div className="flex-1 overflow-y-auto p-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Work Order Consumption Log</h4>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Machine / Asset</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-center">Work Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedItem.usages.map((u) => {
                      const linkTarget =
                        u.workOrderType === 'BREAKDOWN'
                          ? `/breakdowns/${u.workOrderId}`
                          : u.workOrderType === 'PM'
                          ? `/pm-work-orders/${u.workOrderId}`
                          : `/predictive-work-orders/${u.workOrderId}`;

                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {new Date(u.usedAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5">
                            {u.workOrderType === 'BREAKDOWN' ? (
                              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                Breakdown
                              </span>
                            ) : u.workOrderType === 'PM' ? (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                                Preventive (PM)
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                                Predictive (PdM)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Link to={`/assets/${u.assetId}`} className="font-medium text-indigo-600 hover:underline">
                              {u.assetTag}
                            </Link>
                            <span className="text-gray-500 ml-1.5 font-normal">({u.assetName})</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {u.quantity} {u.unit ?? ''}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">
                            {u.totalCost > 0 ? `$${u.totalCost.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Link
                              to={linkTarget}
                              className="inline-flex items-center rounded bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Open WO ›
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 text-right">
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-md bg-gray-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
