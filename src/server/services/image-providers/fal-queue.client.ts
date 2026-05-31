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

/** Poll FAL queue until completed. Videos need a longer default timeout than images. */
export async function falQueueSubscribe(
  modelId: string,
  input: Record<string, unknown>,
  timeoutMs = 120_000
): Promise<unknown> {
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

  const statusUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status`;
  const resultUrl = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
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
      return resultRes.json();
    }

    if (statusPayload.status === "FAILED") {
      throw new Error(
        `FAL generation failed: ${statusPayload.error ?? "unknown error"}`
      );
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(`FAL generation timed out after ${Math.round(timeoutMs / 1000)}s`);
}
