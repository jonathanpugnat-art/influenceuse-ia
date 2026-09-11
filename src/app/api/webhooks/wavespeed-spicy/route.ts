import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  failWavespeedSpicyJob,
  finalizeWavespeedSpicyJob,
  reconcileWavespeedSpicyJob,
  verifyWavespeedSpicyWebhookSecret,
} from "@/server/services/wavespeed-spicy.service";

export const maxDuration = 60;

/**
 * Optional WaveSpeed callback. Poll-on-read remains the primary path —
 * this receiver is best-effort when WAVESPEED_WEBHOOK_SECRET is set.
 */
export async function POST(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job");
  const secret = req.nextUrl.searchParams.get("secret");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }
  if (!verifyWavespeedSpicyWebhookSecret(secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const job = await db.wavespeedSpicyJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const parsed = parseWavespeedPayload(body);
  if (parsed.status === "COMPLETED" && parsed.videoUrl) {
    await finalizeWavespeedSpicyJob(job.id, {
      videoUrl: parsed.videoUrl,
      rawPayload: body,
    });
    return NextResponse.json({ received: true, status: "COMPLETED" });
  }
  if (parsed.status === "FAILED") {
    await failWavespeedSpicyJob(
      job.id,
      parsed.error ?? "WaveSpeed a signalé un échec."
    );
    return NextResponse.json({ received: true, status: "FAILED" });
  }

  await reconcileWavespeedSpicyJob(job.id);
  return NextResponse.json({ received: true, status: "RECONCILED" });
}

interface ParsedPayload {
  status: "COMPLETED" | "FAILED" | "UNKNOWN";
  videoUrl?: string | null;
  error?: string;
}

function parseWavespeedPayload(body: unknown): ParsedPayload {
  if (!body || typeof body !== "object") return { status: "UNKNOWN" };
  const root = body as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "timeout" ||
    status === "deleted"
  ) {
    return {
      status: "FAILED",
      error: typeof data.error === "string" ? data.error : status,
    };
  }
  const outputs = data.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === "string" && item.startsWith("http")) {
        return { status: "COMPLETED", videoUrl: item };
      }
    }
  }
  return { status: "UNKNOWN" };
}
