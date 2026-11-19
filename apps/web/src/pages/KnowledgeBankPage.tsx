import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_MANAGEMENT, hasTier } from '../lib/roles';
import type {
  Asset,
  KnowledgeBankDocument,
  MachineOperationalBaseline,
  TroubleshootingPlaybook,
} from '../lib/types';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeBankPage() {
  const { user } = useAuth();
  const canManage = hasTier(user?.tier, ADMIN_MANAGEMENT);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'docs' | 'baselines' | 'playbooks'>('docs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');

  // Modals
  const [showDocModal, setShowDocModal] = useState(false);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  // Doc Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('SOP');
  const [docAssetId, setDocAssetId] = useState('');
  const [tags, setTags] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Baseline Form State
  const [blAssetId, setBlAssetId] = useState('');
  const [blParam, setBlParam] = useState('');
  const [blNominal, setBlNominal] = useState('');
  const [blMin, setBlMin] = useState('');
  const [blMax, setBlMax] = useState('');
  const [blUnit, setBlUnit] = useState('');
  const [blMode, setBlMode] = useState('Normal Operation');
  const [blNotes, setBlNotes] = useState('');

  // Playbook Form State
  const [pbAssetId, setPbAssetId] = useState('');
  const [pbCategory, setPbCategory] = useState('');
  const [pbSymptom, setPbSymptom] = useState('');
  const [pbCause, setPbCause] = useState('');
  const [pbFix, setPbFix] = useState('');
  const [pbSpares, setPbSpares] = useState('');
  const [pbSafety, setPbSafety] = useState('');
  const [pbDowntime, setPbDowntime] = useState('');

  // Fetch Assets for dropdowns
  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/assets')).data,
  });

  // 1. Documents Query
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['knowledge-bank-docs', search, categoryFilter, assetFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      if (assetFilter) params.set('assetId', assetFilter);
      return (await api.get<KnowledgeBankDocument[]>(`/knowledge-bank?${params.toString()}`)).data;
    },
    enabled: activeTab === 'docs',
  });

  // 2. Baselines Query
  const { data: baselines, isLoading: blLoading } = useQuery({
    queryKey: ['knowledge-bank-baselines', search, assetFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (assetFilter) params.set('assetId', assetFilter);
      return (await api.get<MachineOperationalBaseline[]>(`/knowledge-bank/baselines/all?${params.toString()}`)).data;
    },
    enabled: activeTab === 'baselines',
  });

  // 3. Playbooks Query
  const { data: playbooks, isLoading: pbLoading } = useQuery({
    queryKey: ['knowledge-bank-playbooks', search, assetFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (assetFilter) params.set('assetId', assetFilter);
      return (await api.get<TroubleshootingPlaybook[]>(`/knowledge-bank/playbooks/all?${params.toString()}`)).data;
    },
    enabled: activeTab === 'playbooks',
  });

  // Upload Document Mutation
  const uploadDoc = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      if (category) formData.append('category', category);
      if (docAssetId) formData.append('assetId', docAssetId);
      if (tags) formData.append('tags', tags);
      if (machineModel) formData.append('machineModel', machineModel);
      return api.post('/knowledge-bank', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bank-docs'] });
      setShowDocModal(false);
      setTitle('');
      setCategory('SOP');
      setDocAssetId('');
      setTags('');
      setMachineModel('');
      setFile(null);
      setDocError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed';
      setDocError(message);
    },
  });

  // Create Baseline Mutation
  const createBaseline = useMutation({
    mutationFn: async () =>
      api.post('/knowledge-bank/baselines', {
        assetId: blAssetId,
        parameterName: blParam,
        nominalValue: Number(blNominal),
        minThreshold: blMin ? Number(blMin) : undefined,
        maxThreshold: blMax ? Number(blMax) : undefined,
        unit: blUnit,
        operatingMode: blMode || undefined,
        notes: blNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bank-baselines'] });
      setShowBaselineModal(false);
      setBlAssetId('');
      setBlParam('');
      setBlNominal('');
      setBlMin('');
      setBlMax('');
      setBlUnit('');
      setBlNotes('');
    },
  });

  // Create Playbook Mutation
  const createPlaybook = useMutation({
    mutationFn: async () =>
      api.post('/knowledge-bank/playbooks', {
        assetId: pbAssetId || undefined,
        assetCategory: pbCategory || undefined,
        symptom: pbSymptom,
        probableCause: pbCause,
        standardFix: pbFix,
        recommendedSpares: pbSpares || undefined,
        safetyPrecautions: pbSafety || undefined,
        estimatedDowntimeMin: pbDowntime ? Number(pbDowntime) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bank-playbooks'] });
      setShowPlaybookModal(false);
      setPbAssetId('');
      setPbCategory('');
      setPbSymptom('');
      setPbCause('');
      setPbFix('');
      setPbSpares('');
      setPbSafety('');
      setPbDowntime('');
    },
  });

  // Delete mutations
  const deleteDoc = useMutation({
    mutationFn: async (id: string) => api.delete(`/knowledge-bank/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bank-docs'] }),
  });

  const deleteBaseline = useMutation({
    mutationFn: async (id: string) => api.delete(`/knowledge-bank/baselines/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bank-baselines'] }),
  });

  const deletePlaybook = useMutation({
    mutationFn: async (id: string) => api.delete(`/knowledge-bank/playbooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bank-playbooks'] }),
  });

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
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machine Operations Knowledge Bank</h1>
          <p className="text-sm text-gray-500">
            Standard operating procedures, OEM manuals, operating baselines, and troubleshooting playbooks.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {activeTab === 'docs' && (
              <button
                onClick={() => setShowDocModal(true)}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 shadow-sm"
              >
                + Upload SOP / Manual
              </button>
            )}
            {activeTab === 'baselines' && (
              <button
                onClick={() => setShowBaselineModal(true)}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
              >
                + Add Operating Parameter
              </button>
            )}
            {activeTab === 'playbooks' && (
              <button
                onClick={() => setShowPlaybookModal(true)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
              >
                + Add Troubleshooting Playbook
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'docs'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📄 SOPs & OEM Manuals ({documents?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('baselines')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'baselines'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ⚙️ Operating Baselines & Nominals ({baselines?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('playbooks')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'playbooks'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🛠️ Troubleshooting & Fix Playbooks ({playbooks?.length ?? 0})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by keyword, machine tag, symptom..."
          className="w-full sm:w-72 rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
        />

        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
        >
          <option value="">All Machines / Assets</option>
          {assets?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tag} — {a.name}
            </option>
          ))}
        </select>

        {activeTab === 'docs' && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
          >
            <option value="">All Document Categories</option>
            <option value="SOP">Standard Operating Procedure (SOP)</option>
            <option value="OEM_MANUAL">OEM Manual</option>
            <option value="ELECTRICAL_DIAGRAM">Electrical Diagram</option>
            <option value="LUBRICATION_CHART">Lubrication Chart</option>
            <option value="SAFETY">Safety & LOTO</option>
          </select>
        )}
      </div>

      {/* TAB 1: Documents & SOPs */}
      {activeTab === 'docs' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {docsLoading ? (
            <p className="p-6 text-center text-xs text-gray-500">Loading documents…</p>
          ) : documents?.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-500">No manuals or SOPs found matching criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Document Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Machine / Asset</th>
                    <th className="px-4 py-3">Tags</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Uploaded By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents?.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="font-semibold text-indigo-600 hover:underline flex items-center gap-1.5"
                        >
                          <span>📄</span> {doc.title}
                        </button>
                        <span className="text-[10px] text-gray-400 font-mono">{doc.fileName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700 text-[11px]">
                          {doc.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {doc.asset ? `${doc.asset.tag} (${doc.asset.name})` : <span className="text-gray-400">All / General</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {doc.tags ? (
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.split(',').map((t, i) => (
                              <span key={i} className="rounded bg-neutral-100 px-1.5 py-0.2 text-[10px] text-neutral-600">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatSize(doc.sizeBytes)}</td>
                      <td className="px-4 py-3 text-gray-500">{doc.uploadedBy?.name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Download
                          </button>
                          {canManage && (
                            <button
                              onClick={() => deleteDoc.mutate(doc.id)}
                              className="text-xs text-rose-600 hover:text-rose-800"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Operating Baselines */}
      {activeTab === 'baselines' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {blLoading ? (
            <p className="p-6 text-center text-xs text-gray-500">Loading operating baselines…</p>
          ) : baselines?.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-500">No machine operating baselines registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Machine / Asset</th>
                    <th className="px-4 py-3">Parameter Name</th>
                    <th className="px-4 py-3 text-center">Nominal Value</th>
                    <th className="px-4 py-3 text-center">Operating Bounds (Min - Max)</th>
                    <th className="px-4 py-3">Operating Mode</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {baselines?.map((bl) => (
                    <tr key={bl.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {bl.asset?.tag} <span className="font-normal text-gray-500">({bl.asset?.name})</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{bl.parameterName}</td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-700 bg-indigo-50/50">
                        {bl.nominalValue} {bl.unit}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {bl.minThreshold != null ? `${bl.minThreshold} ${bl.unit}` : '—'} &nbsp;to&nbsp;{' '}
                        {bl.maxThreshold != null ? `${bl.maxThreshold} ${bl.unit}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{bl.operatingMode || 'Normal Run'}</td>
                      <td className="px-4 py-3 text-gray-500">{bl.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <button
                            onClick={() => deleteBaseline.mutate(bl.id)}
                            className="text-xs text-rose-600 hover:text-rose-800"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Troubleshooting Playbooks */}
      {activeTab === 'playbooks' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pbLoading ? (
            <p className="p-6 text-center text-xs text-gray-500 col-span-2">Loading playbooks…</p>
          ) : playbooks?.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-500 col-span-2">No troubleshooting playbooks documented yet.</p>
          ) : (
            playbooks?.map((pb) => (
              <div key={pb.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                        Symptom / Alarm
                      </span>
                      <h3 className="mt-1 text-sm font-bold text-gray-900">{pb.symptom}</h3>
                    </div>
                    {pb.asset ? (
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5">
                        {pb.asset.tag}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                        {pb.assetCategory || 'General Category'}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <p className="font-semibold text-gray-700">Root Cause:</p>
                      <p className="text-gray-600">{pb.probableCause}</p>
                    </div>

                    <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 p-3">
                      <p className="font-bold text-emerald-900">Standard Fix Procedure:</p>
                      <p className="text-emerald-800 mt-0.5 whitespace-pre-line">{pb.standardFix}</p>
                    </div>

                    {pb.recommendedSpares && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-gray-700">Recommended Spares:</span>
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">{pb.recommendedSpares}</span>
                      </div>
                    )}

                    {pb.safetyPrecautions && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded">
                        <span>⚠️</span> <span>{pb.safetyPrecautions}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-[11px] text-gray-400">
                  <span>Est. Downtime: {pb.estimatedDowntimeMin ? `${pb.estimatedDowntimeMin} mins` : '—'}</span>
                  {canManage && (
                    <button
                      onClick={() => deletePlaybook.mutate(pb.id)}
                      className="text-xs text-rose-600 hover:text-rose-800"
                    >
                      Delete Playbook
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal 1: Upload Document */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">Upload Machine Document / SOP</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadDoc.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Extruder Main Drive SOP & Alignment Manual"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  >
                    <option value="SOP">Standard Operating Procedure (SOP)</option>
                    <option value="OEM_MANUAL">OEM Manual</option>
                    <option value="ELECTRICAL_DIAGRAM">Electrical Diagram</option>
                    <option value="LUBRICATION_CHART">Lubrication Chart</option>
                    <option value="SAFETY">Safety & LOTO</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Link to Machine (Optional)</label>
                  <select
                    value={docAssetId}
                    onChange={(e) => setDocAssetId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  >
                    <option value="">General / All Machines</option>
                    {assets?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.tag} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Tags (comma-separated)</label>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="bearing, vibration, loto"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Machine Model (Optional)</label>
                  <input
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    placeholder="e.g. Siemens 1LE1"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">File (PDF, Doc, Image)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              {docError && <p className="text-xs text-rose-600 font-semibold">{docError}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadDoc.isPending}
                  className="rounded-md bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {uploadDoc.isPending ? 'Uploading…' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Operating Baseline */}
      {showBaselineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">Add Machine Operating Baseline</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBaseline.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Machine / Asset</label>
                <select
                  value={blAssetId}
                  onChange={(e) => setBlAssetId(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                >
                  <option value="">Select Machine...</option>
                  {assets?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tag} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Parameter Name</label>
                <input
                  value={blParam}
                  onChange={(e) => setBlParam(e.target.value)}
                  required
                  placeholder="e.g. Bearing Drive-End Temp, Motor Current, RPM"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Nominal Expected Value</label>
                  <input
                    type="number"
                    step="any"
                    value={blNominal}
                    onChange={(e) => setBlNominal(e.target.value)}
                    required
                    placeholder="e.g. 65.0"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Unit</label>
                  <input
                    value={blUnit}
                    onChange={(e) => setBlUnit(e.target.value)}
                    required
                    placeholder="°C, bar, rpm, A"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Min Warning Limit</label>
                  <input
                    type="number"
                    step="any"
                    value={blMin}
                    onChange={(e) => setBlMin(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Max Warning Limit</label>
                  <input
                    type="number"
                    step="any"
                    value={blMax}
                    onChange={(e) => setBlMax(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Operating Mode</label>
                <input
                  value={blMode}
                  onChange={(e) => setBlMode(e.target.value)}
                  placeholder="Normal Load / High Speed"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBaselineModal(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBaseline.isPending}
                  className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createBaseline.isPending ? 'Saving…' : 'Save Parameter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Troubleshooting Playbook */}
      {showPlaybookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">Add Troubleshooting & Fix Playbook</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPlaybook.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Specific Machine (Optional)</label>
                  <select
                    value={pbAssetId}
                    onChange={(e) => setPbAssetId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  >
                    <option value="">All / Machine Category</option>
                    {assets?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.tag} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Machine Category</label>
                  <input
                    value={pbCategory}
                    onChange={(e) => setPbCategory(e.target.value)}
                    placeholder="e.g. Pump, Motor, Extruder"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Symptom / Alarm Code</label>
                <input
                  value={pbSymptom}
                  onChange={(e) => setPbSymptom(e.target.value)}
                  required
                  placeholder="e.g. High vibration alarm + shaft seal leakage"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Probable Root Cause</label>
                <input
                  value={pbCause}
                  onChange={(e) => setPbCause(e.target.value)}
                  required
                  placeholder="e.g. Drive-end bearing fatigue and shaft misalignment"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Standard Fix Procedure</label>
                <textarea
                  rows={3}
                  value={pbFix}
                  onChange={(e) => setPbFix(e.target.value)}
                  required
                  placeholder="1. Lockout motor&#10;2. Extract coupling and replace 6205 bearing&#10;3. Laser align shaft"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Recommended Spares</label>
                  <input
                    value={pbSpares}
                    onChange={(e) => setPbSpares(e.target.value)}
                    placeholder="BRG-6205, SEAL-MS35"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Est. Repair Time (Mins)</label>
                  <input
                    type="number"
                    value={pbDowntime}
                    onChange={(e) => setPbDowntime(e.target.value)}
                    placeholder="e.g. 90"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-gray-700">Safety & LOTO Precautions</label>
                <input
                  value={pbSafety}
                  onChange={(e) => setPbSafety(e.target.value)}
                  placeholder="e.g. Mandatory 24V isolator lockout + thermal gloves"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPlaybookModal(false)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPlaybook.isPending}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {createPlaybook.isPending ? 'Saving…' : 'Save Playbook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
