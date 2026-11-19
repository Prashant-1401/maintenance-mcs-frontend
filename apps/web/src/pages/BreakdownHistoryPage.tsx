import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import type { AdminBreakdownHistory, Asset, Location } from '../lib/types';

export function BreakdownHistoryPage() {
  const [locationId, setLocationId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [failureCategory, setFailureCategory] = useState('');
  const [status, setStatus] = useState('');

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get<Location[]>('/locations')).data,
  });
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['breakdown-history-admin', locationId, assetId, dateFrom, dateTo, failureCategory, status],
    queryFn: async () =>
      (
        await api.get<AdminBreakdownHistory>('/breakdowns/history', {
          params: {
            locationId: locationId || undefined,
            assetId: assetId || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            failureCategory: failureCategory || undefined,
            status: status || undefined,
          },
        })
      ).data,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Breakdown History</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Line/Location</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Machine</label>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            {assets?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Failure category</label>
          <select value={failureCategory} onChange={(e) => setFailureCategory(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="MECHANICAL">Mechanical</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="UTILITY">Utility</option>
            <option value="INSTRUMENTATION">Instrumentation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="ATTENDED">Attended</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {data?.groups.map((group) => (
            <div key={group.location.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">{group.location.name}</h2>
              {group.machines.map((m) => (
                <div key={m.asset.id} className="mb-3 last:mb-0">
                  <p className="text-sm font-medium text-gray-800">
                    {m.asset?.tag} — {m.asset?.name} <span className="text-xs text-gray-400">({m.breakdownCount} breakdowns)</span>
                  </p>
                  <ul className="mt-1 flex flex-col gap-1 pl-3 text-xs text-gray-600">
                    {m.breakdowns.map((wo) => (
                      <li key={wo.id} className="flex items-center justify-between border-b border-gray-50 pb-1">
                        <span>
                          {wo.breakdownDetail && new Date(wo.breakdownDetail.occurredAt).toLocaleDateString()} —{' '}
                          {wo.breakdownDetail?.symptom}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={wo.status} />
                          <Link to={`/breakdowns/${wo.id}`} className="text-indigo-600 hover:underline">
                            View
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <h2 className="border-b border-gray-100 p-4 text-sm font-semibold text-gray-900">All Breakdowns (newest first)</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Line</th>
                  <th className="px-4 py-2">Asset</th>
                  <th className="px-4 py-2">Symptom</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data?.breakdowns.map((wo) => (
                  <tr key={wo.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">{wo.breakdownDetail && new Date(wo.breakdownDetail.occurredAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{wo.asset?.location?.name ?? '—'}</td>
                    <td className="px-4 py-2">{wo.asset?.tag ?? '—'}</td>
                    <td className="px-4 py-2">{wo.breakdownDetail?.symptom}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-4 py-2">
                      <Link to={`/breakdowns/${wo.id}`} className="text-indigo-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
