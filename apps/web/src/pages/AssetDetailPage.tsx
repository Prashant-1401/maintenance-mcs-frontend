import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import type {
  Asset,
  BreakdownHistory,
  KnowledgeBankDocument,
  MachineOperationalBaseline,
  TroubleshootingPlaybook,
} from '../lib/types';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'history' | 'baselines' | 'docs' | 'playbooks'>('history');

  const { data: asset } = useQuery({
    queryKey: ['assets', id],
    queryFn: async () => (await api.get<Asset>(`/assets/${id}`)).data,
  });

  const { data: history } = useQuery({
    queryKey: ['breakdown-history', id],
    queryFn: async () => (await api.get<BreakdownHistory>(`/breakdowns/asset/${id}/history`)).data,
    enabled: !!id,
  });

  const { data: baselines } = useQuery({
    queryKey: ['asset-baselines', id],
    queryFn: async () => (await api.get<MachineOperationalBaseline[]>(`/knowledge-bank/baselines/all?assetId=${id}`)).data,
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ['asset-docs', id],
    queryFn: async () => (await api.get<KnowledgeBankDocument[]>(`/knowledge-bank?assetId=${id}`)).data,
    enabled: !!id,
  });

  const { data: playbooks } = useQuery({
    queryKey: ['asset-playbooks', id],
    queryFn: async () => (await api.get<TroubleshootingPlaybook[]>(`/knowledge-bank/playbooks/all?assetId=${id}`)).data,
    enabled: !!id,
  });

  if (!asset) return <p className="text-gray-500">Loading…</p>;

  async function handleDownload(doc: KnowledgeBankDocument) {
    const response = await api.get(`/knowledge-bank/${doc.id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Machine Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold uppercase bg-neutral-900 text-white px-2.5 py-1 rounded">
              {asset.tag}
            </span>
            <h1 className="text-xl font-bold text-gray-900">{asset.name}</h1>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Location: <span className="font-semibold text-gray-700">{asset.location?.name}</span> · Category:{' '}
            <span className="font-semibold text-gray-700">{asset.category ?? 'Uncategorized'}</span> · Criticality:{' '}
            <span className="font-semibold text-gray-700">{asset.criticality}</span>
          </p>
        </div>
        <StatusBadge status={asset.status} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'history' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Breakdown History Card
        </button>
        <button
          onClick={() => setActiveTab('baselines')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'baselines' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ⚙️ Operating Baselines & Nominals ({baselines?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'docs' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📄 Machine SOPs & Manuals ({documents?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('playbooks')}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === 'playbooks' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🛠️ Troubleshooting Playbooks ({playbooks?.length ?? 0})
        </button>
      </div>

      {/* Tab 1: Breakdown History */}
      {activeTab === 'history' && history && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-100">
              <p className="text-xs text-gray-500 font-medium">Breakdown Count</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{history.breakdownCount}</p>
            </div>
            <div className="rounded-lg bg-rose-50/50 p-3 border border-rose-100">
              <p className="text-xs text-rose-700 font-medium">Cumulative Downtime</p>
              <p className="text-xl font-bold text-rose-900 mt-1">{history.cumulativeDowntimeMinutes} min</p>
            </div>
            <div className="rounded-lg bg-amber-50/50 p-3 border border-amber-100">
              <p className="text-xs text-amber-700 font-medium">MTTR (Avg Downtime)</p>
              <p className="text-xl font-bold text-amber-900 mt-1">{history.averageDowntimeMinutes} min</p>
            </div>
            <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100">
              <p className="text-xs text-emerald-700 font-medium">Days Since Last Breakdown</p>
              <p className="text-xl font-bold text-emerald-900 mt-1">{history.daysSinceLastBreakdown ?? '—'}</p>
            </div>
          </div>

          {history.breakdowns.length === 0 ? (
            <p className="text-sm text-gray-500">No breakdowns recorded for this machine.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Occurred</th>
                    <th className="py-2.5 px-3">Symptom</th>
                    <th className="py-2.5 px-3">Failure Category</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.breakdowns.map((wo) => (
                    <tr key={wo.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-700">
                        {wo.breakdownDetail && new Date(wo.breakdownDetail.occurredAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-gray-900">{wo.breakdownDetail?.symptom}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                          {wo.breakdownDetail?.failureCategory}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link to={`/breakdowns/${wo.id}`} className="font-semibold text-indigo-600 hover:underline">
                          View Slip ›
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Operating Baselines */}
      {activeTab === 'baselines' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Standard Operational Parameters & Limits</h3>
            <Link
              to="/knowledge-bank"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Manage in Knowledge Bank ›
            </Link>
          </div>

          {!baselines || baselines.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No operating baseline parameters defined for this machine yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Parameter Name</th>
                    <th className="py-2.5 px-3 text-center">Nominal Value</th>
                    <th className="py-2.5 px-3 text-center">Warning Limits (Min - Max)</th>
                    <th className="py-2.5 px-3">Operating Mode</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {baselines.map((bl) => (
                    <tr key={bl.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{bl.parameterName}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/50">
                        {bl.nominalValue} {bl.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {bl.minThreshold != null ? `${bl.minThreshold} ${bl.unit}` : '—'} &nbsp;to&nbsp;{' '}
                        {bl.maxThreshold != null ? `${bl.maxThreshold} ${bl.unit}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">{bl.operatingMode || 'Standard Load'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{bl.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SOPs & Manuals */}
      {activeTab === 'docs' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Machine Operating SOPs & Manuals</h3>
            <Link to="/knowledge-bank" className="text-xs font-semibold text-indigo-600 hover:underline">
              + Upload to Knowledge Bank ›
            </Link>
          </div>

          {!documents || documents.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No documents specifically attached to this machine yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-gray-200 p-3 hover:border-indigo-300 transition">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-lg">📄</span>
                    <span className="text-[10px] font-semibold uppercase bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {doc.category || 'Doc'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-gray-900 line-clamp-1">{doc.title}</p>
                  <p className="text-[10px] text-gray-400 font-mono line-clamp-1">{doc.fileName}</p>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="mt-3 w-full rounded bg-indigo-50 py-1 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Download Manual
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Troubleshooting Playbooks */}
      {activeTab === 'playbooks' && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Known Troubleshooting & Fix Playbooks</h3>
            <Link to="/knowledge-bank" className="text-xs font-semibold text-indigo-600 hover:underline">
              Manage Playbooks ›
            </Link>
          </div>

          {!playbooks || playbooks.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">No machine-specific playbooks recorded yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playbooks.map((pb) => (
                <div key={pb.id} className="rounded-lg border border-gray-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                      Symptom
                    </span>
                    <span className="text-[10px] text-gray-400">Est. {pb.estimatedDowntimeMin ?? 60}m</span>
                  </div>
                  <h4 className="font-bold text-gray-900">{pb.symptom}</h4>
                  <p className="text-gray-600"><span className="font-semibold">Root Cause:</span> {pb.probableCause}</p>
                  <div className="rounded bg-emerald-50 p-2 text-emerald-900">
                    <p className="font-bold">Standard Fix:</p>
                    <p className="whitespace-pre-line">{pb.standardFix}</p>
                  </div>
                  {pb.recommendedSpares && (
                    <p className="text-gray-600"><span className="font-semibold">Spares:</span> {pb.recommendedSpares}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
