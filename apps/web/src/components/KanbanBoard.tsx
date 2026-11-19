import type { ReactNode } from 'react';

export interface KanbanColumn {
  key: string;
  label: string;
}

interface Props<T> {
  columns: KanbanColumn[];
  items: T[];
  getId: (item: T) => string;
  getStatus: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove?: (item: T, newStatus: string) => void;
}

/** Click-to-advance Kanban — no drag-and-drop, each card offers a button per other column. */
export function KanbanBoard<T>({ columns, items, getId, getStatus, renderCard, onMove }: Props<T>) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colItems = items.filter((i) => getStatus(i) === col.key);
        return (
          <div key={col.key} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-gray-100 p-3">
            <h3 className="px-1 text-sm font-semibold text-gray-700">
              {col.label} <span className="font-normal text-gray-400">({colItems.length})</span>
            </h3>
            <div className="flex flex-col gap-2">
              {colItems.length === 0 ? (
                <p className="px-1 text-xs text-gray-400">Nothing here.</p>
              ) : (
                colItems.map((item) => (
                  <div key={getId(item)} className="rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm">
                    {renderCard(item)}
                    {onMove && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {columns
                          .filter((c) => c.key !== col.key)
                          .map((target) => (
                            <button
                              key={target.key}
                              onClick={() => onMove(item, target.key)}
                              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              → {target.label}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
