import { useMemo, useState } from 'react';

export type FilterType = 'text' | 'select' | 'date';

export interface FilterColumn<T> {
  key: string;
  label: string;
  type: FilterType;
  getValue: (row: T) => string;
  options?: string[];
}

export function useTableFilters<T>(rows: T[], columns: FilterColumn<T>[]) {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const clear = () => setValues({});
  const active = Object.values(values).some((v) => v);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        columns.every((col) => {
          const filterValue = values[col.key];
          if (!filterValue) return true;
          const rowValue = col.getValue(row);
          if (col.type === 'text') return rowValue.toLowerCase().includes(filterValue.toLowerCase());
          if (col.type === 'date') return rowValue.slice(0, 10) === filterValue;
          return rowValue === filterValue;
        }),
      ),
    [rows, values, columns],
  );

  return { values, setValue, clear, active, filtered };
}
