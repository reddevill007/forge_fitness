"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { compositionReportsSummary } from "@/src/lib/body-composition";
import { applyPendingWrite, executeCoachTool } from "@/src/lib/coach/execute-tools";
import {
  capCoachContents,
  lastThreadStorageKey,
  sanitizeStoredMessages,
  stripCoachInlineData,
  threadPreview,
  threadTitleFromPrompt,
} from "@/src/lib/coach/history";
import { parseCoachReply } from "@/src/lib/coach/parse-blocks";
import { mergeCoachVisuals, pruneDuplicateCoachCopy, slimCoachToolPayload, visualsFromTool } from "@/src/lib/coach/visual-blocks";
import type {
  CoachBlock,
  CoachChatResponse,
  CoachContent,
  CoachMessage,
  CoachPageContext,
  CoachPart,
  CoachThreadSummary,
  PendingWrite,
  StoredCoachThread,
} from "@/src/lib/coach/types";
import { TOOL_THINKING } from "@/src/lib/coach/types";
import type { CoachImageAttachment } from "@/src/lib/coach/image-attach";
import { deleteCoachThread, getCoachThread, saveCoachThread, subscribeCoachThreads } from "@/src/lib/firebase/coach-threads";
import { useAuth } from "@/src/lib/firebase/auth-context";
import { useUserData } from "@/src/lib/firebase/user-data-context";

const AUTO_KEY = "forge.coach.autoApply";

