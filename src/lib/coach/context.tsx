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
import { parseCoachReply } from "@/src/lib/coach/parse-blocks";
import type {
  CoachBlock,
  CoachChatResponse,
  CoachContent,
  CoachMessage,
  CoachPageContext,
  CoachPart,
  PendingWrite,
} from "@/src/lib/coach/types";
import { TOOL_THINKING } from "@/src/lib/coach/types";
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
  pageContext: CoachPageContext;
  autoApply: boolean;
  setPageContext: (context: CoachPageContext) => void;
  setAutoApply: (value: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  toggleExpanded: () => void;
  ask: (prompt: string) => Promise<void>;
  confirmWrite: (write: PendingWrite) => Promise<void>;
  dismissWrite: (write: PendingWrite) => void;
  clearError: () => void;
};

const CoachContext = createContext<CoachContextValue | null>(null);

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
  const [pageContext, setPageContextState] = useState<CoachPageContext>({ currentPage: "home" });
  const [autoApply, setAutoApplyState] = useState(false);
  const contentsRef = useRef(contents);
  contentsRef.current = contents;

  useEffect(() => {
    setAutoApplyState(window.localStorage.getItem(AUTO_KEY) === "1");
  }, []);

  const setPageContext = useCallback((context: CoachPageContext) => {
    pageRef.current = context;
    setPageContextState(context);
  }, []);

  const setAutoApply = useCallback((value: boolean) => {
    setAutoApplyState(value);
    window.localStorage.setItem(AUTO_KEY, value ? "1" : "0");
  }, []);

  const runTurn = useCallback(async (nextContents: CoachContent[]) => {
    setContents(nextContents);
    contentsRef.current = nextContents;
    setBusy(true);
    setError(null);
    setThinking(null);
    try {
      let current = nextContents;
      const collectedWrites: PendingWrite[] = [];
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
              responseParts.push({
                functionResponse: { id: call.id, name: call.name, response: result.data },
              });
            }
          }
          current = [...current, modelContent, { role: "user", parts: responseParts }];
          continue;
        }

        const parsed = parseCoachReply(json.text ?? "");
        const assistant: CoachMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: parsed.text,
          blocks: injectConfirmations(parsed.blocks, collectedWrites),
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
    setOpen(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: trimmed, blocks: [] },
    ]);
    await runTurn([...contentsRef.current, { role: "user", parts: [{ text: trimmed }] }]);
  }, [busy, runTurn]);

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
    pageContext,
    autoApply,
    setPageContext,
    setAutoApply,
    openPanel: () => setOpen(true),
    closePanel: () => {
      setOpen(false);
      setExpanded(false);
    },
    toggleExpanded: () => setExpanded((value) => !value),
    ask,
    confirmWrite,
    dismissWrite,
    clearError: () => setError(null),
  }), [ask, autoApply, busy, confirmWrite, dismissWrite, error, expanded, messages, open, pageContext, setAutoApply, setPageContext, thinking]);

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
