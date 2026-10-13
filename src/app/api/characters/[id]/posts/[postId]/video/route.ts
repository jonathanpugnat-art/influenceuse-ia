import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { CREDIT_COSTS } from "@/lib/credits";
import { getEnv } from "@/lib/env";
import { inngest } from "@/lib/jobs/inngest";
import { buildMotionPrompt } from "@/lib/motion-prompts";
import { track } from "@/lib/observability/analytics";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createJob,
  createPendingPost,
  debitCredits,
  markJobFailed,
  markPostFailed,
  refundCredits,
} from "@/lib/repositories/db/jobs";
import { getOwnedPost } from "@/lib/repositories/db/posts";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter } from "@/lib/storage";
import { KLING_MODEL } from "@/lib/video/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; postId: string }> };

function asyncJobsEnabled(): boolean {
  try {
    const env = getEnv();
    return env.METADATA_DRIVER === "db" && Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);
  } catch {
    return false;
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const userId = await requireUserId();
  if (!checkRateLimit(userId, "video")) {
    return NextResponse.json(
      { error: "Dix vidéos par heure. Reviens un peu plus tard." },
      { status: 429 },
    );
  }

  if (!asyncJobsEnabled()) {
    return NextResponse.json(
      { error: "La génération vidéo nécessite METADATA_DRIVER=db et Inngest." },
      { status: 503 },
    );
  }

  const { id, postId: parentPostId } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }

  const parent = await getOwnedPost(userId, id, parentPostId);
  if (!parent || parent.status !== "succeeded" || parent.mediaKind !== "image") {
    return NextResponse.json(
      { error: "Choisis d’abord un post image réussi." },
      { status: 400 },
    );
  }

  const motionPrompt = buildMotionPrompt({
    sourceLabel: parent.sourceLabel,
    sourceKind: parent.sourceKind,
    sourceRef: parent.sourceRef,
    parentPrompt: parent.prompt,
  });

  const postId = randomUUID();
  const jobId = randomUUID();

  await createPendingPost({
    id: postId,
    characterId: id,
    ownerId: userId,
    sourceKind: "post",
    sourceRef: parentPostId,
    sourceLabel: `Vidéo · ${parent.sourceLabel}`,
    prompt: motionPrompt,
    mediaKind: "video",
    parentPostId,
    contentType: "video/mp4",
  });

  await createJob({
    id: jobId,
    ownerId: userId,
    kind: "video",
    model: KLING_MODEL,
    postId,
  });

  const debit = await debitCredits({
    userId,
    jobId,
    amount: CREDIT_COSTS.video,
  });
  if (!debit.ok) {
    await markJobFailed({
      jobId,
      status: "canceled",
      errorCode: "insufficient_credits",
    });
    await markPostFailed(postId);
    return NextResponse.json(
      {
        error: "Crédits insuffisants.",
        code: "insufficient_credits",
        balance: debit.balance,
        cost: CREDIT_COSTS.video,
      },
      { status: 402 },
    );
  }

  try {
    await inngest.send({
      name: "ofmia/video.requested",
      data: { jobId, postId, characterId: id, userId, parentPostId },
    });
  } catch (error) {
    console.error("video enqueue failed", error);
    await markJobFailed({
      jobId,
      status: "failed",
      errorCode: "enqueue_failed",
      errorMessage: error instanceof Error ? error.message : "enqueue_failed",
    });
    await markPostFailed(postId);
    await refundCredits({ userId, jobId });
    return NextResponse.json(
      { error: "La file vidéo est indisponible. Crédits remboursés." },
      { status: 503 },
    );
  }

  await track(userId, {
    name: "video_requested",
    props: { parentSourceKind: parent.sourceKind },
  });

  return NextResponse.json({ postId, jobId, parentPostId }, { status: 202 });
}
