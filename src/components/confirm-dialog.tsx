"use client";

import { useEffect } from "react";

export function ConfirmDialog({
  title,
  copy,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  copy: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="modal-layer"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p>{copy}</p>
        <div className="form-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "danger-button" : "primary-button"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
