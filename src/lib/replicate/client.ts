type ReplicatePrediction = {
  id?: string;
  status?: string;
  output?: string | string[];
  error?: string;
  metrics?: { predict_time?: number };
  urls?: { get?: string; cancel?: string };
};

const REPLICATE_HOSTS = new Set(["api.replicate.com", "replicate.delivery"]);

export class ReplicateError extends Error {
  constructor(
    message: string,
    readonly code: "missing_key" | "provider_4xx" | "provider_5xx" | "output_host_rejected" | "generation_failed",
    readonly retriable: boolean,
  ) {
    super(message);
    this.name = "ReplicateError";
  }
}

export function replicateUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const allowed =
      url.protocol === "https:" &&
      (REPLICATE_HOSTS.has(host) || host.endsWith(".replicate.delivery"));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function token(): string {
  const value = process.env.REPLICATE_API_TOKEN;
  if (!value) throw new ReplicateError("missing_key", "missing_key", false);
  return value;
}

async function parseError(response: Response): Promise<never> {
  const detail = await response.text();
  console.error("replicate error", response.status, detail.slice(0, 400));
  if (response.status === 401) {
    throw new ReplicateError("missing_key", "missing_key", false);
  }
  if (response.status >= 400 && response.status < 500) {
    throw new ReplicateError("generation_failed", "provider_4xx", false);
  }
  throw new ReplicateError("generation_failed", "provider_5xx", true);
}

export async function createPrediction(input: {
  model: string;
  body: Record<string, unknown>;
  webhook?: string;
  waitSeconds?: number;
}): Promise<ReplicatePrediction> {
  const auth = token();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth}`,
    "Content-Type": "application/json",
  };
  if (typeof input.waitSeconds === "number") {
    headers.Prefer = `wait=${input.waitSeconds}`;
  }

  const payload: Record<string, unknown> = { input: input.body };
  if (input.webhook) {
    payload.webhook = input.webhook;
    payload.webhook_events_filter = ["completed"];
  }

  const response = await fetch(
    `https://api.replicate.com/v1/models/${input.model}/predictions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok) await parseError(response);
  return (await response.json()) as ReplicatePrediction;
}

export async function getPrediction(id: string): Promise<ReplicatePrediction> {
  const auth = token();
  const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { Authorization: `Bearer ${auth}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as ReplicatePrediction;
}

export async function cancelPrediction(id: string): Promise<void> {
  const auth = token();
  await fetch(`https://api.replicate.com/v1/predictions/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}` },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function fetchOutput(
  output: unknown,
  options?: { timeoutMs?: number },
): Promise<Buffer> {
  const url = replicateUrl(output);
  if (!url) {
    throw new ReplicateError("output_host_rejected", "output_host_rejected", false);
  }
  const image = await fetch(url, {
    signal: AbortSignal.timeout(options?.timeoutMs ?? 30_000),
  });
  if (!image.ok) {
    throw new ReplicateError("generation_failed", "generation_failed", true);
  }
  return Buffer.from(await image.arrayBuffer());
}

export type ReplicateTraining = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
  version?: string;
};

export function parseTrainingOutput(output: unknown): { version: string | null; weights: string | null } {
  if (!output || typeof output !== "object") {
    return { version: null, weights: null };
  }
  const record = output as Record<string, unknown>;
  const version = typeof record.version === "string" ? record.version : null;
  const weights = typeof record.weights === "string" ? record.weights : null;
  return { version, weights };
}

/**
 * `version` must be `owner/name:version_id` (Replicate trainer version).
 */
export async function createTraining(input: {
  version: string;
  destination: string;
  body: Record<string, unknown>;
  webhook?: string;
}): Promise<ReplicateTraining> {
  const auth = token();
  const [modelPart, versionId] = input.version.split(":");
  if (!modelPart || !versionId || !modelPart.includes("/")) {
    throw new ReplicateError("generation_failed", "provider_4xx", false);
  }
  const payload: Record<string, unknown> = {
    destination: input.destination,
    input: input.body,
  };
  if (input.webhook) {
    payload.webhook = input.webhook;
    payload.webhook_events_filter = ["completed"];
  }
  const response = await fetch(
    `https://api.replicate.com/v1/models/${modelPart}/versions/${versionId}/trainings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) await parseError(response);
  return (await response.json()) as ReplicateTraining;
}

export async function getTraining(id: string): Promise<ReplicateTraining> {
  const auth = token();
  const response = await fetch(`https://api.replicate.com/v1/trainings/${id}`, {
    headers: { Authorization: `Bearer ${auth}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as ReplicateTraining;
}

export async function createVersionPrediction(input: {
  version: string;
  body: Record<string, unknown>;
  webhook?: string;
  waitSeconds?: number;
}): Promise<ReplicatePrediction> {
  const auth = token();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth}`,
    "Content-Type": "application/json",
  };
  if (typeof input.waitSeconds === "number") {
    headers.Prefer = `wait=${input.waitSeconds}`;
  }
  const payload: Record<string, unknown> = {
    version: input.version,
    input: input.body,
  };
  if (input.webhook) {
    payload.webhook = input.webhook;
    payload.webhook_events_filter = ["completed"];
  }
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as ReplicatePrediction;
}

export type { ReplicatePrediction };
