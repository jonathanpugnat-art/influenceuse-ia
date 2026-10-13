import { NextResponse } from "next/server";

import { getJobForOwner, p95DurationMs } from "@/lib/repositories/db/jobs";
import { getPostById } from "@/lib/repositories/db/posts";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  const { id } = await context.params;

  try {
    const job = await getJobForOwner(id, userId);
    if (!job) {
      return NextResponse.json({ error: "Job introuvable." }, { status: 404 });
    }

    const elapsedMs = Date.now() - new Date(job.queuedAt).getTime();
    const p95 = await p95DurationMs(job.kind);
    const etaMs =
      p95 && job.status !== "succeeded" && job.status !== "failed" && job.status !== "timed_out"
        ? Math.max(0, p95 - elapsedMs)
        : null;

    const post = job.postId ? await getPostById(job.postId) : null;

    return NextResponse.json({
      id: job.id,
      status: job.status,
      kind: job.kind,
      postId: job.postId,
      previewId: job.previewId,
      elapsedMs,
      etaMs,
      durationMs: job.durationMs,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      identityScore: post?.identityScore ?? null,
      identityStatus: post?.identityStatus ?? null,
      generationAttempts: post?.generationAttempts ?? null,
    });
  } catch (error) {
    console.error("job status failed", error);
    return NextResponse.json(
      { error: "Jobs indisponibles (METADATA_DRIVER=db requis)." },
      { status: 503 },
    );
  }
}
