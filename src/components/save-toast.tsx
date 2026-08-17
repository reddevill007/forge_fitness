"use client";

import { CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export type SaveToastStatus = "idle" | "saving" | "saved" | "offline" | "syncing";

export function SaveToast({ status }: { status: SaveToastStatus }) {
  const [visible, setVisible] = useState(status !== "idle");

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!visible || status === "idle") return null;

  const copy =
    status === "saving"
      ? "Saving…"
      : status === "syncing"
        ? "Syncing…"
        : status === "offline"
          ? "Saved on device"
          : "Saved";

  return (
    <div className={`save-toast ${status}`} role="status">
      {status === "saving" || status === "syncing" ? <Loader2 size={16} className="save-toast-spin" /> : null}
      {status === "offline" ? <CloudOff size={16} /> : null}
      {status === "saved" ? <CloudUpload size={16} /> : null}
      <span>{copy}</span>
    </div>
  );
}
