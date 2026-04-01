import { useEffect, useState } from "react";
import { useStore } from "../../store";

export function SyncStatus() {
  const syncStatus = useStore((s) => s.syncStatus);
  const storageChoice = useStore((s) => s.storageChoice);
  const user = useStore((s) => s.user);
  const setSyncStatus = useStore((s) => s.setSyncStatus);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (syncStatus === "synced") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [syncStatus]);

  if (storageChoice !== "cloud" || !user) return null;
  if (syncStatus === "idle" || (syncStatus === "synced" && !visible)) return null;

  const handleRetry = () => {
    if (syncStatus === "error") {
      setSyncStatus("idle");
      // The next state change will trigger a push
    }
  };

  return (
    <button
      onClick={syncStatus === "error" ? handleRetry : undefined}
      className={`flex items-center gap-1 text-xs transition-all duration-300 ${
        syncStatus === "error" ? "cursor-pointer" : "cursor-default"
      }`}
      title={
        syncStatus === "syncing" ? "Syncing..." :
        syncStatus === "synced" ? "Synced" :
        syncStatus === "error" ? "Sync failed. Click to retry." :
        syncStatus === "offline" ? "Offline — changes will sync when you reconnect" :
        ""
      }
    >
      {syncStatus === "syncing" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-accent-gold)] animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {syncStatus === "synced" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <polyline points="9 15 12 18 17 13" />
        </svg>
      )}
      {syncStatus === "error" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {syncStatus === "offline" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
      )}
    </button>
  );
}
