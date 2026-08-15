"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExposureResponse, LiquidityResponse } from "./types";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

function useJson<T>(url: string): { state: FetchState<T>; reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run(): Promise<void> {
      setState({ status: "loading" });
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = (await res.json()) as T;
        if (!cancelled) setState({ status: "ready", data: json });
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Request failed";
        setState({ status: "error", message });
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}

export function useExposure(): { state: FetchState<ExposureResponse>; reload: () => void } {
  return useJson<ExposureResponse>("/api/exposure");
}

export function useLiquidity(): { state: FetchState<LiquidityResponse>; reload: () => void } {
  return useJson<LiquidityResponse>("/api/liquidity");
}
