const FAL_QUEUE_BASE = "https://queue.fal.run";

export function getFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error("FAL_KEY is not configured. Set it in your .env file.");
  }
  return key;
}

export function isFalKeyConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

/**
 * Submit a job to the FAL queue WITHOUT waiting. Returns the real
 * `request_id` so callers can persist it and poll/recover later
 * (important on serverless where the worker may not survive a long job).
 */
export async function falQueueSubmit(
  modelId: string,
  input: Record<string, unknown>
): Promise<string> {
  const key = getFalKey();
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`FAL submit failed (${submitRes.status}): ${text.slice(0, 240)}`);
  }

  const submitted = (await submitRes.json()) as { request_id?: string };
  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error("FAL submit returned no request_id");
  }
  return requestId;
}

export type FalQueueState = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type FalQueueCheck =
  | { state: "IN_QUEUE" | "IN_PROGRESS" }
  | { state: "COMPLETED"; result: unknown }
  | { state: "FAILED"; error: string };

/**
 * Single (non-blocking) status check for a previously submitted FAL job.
 * Used for poll-on-read recovery so a job started in a dead worker can
 * still be finalized on the next status query.
 */
export async function falQueueCheck(
  modelId: string,
  requestId: string
): Promise<FalQueueCheck> {
  const key = getFalKey();
  const statusUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`;

  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Key ${key}` },
  });
  if (!statusRes.ok) {
    const text = await statusRes.text();
    throw new Error(`FAL status failed (${statusRes.status}): ${text.slice(0, 200)}`);
  }

  const statusPayload = (await statusRes.json()) as {
    status?: string;
    error?: string;
  };

  if (statusPayload.status === "COMPLETED") {
    const resultRes = await fetch(resultUrl, {
      headers: { Authorization: `Key ${key}` },
    });
    if (!resultRes.ok) {
      const text = await resultRes.text();
      throw new Error(`FAL result failed (${resultRes.status}): ${text.slice(0, 200)}`);
    }
    return { state: "COMPLETED", result: await resultRes.json() };
  }

  if (statusPayload.status === "FAILED") {
    return { state: "FAILED", error: statusPayload.error ?? "unknown error" };
  }

  return { state: "IN_PROGRESS" };
}

/**
 * Poll FAL queue until completed. Videos need a longer default timeout than images.
 *
 * `onRequestId` fires as soon as the job is accepted so long-running callers
 * (e.g. LoRA training) can persist the real request id before the poll loop.
 */
export async function falQueueSubscribe(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs = 120_000,
  onRequestId?: (requestId: string) => void | Promise<void>
): Promise<unknown> {
  const requestId = await falQueueSubmit(modelId, input);
  if (onRequestId) await onRequestId(requestId);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const check = await falQueueCheck(modelId, requestId);
    if (check.state === "COMPLETED") return check.result;
    if (check.state === "FAILED") {
      throw new Error(`FAL generation failed: ${check.error}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(`FAL generation timed out after ${Math.round(timeoutMs / 1000)}s`);
}
