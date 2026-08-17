import { useCallback, useEffect, useRef } from "react";

type DebouncedCallback<Args extends unknown[]> = ((...args: Args) => void) & {
  flush: () => void;
  cancel: () => void;
};

export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = 1000,
) {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);
  const lastArgsRef = useRef<Args | null>(null);
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (!timerRef.current || !lastArgsRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    callbackRef.current(...lastArgsRef.current);
  }, []);

  useEffect(() => () => {
    if (!timerRef.current || !lastArgsRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    callbackRef.current(...lastArgsRef.current);
  }, []);

  const run = useCallback((...args: Args) => {
    lastArgsRef.current = args;
    cancel();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      callbackRef.current(...args);
    }, delay);
  }, [cancel, delay]) as DebouncedCallback<Args>;

  run.flush = flush;
  run.cancel = cancel;
  return run;
}
