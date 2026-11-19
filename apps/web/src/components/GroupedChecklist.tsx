import { useMemo, useState } from 'react';

interface GroupedChecklistProps<T> {
  items: T[];
  getGroup: (item: T) => string;
  getKey: (item: T) => string;
  getOrderIndex: (item: T) => number;
  isAnswered: (item: T) => boolean;
  renderItem: (item: T) => React.ReactNode;
}

export function GroupedChecklist<T>({ items, getGroup, getKey, getOrderIndex, isAnswered, renderItem }: GroupedChecklistProps<T>) {
  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const group = getGroup(item);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    for (const groupItems of map.values()) groupItems.sort((a, b) => getOrderIndex(a) - getOrderIndex(b));
    return [...map.entries()];
  }, [items, getGroup, getOrderIndex]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="flex flex-col gap-2">
      {groups.map(([name, groupItems]) => {
        const isOpen = openGroups[name] ?? false;
        const answeredCount = groupItems.filter(isAnswered).length;
        return (
          <div key={name} className="rounded-md border border-gray-200">
            <button
              type="button"
              onClick={() => toggle(name)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                {name}
              </span>
              <span
                className={`text-xs font-normal ${answeredCount === groupItems.length ? 'text-green-600' : 'text-gray-400'}`}
              >
                {answeredCount}/{groupItems.length} done
              </span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-2 border-t border-gray-100 p-3">
                {groupItems.map((item) => (
                  <div key={getKey(item)}>{renderItem(item)}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
