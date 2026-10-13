"use client";

import { useEffect, useState } from "react";

type JobStatus = {
  id: string;
  status: string;
  kind: string;
  postId?: string | null;
  previewId?: string | null;
  elapsedMs: number;
  etaMs: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  identityScore?: number | null;
  identityStatus?: "pending" | "fidele" | "proche" | "derive" | "non_mesure" | null;
  generationAttempts?: number | null;
};

export function useJobStatus(jobId: string | null) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          if (!cancelled) setError("Statut indisponible.");
          return;
        }
        const payload = (await response.json()) as JobStatus;
        if (cancelled) return;
        setJob(payload);
        const done = ["succeeded", "failed", "timed_out", "canceled"].includes(payload.status);
        const pollBudgetMs = payload.kind === "video" ? 240_000 : 120_000;
        if (!done && payload.elapsedMs < pollBudgetMs) {
          timer = setTimeout(poll, payload.kind === "video" ? 2500 : 1500);
        }
      } catch {
        if (!cancelled) setError("Statut indisponible.");
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return { job, error };
}
