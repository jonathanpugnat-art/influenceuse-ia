import { NextResponse } from "next/server";

import { inngest } from "@/lib/jobs/inngest";
import { verifyReplicateWebhook } from "@/lib/replicate/webhook-signature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.REPLICATE_WEBHOOK_SIGNING_SECRET;
  const body = await request.text();

  if (secret) {
    const ok = verifyReplicateWebhook({
      body,
      secret,
      signatureHeader: request.headers.get("webhook-signature"),
      idHeader: request.headers.get("webhook-id"),
      timestampHeader: request.headers.get("webhook-timestamp"),
    });
    if (!ok) {
      return NextResponse.json({ error: "signature invalide" }, { status: 401 });
    }
  }

  let payload: {
    id?: string;
    status?: string;
    output?: string | string[] | null;
    error?: string | null;
    metrics?: { predict_time?: number };
  };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return NextResponse.json({ error: "body invalide" }, { status: 400 });
  }

  if (!payload.id || !payload.status) {
    return NextResponse.json({ error: "payload incomplet" }, { status: 400 });
  }

  await inngest.send({
    name: "ofmia/replicate.prediction.completed",
    data: {
      predictionId: payload.id,
      status: payload.status,
      output: payload.output,
      error: payload.error,
      metrics: payload.metrics,
    },
  });

  return NextResponse.json({ ok: true });
}
