import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { buildFormatPrompt, buildReelPrompt, formatById } from "@/lib/formats";
import { inngest } from "@/lib/jobs/inngest";
import { CREDIT_COSTS } from "@/lib/credits";
import { getEnv } from "@/lib/env";
import { track } from "@/lib/observability/analytics";
import { generateWithFace } from "@/lib/portrait";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseHashtag } from "@/lib/reels";
import {
  createJob,
  createPendingPost,
  debitCredits,
  markJobFailed,
  markPostFailed,
} from "@/lib/repositories/db/jobs";
import { getOwnedPost } from "@/lib/repositories/db/posts";
import { requireUserId } from "@/lib/session";
import { buildScenePrompt, sceneById } from "@/lib/scenes";
import {
  getOwnedCharacter,
  readCharacterFace,
  readNiche,
  readTrend,
  savePost,
} from "@/lib/storage";
import { writeCaption } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

function asyncJobsEnabled(): boolean {
  try {
    const env = getEnv();
    return env.METADATA_DRIVER === "db" && Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const userId = await requireUserId();
  if (!checkRateLimit(userId, "post")) {
    return NextResponse.json(
      { error: "Trente posts par heure. Reviens un peu plus tard." },
      { status: 429 },
    );
  }
  const { id } = await context.params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) {
    return NextResponse.json({ error: "Influenceuse introuvable." }, { status: 404 });
  }
  const niche = await readNiche(id);
  if (!niche) {
    return NextResponse.json({ error: "Définis d’abord la niche." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const regenOfPostId =
    typeof record.regenOfPostId === "string" && record.regenOfPostId.length > 0
      ? record.regenOfPostId
      : undefined;
  let previousIdentityStatus = "pending";
  if (regenOfPostId) {
    const previous = await getOwnedPost(userId, id, regenOfPostId);
    if (!previous || previous.mediaKind !== "image") {
      return NextResponse.json({ error: "Post à régénérer introuvable." }, { status: 404 });
    }
    previousIdentityStatus = previous.identityStatus;
  }

  const scene = typeof record.sceneId === "string" ? sceneById(record.sceneId) : null;
  const format = typeof record.formatId === "string" ? formatById(record.formatId) : null;
  const tag = parseHashtag(record.tag);
  const trend = tag && typeof record.reelId === "string" ? await readTrend(tag) : null;
  const reel = trend?.reels.find((item) => item.id === record.reelId) ?? null;
  type PostSource = {
    prompt: string;
    label: string;
    kind: "format" | "scene" | "reel";
    ref: string;
  };
  let source: PostSource | null = reel
    ? {
        prompt: buildReelPrompt(reel, niche),
        label: `#${reel.hashtag}`,
        kind: "reel",
        ref: reel.id,
      }
    : format
      ? {
          prompt: buildFormatPrompt(format, niche),
          label: format.label,
          kind: "format",
          ref: format.id,
        }
      : scene
        ? {
            prompt: buildScenePrompt(scene, niche),
            label: scene.label,
            kind: "scene",
            ref: scene.id,
          }
        : null;

  if (!source && regenOfPostId) {
    const previous = await getOwnedPost(userId, id, regenOfPostId);
    if (
      previous &&
      (previous.sourceKind === "format" ||
        previous.sourceKind === "scene" ||
        previous.sourceKind === "reel")
    ) {
      source = {
        prompt: previous.prompt,
        label: previous.sourceLabel,
        kind: previous.sourceKind,
        ref: previous.sourceRef,
      };
    }
  }

  if (!source) {
    return NextResponse.json({ error: "Choisis un format." }, { status: 400 });
  }

  if (asyncJobsEnabled()) {
    const postId = randomUUID();
    const jobId = randomUUID();
    await createPendingPost({
      id: postId,
      characterId: id,
      ownerId: userId,
      sourceKind: source.kind,
      sourceRef: source.ref,
      sourceLabel: source.label,
      prompt: source.prompt,
      regenOfPostId,
    });
    await createJob({
      id: jobId,
      ownerId: userId,
      kind: "post",
      model: "black-forest-labs/flux-kontext-pro",
      postId,
    });
    const debit = await debitCredits({ userId, jobId });
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
          cost: CREDIT_COSTS.post,
        },
        { status: 402 },
      );
    }
    await inngest.send({
      name: "ofmia/post.requested",
      data: { jobId, postId, characterId: id, userId },
    });
    await track(userId, { name: "post_requested", props: { sourceKind: source.kind } });
    if (regenOfPostId) {
      await track(userId, {
        name: "post_regenerated",
        props: { reason: "manual", previousStatus: previousIdentityStatus },
      });
    }
    return NextResponse.json({ postId, jobId }, { status: 202 });
  }

  const face = await readCharacterFace(character);
  if (!face) {
    return NextResponse.json({ error: "Visage introuvable." }, { status: 404 });
  }

  try {
    const started = Date.now();
    await track(userId, { name: "post_requested", props: { sourceKind: source.kind } });
    const image = await generateWithFace(source.prompt, face, character.face.contentType);
    const postId = await savePost(id, image);
    if (!postId) {
      return NextResponse.json({ error: "Le post n’a pas pu être gardé." }, { status: 500 });
    }
    let caption = "";
    try {
      caption = await writeCaption({
        name: character.name,
        formatLabel: source.label,
        niche,
      });
    } catch (captionError) {
      console.error("caption failed", captionError instanceof Error ? captionError.message : "");
    }
    await track(userId, {
      name: "post_generated",
      props: {
        durationMs: Date.now() - started,
        model: "black-forest-labs/flux-kontext-pro",
        attempts: 1,
      },
    });
    return NextResponse.json({ id: postId, caption });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    await track(userId, { name: "post_failed", props: { errorCode: code || "generation_failed" } });
    if (code === "missing_key") {
      return NextResponse.json(
        { error: "La génération d’image n’est pas configurée." },
        { status: 503 },
      );
    }
    console.error("post generation failed", code);
    return NextResponse.json({ error: "Le post n’a pas pu être créé." }, { status: 502 });
  }
}
