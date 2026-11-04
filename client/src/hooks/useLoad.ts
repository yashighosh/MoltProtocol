import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import { DisconnectedError } from "../connection/client";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "disconnected" }
  | { kind: "error"; message: string };

export function useLoad<T>(loader: (() => Promise<T>) | null, deps: unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!loader) {
      setState({ kind: "disconnected" });
      return;
    }
    let stop = false;
    setState({ kind: "loading" });
    loader()
      .then((data) => {
        if (!stop) setState({ kind: "ready", data });
      })
      .catch((reason: unknown) => {
        if (stop) return;
        if (reason instanceof DisconnectedError) setState({ kind: "disconnected" });
        else if (reason instanceof ApiError && reason.status === 404) setState({ kind: "disconnected" });
        else setState({ kind: "error", message: reason instanceof Error ? reason.message : "Request failed" });
      });
    return () => {
      stop = true;
    };
    // Loader identity changes with the caller. Deps list the inputs that should refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { state, reload };
}

export function shownCount(value: number | null | undefined): string {
  return value == null ? "Not assessed" : String(value);
}