type CoachContextValue = {
  open: boolean;
  expanded: boolean;
  busy: boolean;
  thinking: string | null;
  error: string | null;
  messages: CoachMessage[];
  threads: CoachThreadSummary[];
  activeThreadId: string | null;
  pageContext: CoachPageContext;
  autoApply: boolean;
  setPageContext: (context: CoachPageContext) => void;
  setAutoApply: (value: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  toggleExpanded: () => void;
  newChat: () => void;
  openThread: (id: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  ask: (prompt: string, attachments?: CoachImageAttachment[]) => Promise<void>;
  confirmWrite: (write: PendingWrite) => Promise<void>;
  dismissWrite: (write: PendingWrite) => void;
  clearError: () => void;
};

const CoachContext = createContext<CoachContextValue | null>(null);

function isAiSurface() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/ai");
}

function writeTitle(write: PendingWrite) {
  if (!write?.payload) return "Apply this change?";
  switch (write.tool) {
    case "create_workout":
      return `Create ${write.payload.name}?`;
    case "update_workout":
      return "Update this workout?";
    case "create_exercise":
      return `Create ${write.payload.name}?`;
    case "update_exercise":
      return "Update this exercise?";
    case "add_exercise_to_workout":
      return `Add ${write.payload.exerciseName}?`;
    case "delete_exercise_from_workout":
      return `Remove ${write.payload.exerciseName}?`;
    case "create_program":
      return `Create ${write.payload.name}?`;
    case "update_program":
      return "Update this program?";
    case "save_body_composition": {
      const count = write.payload.reports.length;
      return count > 1 ? `Save ${count} body scans?` : "Save this body scan?";
    }
    default:
      return "Apply this change?";
  }
}

function writeSummary(write: PendingWrite) {
  if (!write?.payload) return "This will change your training data.";
  switch (write.tool) {
    case "create_workout":
      return `${write.payload.exercises.length} exercises · ~${write.payload.duration} min`;
    case "update_workout":
      return write.payload.exercises
        ? `Replace with ${write.payload.exercises.length} exercises`
        : "Update workout details";
    case "create_exercise":
      return `${write.payload.target} · ${write.payload.equipment}`;
    case "add_exercise_to_workout":
      return write.payload.prescription ?? "Add to the current workout";
    case "create_program":
      return `${write.payload.schedule.filter((slot) => slot.workoutName && slot.workoutName !== "Rest").length} training days`;
    case "save_body_composition":
      return compositionReportsSummary(write.payload.reports);
    default:
      return "This will change your training data.";
  }
}

function sameWrite(a: PendingWrite, b: PendingWrite) {
  if (!a?.payload || !b?.payload) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function scanCardsFromWrite(write: PendingWrite): CoachBlock[] {
  if (write.tool !== "save_body_composition") return [];
  return write.payload.reports.map((payload) => ({
    type: "body_scan_card" as const,
    measuredAt: payload.measuredAt,
    weightKg: payload.weightKg,
    bodyFatPercent: payload.bodyFatPercent,
    skeletalMuscleKg: payload.skeletalMuscleKg,
    bmi: payload.bmi,
    visceralFatIndex: payload.visceralFatIndex,
    bodyAge: payload.bodyAge,
    healthScore: payload.healthScore,
    obesityType: payload.obesityType,
    targetWeightKg: payload.targetWeightKg,
  }));
}

function injectConfirmations(blocks: CoachBlock[], writes: PendingWrite[]) {
  const next = [...blocks];
  for (const write of writes) {
    const exists = next.some((block) => block.type === "confirmation_card" && block.write?.payload && sameWrite(block.write, write));
    if (!exists) {
      next.push({
        type: "confirmation_card",
        title: writeTitle(write),
        summary: writeSummary(write),
        write,
      });
    }
    if (!next.some((block) => block.type === "body_scan_card")) {
      next.push(...scanCardsFromWrite(write));
    }
  }
  return next;
}

function summarizeThread(thread: StoredCoachThread): CoachThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    preview: thread.preview,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function applyThread(thread: StoredCoachThread) {
  return {
    messages: sanitizeStoredMessages(thread.messages ?? []),
    contents: thread.contents ?? [],
  };
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const data = useUserData();
  const dataRef = useRef(data);
  dataRef.current = data;
  const pageRef = useRef<CoachPageContext>({ currentPage: "home" });

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [contents, setContents] = useState<CoachContent[]>([]);
  const [threads, setThreads] = useState<CoachThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [pageContext, setPageContextState] = useState<CoachPageContext>({ currentPage: "home" });
  const [autoApply, setAutoApplyState] = useState(false);
  const contentsRef = useRef(contents);
  const activeThreadRef = useRef(activeThreadId);
  const threadsMap = useRef(new Map<string, StoredCoachThread>());
  const hydrating = useRef(false);
  const restored = useRef(false);
  contentsRef.current = contents;
  activeThreadRef.current = activeThreadId;

  useEffect(() => {
    setAutoApplyState(window.localStorage.getItem(AUTO_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user) {
      threadsMap.current = new Map();
      setThreads([]);
      setMessages([]);
      setContents([]);
      setActiveThreadId(null);
      restored.current = false;
      return;
    }
    restored.current = false;
    return subscribeCoachThreads(user.uid, (next) => {
      threadsMap.current = new Map(next.map((thread) => [thread.id, thread]));
      setThreads(next.map(summarizeThread));
      if (restored.current) return;
      restored.current = true;
      const lastId = window.localStorage.getItem(lastThreadStorageKey(user.uid));
      const last = lastId ? next.find((thread) => thread.id === lastId) : undefined;
      if (!last) return;
      hydrating.current = true;
      setActiveThreadId(last.id);
      const loaded = applyThread(last);
      setMessages(loaded.messages);
      setContents(loaded.contents);
      queueMicrotask(() => {
        hydrating.current = false;
      });
    });
  }, [user]);

  useEffect(() => {
    if (!user || hydrating.current || !activeThreadId || messages.length === 0) return;
    const handle = window.setTimeout(() => {
      if (hydrating.current || !activeThreadId || messages.length === 0) return;
      const existing = threadsMap.current.get(activeThreadId);
      const firstUser = messages.find((message) => message.role === "user")?.text ?? "";
      const thread: StoredCoachThread = {
        id: activeThreadId,
        title: existing?.title || threadTitleFromPrompt(firstUser),
        preview: threadPreview(messages),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages,
        contents: capCoachContents(contents),
      };
      threadsMap.current.set(activeThreadId, thread);
      setThreads((current) => {
        const summary = summarizeThread(thread);
        return [summary, ...current.filter((item) => item.id !== thread.id)];
      });
      void saveCoachThread(user.uid, thread).catch(() => undefined);
    }, 280);
    return () => window.clearTimeout(handle);
  }, [user, activeThreadId, messages, contents]);

  const setPageContext = useCallback((context: CoachPageContext) => {
    pageRef.current = context;
    setPageContextState(context);
    if (context.currentPage === "ai") {
      setOpen(false);
      setExpanded(false);
    }
  }, []);

  const setAutoApply = useCallback((value: boolean) => {
    setAutoApplyState(value);
    window.localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  }, []);

  const rememberThread = useCallback((id: string | null) => {
    if (!user) return;
    const key = lastThreadStorageKey(user.uid);
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  }, [user]);

  const newChat = useCallback(() => {
    hydrating.current = true;
    setActiveThreadId(null);
    setMessages([]);
    setContents([]);
    setError(null);
    rememberThread(null);
    queueMicrotask(() => {
      hydrating.current = false;
    });
  }, [rememberThread]);

  const openThread = useCallback(async (id: string) => {
    if (!user) return;
    hydrating.current = true;
    setError(null);
    const cached = threadsMap.current.get(id);
    const thread = cached ?? await getCoachThread(user.uid, id);
    if (!thread) {
      hydrating.current = false;
      return;
    }
    threadsMap.current.set(thread.id, thread);
    setActiveThreadId(thread.id);
    const loaded = applyThread(thread);
    setMessages(loaded.messages);
    setContents(loaded.contents);
    rememberThread(thread.id);
    queueMicrotask(() => {
      hydrating.current = false;
    });
  }, [rememberThread, user]);

  const deleteThread = useCallback(async (id: string) => {
    if (!user) return;
    threadsMap.current.delete(id);
    setThreads((current) => current.filter((thread) => thread.id !== id));
    if (activeThreadRef.current === id) newChat();
    await deleteCoachThread(user.uid, id).catch(() => undefined);
  }, [newChat, user]);

  const runTurn = useCallback(async (nextContents: CoachContent[], images?: CoachImageAttachment[]) => {
    const persistable = stripCoachInlineData(nextContents);
    setContents(persistable);
    contentsRef.current = persistable;
    setBusy(true);
    setError(null);
    setThinking(null);
    try {
      let current = nextContents;
      const collectedWrites: PendingWrite[] = [];
      const visualBlocks: CoachBlock[] = [];
      const turnImages = (images ?? []).filter((image) => image.data).map((image) => ({
        mimeType: image.mimeType || "image/jpeg",
        data: image.data,
      }));
      const finishScanTurn = (history: CoachContent[], writes: PendingWrite[], visuals: CoachBlock[]) => {
        const scanCount = writes.reduce(
          (total, write) => total + (write.tool === "save_body_composition" ? write.payload.reports.length : 0),
          0,
        );
        const text = scanCount > 1
          ? `I read ${scanCount} reports as separate check-ins. Confirm to save them all to Body analysis.`
          : "I read the numbers on your report. Confirm to save them to Body analysis.";
        const blocks = injectConfirmations(mergeCoachVisuals([], visuals), writes);
        setMessages((currentMessages) => [...currentMessages, {
          id: crypto.randomUUID(),
          role: "assistant",
          text,
          blocks,
          createdAt: new Date().toISOString(),
        }]);
        const next = stripCoachInlineData([...history, { role: "model", parts: [{ text }] }]);
        setContents(next);
        contentsRef.current = next;
      };
      for (let round = 0; round < 6; round += 1) {
        const scanReady = collectedWrites.some((write) => write.tool === "save_body_composition");
        const response = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: current,
            pageContext: pageRef.current,
            images: !scanReady && turnImages.length ? turnImages : undefined,
            forceScanTool: round === 0 && turnImages.length > 0,
          }),
        });
        const json = (await response.json()) as CoachChatResponse;
        if (!response.ok || json.error) {
          setError(json.error || "Coach could not reply.");
          return;
        }

        if (json.functionCalls?.length) {
          if (scanReady) {
            finishScanTurn(current, collectedWrites, visualBlocks);
            return;
          }
          const modelContent: CoachContent = json.modelContent ?? {
            role: "model",
            parts: json.functionCalls.map((call) => ({ functionCall: call })),
          };
          const responseParts: CoachPart[] = [];
          for (const call of json.functionCalls) {
            setThinking(TOOL_THINKING[call.name] ?? "Working through your training data…");
            const result = await executeCoachTool(call.name, call.args, dataRef.current);
            if (result.pendingWrite) {
              if (autoApply) {
                const applied = await applyPendingWrite(result.pendingWrite, dataRef.current);
                responseParts.push({
                  functionResponse: {
                    id: call.id,
                    name: call.name,
                    response: { ...result.data, applied },
                  },
                });
              } else {
                collectedWrites.push(result.pendingWrite);
                responseParts.push({
                  functionResponse: { id: call.id, name: call.name, response: result.data },
                });
              }
            } else {
              visualBlocks.push(...visualsFromTool(call.name, result.data));
              responseParts.push({
                functionResponse: {
                  id: call.id,
                  name: call.name,
                  response: slimCoachToolPayload(call.name, result.data),
                },
              });
            }
          }
          current = [...current, modelContent, { role: "user", parts: responseParts }];
          if (collectedWrites.some((write) => write.tool === "save_body_composition")) {
            finishScanTurn(current, collectedWrites, visualBlocks);
            return;
          }
          continue;
        }

        const parsed = parseCoachReply(json.text ?? "");
        const blocks = injectConfirmations(mergeCoachVisuals(parsed.blocks, visualBlocks), collectedWrites);
        const cleaned = pruneDuplicateCoachCopy(parsed.text, blocks);
        const assistant: CoachMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: cleaned.text,
          blocks: cleaned.blocks,
          createdAt: new Date().toISOString(),
        };
        setMessages((currentMessages) => [...currentMessages, assistant]);
        const modelContent: CoachContent = json.modelContent ?? {
          role: "model",
          parts: [{ text: json.text ?? parsed.text }],
        };
        current = stripCoachInlineData([...current, modelContent]);
        setContents(current);
        contentsRef.current = current;
        return;
      }
      setError("Coach got stuck looking up data. Try a narrower question.");
    } catch {
      setError("Coach could not reach Gemini.");
    } finally {
      setBusy(false);
      setThinking(null);
    }
  }, [autoApply]);

  const ask = useCallback(async (prompt: string, attachments?: CoachImageAttachment[]) => {
    const trimmed = prompt.trim();
    const images = (attachments ?? []).filter((image) => image?.data).slice(0, 3);
    if ((!trimmed && images.length === 0) || busy) return;
    const text = trimmed || "Read this body composition report and save every number into my body analysis.";
    if (pageRef.current.currentPage !== "ai" && !isAiSurface()) setOpen(true);
    if (!activeThreadRef.current) {
      const id = crypto.randomUUID();
      activeThreadRef.current = id;
      setActiveThreadId(id);
      rememberThread(id);
    }
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        text,
        blocks: [],
        createdAt: new Date().toISOString(),
        attachments: images.map((image) => ({ mimeType: image.mimeType, preview: image.preview })),
      },
    ]);
    const parts: CoachPart[] = [{ text: images.length ? `${text}\n\n[Attached ${images.length} body composition photo${images.length > 1 ? "s" : ""}.]` : text }];
    await runTurn([...contentsRef.current, { role: "user", parts }], images);
  }, [busy, rememberThread, runTurn]);

  const confirmWrite = useCallback(async (write: PendingWrite) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await applyPendingWrite(write, dataRef.current);
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          blocks: message.blocks.filter((block) => block.type !== "confirmation_card" || !sameWrite(block.write, write)),
        })),
      );
      await runTurn([
        ...contentsRef.current,
        {
          role: "user",
          parts: [{
            text: `The user confirmed. ${write.tool} finished with ${JSON.stringify(result)}. Acknowledge briefly. Do not call the write tool again.`,
          }],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply that change.");
      setBusy(false);
      setThinking(null);
    }
  }, [busy, runTurn]);

  const dismissWrite = useCallback((write: PendingWrite) => {
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        blocks: message.blocks.filter((block) => block.type !== "confirmation_card" || !sameWrite(block.write, write)),
      })),
    );
  }, []);

  const value = useMemo<CoachContextValue>(() => ({
    open,
    expanded,
    busy,
    thinking,
    error,
    messages,
    threads,
    activeThreadId,
    pageContext,
    autoApply,
    setPageContext,
    setAutoApply,
    openPanel: () => {
      if (pageRef.current.currentPage === "ai" || isAiSurface()) return;
      setOpen(true);
    },
    closePanel: () => {
      setOpen(false);
      setExpanded(false);
    },
    toggleExpanded: () => setExpanded((value) => !value),
    newChat,
    openThread,
    deleteThread,
    ask,
    confirmWrite,
    dismissWrite,
    clearError: () => setError(null),
  }), [activeThreadId, ask, autoApply, busy, confirmWrite, deleteThread, dismissWrite, error, expanded, messages, newChat, open, openThread, pageContext, setAutoApply, setPageContext, thinking, threads]);

  if (!user) return children;

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach() {
  const value = useContext(CoachContext);
  if (!value) return null;
  return value;
}

export function useCoachPage(context: CoachPageContext) {
  const coach = useCoach();
  const setPageContext = coach?.setPageContext;
  const serialized = JSON.stringify(context);
  useEffect(() => {
    if (!setPageContext) return;
    setPageContext(JSON.parse(serialized) as CoachPageContext);
  }, [setPageContext, serialized]);
}
