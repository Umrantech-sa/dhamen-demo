"use client";

import { useCallback, useEffect, useState } from "react";
import { demo, onRefresh } from "./api";

/** Fetches a sandbox view and re-fetches whenever any mutation happens in the app. */
export function useDemo<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>();
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    const fetchIt = () =>
      demo.get<T>(path).then(
        (data) => alive && setState({ path, data }),
        (e: unknown) => alive && setState((s) => ({ path, data: s?.path === path ? s.data : undefined, error: e instanceof Error ? e.message : String(e) })),
      );
    void fetchIt();
    const off = onRefresh(() => void fetchIt());
    // Poll only while the tab is visible to keep storage traffic low.
    const timer = opts.pollMs ? setInterval(() => !document.hidden && void fetchIt(), opts.pollMs) : undefined;
    return () => {
      alive = false;
      off();
      if (timer) clearInterval(timer);
    };
  }, [path, opts.pollMs, tick]);

  const current = state?.path === path ? state : undefined;
  return { data: current?.data, error: current?.error, loading: !!path && !current?.data && !current?.error, reload };
}
