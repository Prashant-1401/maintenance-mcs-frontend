import type { FilterColumn } from '../lib/useTableFilters';

interface ColumnFilterBarProps<T> {
  columns: FilterColumn<T>[];
  rows: T[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  active: boolean;
}

export function ColumnFilterBar<T>({ columns, rows, values, onChange, onClear, active }: ColumnFilterBarProps<T>) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {columns.map((col) => {
        if (col.type === 'select') {
          const options = col.options ?? [...new Set(rows.map((r) => col.getValue(r)).filter(Boolean))].sort();
          return (
            <div key={col.key}>
              <label className="mb-1 block text-xs font-medium text-gray-700">{col.label}</label>
              <select
                value={values[col.key] ?? ''}
                onChange={(e) => onChange(col.key, e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (col.type === 'date') {
          return (
            <div key={col.key}>
              <label className="mb-1 block text-xs font-medium text-gray-700">{col.label}</label>
              <input
                type="date"
                value={values[col.key] ?? ''}
                onChange={(e) => onChange(col.key, e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          );
        }
        return (
          <div key={col.key}>
            <label className="mb-1 block text-xs font-medium text-gray-700">{col.label}</label>
            <input
              value={values[col.key] ?? ''}
              onChange={(e) => onChange(col.key, e.target.value)}
              placeholder="Filter…"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        );
      })}
      {active && (
        <button onClick={onClear} className="text-xs text-indigo-600 hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
