"use client";

import { History, ImagePlus, Maximize2, Minimize2, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { CoachThread, useCoachComposerState } from "@/src/components/coach/coach-desk";
import { CoachHistoryList } from "@/src/components/coach/coach-history";
import { CoachMark } from "@/src/components/coach/coach-mark";
import { filesFromPicker } from "@/src/lib/coach/image-attach";
import { useCoach } from "@/src/lib/coach/context";

function CoachPanelComposer() {
  const {
    coach,
    draft,
    setDraft,
    send,
    placeholder,
    attachments,
    attachError,
    fileInput,
    addFiles,
    removeAttachment,
    canSend,
  } = useCoachComposerState();
  if (!coach) return null;

  return (
    <form
      className="coach-panel-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {attachments.length > 0 && (
        <div className="coach-attach-row">
          {attachments.map((image, index) => (
            <figure key={`${image.preview}-${index}`}>
              <img src={image.preview} alt={`Scan ${index + 1}`} />
              <button type="button" className="icon-button" aria-label="Remove image" onClick={() => removeAttachment(index)}>
                <X size={14} />
              </button>
            </figure>
          ))}
        </div>
      )}
      {attachError ? <p className="coach-error" role="alert">{attachError}</p> : null}
      <div
        className="coach-panel-composer-bar"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          void addFiles(filesFromPicker(event.dataTransfer.files));
        }}
      >
        <label className="coach-attach-button is-panel">
          <span className="sr-only">Attach a body composition scan</span>
          <ImagePlus size={16} />
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = filesFromPicker(event.target.files);
              event.target.value = "";
              void addFiles(files);
            }}
          />
        </label>
        <label>
          <span className="sr-only">Message Coach</span>
          <textarea
            value={draft}
            rows={1}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.items)
                .filter((item) => item.type.startsWith("image/"))
                .map((item) => item.getAsFile())
                .filter((file): file is File => Boolean(file));
              if (!files.length) return;
              event.preventDefault();
              void addFiles(files);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <button className="coach-panel-send" type="submit" disabled={!canSend} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </form>
  );
}

export function CoachPanel() {
  const coach = useCoach();
  const [logOpen, setLogOpen] = useState(false);

  if (!coach || !coach.open || coach.pageContext.currentPage === "ai") return null;

  return (
    <div className={`coach-layer ${coach.expanded ? "is-expanded" : ""}`}>
      <button className="coach-scrim" type="button" aria-label="Close Coach" onClick={coach.closePanel} />
      <aside className="coach-panel" role="dialog" aria-label="Coach">
        <header className="coach-header">
          <div className="coach-brand">
            <span className="coach-face">
              <CoachMark />
            </span>
            <div>
              <div className="coach-title-row">
                <strong>Atlas</strong>
                <span className="coach-online"><i /> Online</span>
              </div>
              <p>Quick answers from any page.</p>
            </div>
          </div>
          <div className="coach-header-actions">
            <button
              type="button"
              className={`icon-button ${logOpen ? "is-active" : ""}`}
              aria-label="Chat history"
              aria-pressed={logOpen}
              onClick={() => setLogOpen((value) => !value)}
            >
              <History size={18} />
            </button>
            <button type="button" className="icon-button" aria-label="New chat" onClick={() => { coach.newChat(); setLogOpen(false); }}>
              <Plus size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={coach.expanded ? "Shrink Coach" : "Expand Coach"}
              onClick={coach.toggleExpanded}
            >
              {coach.expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className="icon-button" aria-label="Close Coach" onClick={coach.closePanel}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="coach-panel-body">
          {logOpen ? (
            <div className="coach-session-flyout">
              <CoachHistoryList onPick={() => setLogOpen(false)} />
            </div>
          ) : null}
          <CoachThread surface="panel" />
          <CoachPanelComposer />
        </div>
      </aside>
    </div>
  );
}

export function CoachFab() {
  const coach = useCoach();
  if (!coach || coach.open || coach.pageContext?.currentPage === "ai") return null;
  return (
    <button className="coach-fab" type="button" onClick={coach.openPanel} aria-label="Ask Atlas, your coach">
      <span className="coach-fab-face">
        <CoachMark />
      </span>
      <span className="coach-fab-copy">
        <small>Coach</small>
        <strong>Ask Atlas</strong>
      </span>
    </button>
  );
}
