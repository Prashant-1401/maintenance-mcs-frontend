import { useState } from 'react';

/** Like useState, but remembers the last value in localStorage so it survives navigating away and back. */
export function usePersistedState<T extends string>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return (stored as T) || defaultValue;
  });

  const setPersisted = (next: T) => {
    localStorage.setItem(key, next);
    setValue(next);
  };

  return [value, setPersisted] as const;
}
