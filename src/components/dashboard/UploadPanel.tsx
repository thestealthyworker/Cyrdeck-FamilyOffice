"use client";

import { useCallback, useState } from "react";

interface UploadPanelProps {
  onUploaded: () => void;
}

interface UploadResult {
  filename: string;
  status: "uploading" | "done" | "error";
  message?: string;
}

/**
 * The growth affordance: drop in a new statement and the engine runs and populates
 * across the app. Posts straight to the existing /api/documents ingestion endpoint,
 * then tells the caller to re-fetch the graph once at least one file lands.
 */
export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => /\.(pdf|xlsx)$/i.test(f.name));
      if (files.length === 0) return;

      setResults(files.map((f) => ({ filename: f.name, status: "uploading" as const })));
      let anySucceeded = false;

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/documents", { method: "POST", body: formData });
          const json = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
          if (!res.ok) throw new Error(json.error ?? json.detail ?? `${res.status} ${res.statusText}`);
          anySucceeded = true;
          setResults((prev) =>
            prev.map((r) => (r.filename === file.name ? { ...r, status: "done" as const } : r)),
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Upload failed";
          setResults((prev) =>
            prev.map((r) => (r.filename === file.name ? { ...r, status: "error" as const, message } : r)),
          );
        }
      }

      if (anySucceeded) onUploaded();
    },
    [onUploaded],
  );

  return (
    <div
      className="upload-panel"
      data-dragging={isDragging}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void uploadFiles(e.dataTransfer.files);
      }}
    >
      <label htmlFor="document-upload" className="upload-panel__label">
        <span className="upload-panel__cta">Add a document — drop it here, or click to choose</span>
        <span className="upload-panel__hint">PDF or XLSX. The graph re-derives from every document ingested.</span>
      </label>
      <input
        id="document-upload"
        type="file"
        accept=".pdf,.xlsx"
        multiple
        className="upload-panel__input"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {results.length ? (
        <ul className="upload-panel__results">
          {results.map((r) => (
            <li key={r.filename} className={`upload-panel__result upload-panel__result--${r.status}`}>
              <span className="upload-panel__result-name">{r.filename}</span>
              <span className="upload-panel__result-status">
                {r.status === "uploading" ? "Extracting…" : r.status === "done" ? "Extracted" : r.message ?? "Failed"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
