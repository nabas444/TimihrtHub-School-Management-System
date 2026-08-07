import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { getQueueCount, flushQueue, QUEUE_CHANGED_EVENT } from '../../lib/offlineQueue';

// Requirement doc: "Add a visible offline / pending sync indicator in the UI
// so users know their data hasn't synced yet." Shown in the Topbar; renders
// nothing when online with an empty queue, so it stays out of the way for
// the overwhelming majority of sessions.
export default function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(() => {
    getQueueCount().then(setPendingCount);
  }, []);

  const trySync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await flushQueue(api);
      if (result.succeeded > 0) {
        toast.success(`Synced ${result.succeeded} offline ${result.succeeded === 1 ? 'change' : 'changes'}`);
      }
    } finally {
      setSyncing(false);
      refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => { setIsOnline(true); trySync(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, refreshCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refreshCount);
    };
  }, [refreshCount, trySync]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
        !isOnline ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
      }`}
      title={!isOnline ? 'You are offline — changes will be saved and synced automatically once you reconnect.' : `${pendingCount} change(s) waiting to sync`}
    >
      {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />}
      {!isOnline ? 'Offline' : `${pendingCount} pending sync${pendingCount === 1 ? '' : 's'}`}
    </div>
  );
}
