import { useRef, useState } from 'react';

interface ExcelImportPreviewProps<T> {
  title: string;
  onUpload: (file: File) => Promise<T>;
  onCommit: (data: T) => Promise<void>;
  renderSummary: (data: T) => React.ReactNode;
}

export function ExcelImportPreview<T>({ title, onUpload, onCommit, renderSummary }: ExcelImportPreviewProps<T>) {
  const [preview, setPreview] = useState<T | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const data = await onUpload(file);
      setPreview(data);
    } catch {
      setError('Failed to parse file — check it matches the expected layout.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    setError(null);
    try {
      await onCommit(preview);
      setPreview(null);
    } catch {
      setError('Failed to import — please try again.');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {!preview ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="text-sm"
          />
          {uploading && <p className="mt-2 text-xs text-gray-500">Parsing…</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {renderSummary(preview)}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreview(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={committing}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {committing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
