import { useRef, useState } from 'react';
import { api } from '../lib/api';

interface MasterDataToolbarProps {
  resource: string;
  onImported?: (result: { created: number; updated: number; skipped?: number }) => void;
  importable?: boolean;
}

function filenameFromDisposition(disposition: string | undefined, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? fallback;
}

export function MasterDataToolbar({ resource, onImported, importable = true }: MasterDataToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: 'xlsx' | 'pdf') {
    setExporting(format);
    setError(null);
    try {
      const response = await api.get(`/${resource}/export`, { params: { format }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromDisposition(response.headers['content-disposition'], `${resource}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    } finally {
      setExporting(null);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/${resource}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { created, updated, skipped } = response.data as { created: number; updated: number; skipped?: number };
      setMessage(`Imported: ${created} created, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}.`);
      onImported?.(response.data);
    } catch {
      setError('Import failed — check the file matches the exported column format');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {importable && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => handleExport('xlsx')}
          disabled={exporting !== null}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
        </button>
        <button
          type="button"
          onClick={() => handleExport('pdf')}
          disabled={exporting !== null}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
      {message && <p className="text-xs text-green-600">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
