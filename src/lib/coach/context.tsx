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
import { applyPendingWrite, executeCoachTool } from "@/src/lib/coach/execute-tools";
import {
  capCoachContents,
  lastThreadStorageKey,
  sanitizeStoredMessages,
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
  ask: (prompt: string) => Promise<void>;
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
    default:
      return "This will change your training data.";
  }
}

function sameWrite(a: PendingWrite, b: PendingWrite) {
  if (!a?.payload || !b?.payload) return false;
  return JSON.stringify(a) === JSON.stringify(b);
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

  const runTurn = useCallback(async (nextContents: CoachContent[]) => {
    setContents(nextContents);
    contentsRef.current = nextContents;
    setBusy(true);
    setError(null);
    setThinking(null);
    try {
      let current = nextContents;
      const collectedWrites: PendingWrite[] = [];
      const visualBlocks: CoachBlock[] = [];
      for (let round = 0; round < 6; round += 1) {
        const response = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: current, pageContext: pageRef.current }),
        });
        const json = (await response.json()) as CoachChatResponse;
        if (!response.ok || json.error) {
          setError(json.error || "Coach could not reply.");
          return;
        }

        if (json.functionCalls?.length) {
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
        current = [...current, modelContent];
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

  const ask = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    if (pageRef.current.currentPage !== "ai" && !isAiSurface()) setOpen(true);
    if (!activeThreadRef.current) {
      const id = crypto.randomUUID();
      activeThreadRef.current = id;
      setActiveThreadId(id);
      rememberThread(id);
    }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: trimmed, blocks: [], createdAt: new Date().toISOString() },
    ]);
    await runTurn([...contentsRef.current, { role: "user", parts: [{ text: trimmed }] }]);
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
