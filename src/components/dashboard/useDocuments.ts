"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FetchState } from "./useDashboardData";

export type ExtractionStatus = "processing" | "extracted" | "failed" | string;

export interface DocumentRecord {
  id: string;
  filename: string;
  doc_type: string | null;
  as_of_date: string | null;
  counterparty: string | null;
  extraction_status: ExtractionStatus;
  extraction_error?: string | null;
  created_at: string;
}

interface DocumentsResponse {
  documents: DocumentRecord[];
}

/**
 * Fetches the ingested-documents list once and exposes both the raw list and a
 * filename → id lookup, so source chips elsewhere on the page can link to the
 * actual file without each caller re-fetching or re-deriving the map.
 */
export function useDocuments(): {
  state: FetchState<DocumentRecord[]>;
  documentIdByFilename: Map<string, string>;
  reload: () => void;
} {
  const [state, setState] = useState<FetchState<DocumentRecord[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run(): Promise<void> {
      setState({ status: "loading" });
      try {
        const res = await fetch("/api/documents", { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = (await res.json()) as DocumentsResponse;
        if (!cancelled) setState({ status: "ready", data: json.documents ?? [] });
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
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const documentIdByFilename = useMemo(() => {
    const map = new Map<string, string>();
    if (state.status === "ready") {
      for (const doc of state.data) {
        if (!map.has(doc.filename)) map.set(doc.filename, doc.id);
      }
    }
    return map;
  }, [state]);

  return { state, documentIdByFilename, reload };
}
