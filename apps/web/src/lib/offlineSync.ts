import { useState, useEffect } from 'react';
import { api } from './api';

export interface QueuedMutation {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: unknown;
  timestamp: number;
  description: string;
}

const STORAGE_KEY = 'mcs_offline_mutation_queue_v1';

export function getOfflineQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedMutation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('offline-queue-updated'));
  } catch (err) {
    console.error('Failed to save offline queue', err);
  }
}

export function enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) {
  const queue = getOfflineQueue();
  const item: QueuedMutation = {
    ...mutation,
    id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

let isSyncing = false;

export async function processOfflineQueue(): Promise<{ processed: number; failed: number }> {
  if (isSyncing || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  isSyncing = true;
  let processed = 0;
  let failed = 0;
  const remaining: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      await api.request({
        url: item.url,
        method: item.method,
        data: item.data,
      });
      processed++;
    } catch (err: any) {
      // If server error or client offline, keep in queue for next retry
      if (!err.response || err.response.status >= 500 || err.code === 'ERR_NETWORK') {
        remaining.push(item);
        failed++;
      } else {
        // 4xx bad request / already processed -> drop to avoid infinite loop
        console.warn(`Dropped invalid mutation [${item.id}]:`, err.message);
        processed++;
      }
    }
  }

  saveOfflineQueue(remaining);
  isSyncing = false;
  return { processed, failed };
}

// Hook for UI components to display live sync badge
export function useSyncStatus() {
  const [queueCount, setQueueCount] = useState<number>(() => getOfflineQueue().length);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const updateQueue = () => setQueueCount(getOfflineQueue().length);
    const handleOnline = () => {
      setIsOnline(true);
      setSyncing(true);
      processOfflineQueue().finally(() => setSyncing(false));
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('offline-queue-updated', updateQueue);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Background interval sync every 15s
    const timer = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) {
        setSyncing(true);
        processOfflineQueue().finally(() => setSyncing(false));
      }
    }, 15000);

    return () => {
      window.removeEventListener('offline-queue-updated', updateQueue);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  return {
    isOnline,
    queueCount,
    isSyncing: syncing,
    triggerSync: () => {
      setSyncing(true);
      return processOfflineQueue().finally(() => setSyncing(false));
    },
  };
}
