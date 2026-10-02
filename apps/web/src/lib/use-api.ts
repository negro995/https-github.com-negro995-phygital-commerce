"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";

export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export interface UseApiOptions<T> {
  /** Poll interval in ms. */
  refreshMs?: number;
  /** Return false to pause polling (e.g. once an order reaches a final state). */
  shouldPoll?: (data: T | undefined) => boolean;
  /** Extra values that trigger a refetch when they change (e.g. the signed-in user id). */
  deps?: unknown[];
}

/** Fetches `path` (skipped when null), keeping the last data visible while refetching. */
export function useApi<T>(path: string | null, opts: UseApiOptions<T> = {}): ApiState<T> {
  const key = path === null ? null : `${path}|${JSON.stringify(opts.deps ?? [])}`;
  const [state, setState] = useState<{ key: string | null; data?: T; error: string | null }>({ key: null, error: null });
  const dataRef = useRef<T | undefined>(undefined);
  const shouldPollRef = useRef(opts.shouldPoll);

  useEffect(() => {
    dataRef.current = state.data;
    shouldPollRef.current = opts.shouldPoll;
  });

  const fetchOnce = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!path) return;
      try {
        const data = await api<T>(path);
        if (isCurrent()) setState({ key, data, error: null });
      } catch (err) {
        if (isCurrent()) setState((s) => ({ key, data: s.data, error: errorMessage(err) }));
      }
    },
    [path, key],
  );

  const { refreshMs } = opts;
  useEffect(() => {
    if (!key) return;
    let active = true;
    const isCurrent = () => active;
    void fetchOnce(isCurrent);
    const timer = refreshMs
      ? setInterval(() => {
          if (shouldPollRef.current?.(dataRef.current) ?? true) void fetchOnce(isCurrent);
        }, refreshMs)
      : undefined;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, fetchOnce, refreshMs]);

  const reload = useCallback(() => fetchOnce(), [fetchOnce]);

  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    reload,
  };
}
