"use client";

import { CloudUpload, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/src/lib/offline";
import { useUserData } from "@/src/lib/firebase/user-data-context";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { pendingSyncCount, syncing } = useUserData();

  if (!online) {
    return (
      <div className="offline-banner" role="status">
        <WifiOff size={16} />
        <span>Offline. Set progress is saved on this device and will sync when you reconnect.</span>
      </div>
    );
  }

  if (!syncing && pendingSyncCount === 0) return null;

  return (
    <div className="offline-banner syncing" role="status">
      <CloudUpload size={16} />
      <span>
        {syncing ? "Syncing saved progress to your account…" : `${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} waiting to sync.`}
      </span>
    </div>
  );
}
