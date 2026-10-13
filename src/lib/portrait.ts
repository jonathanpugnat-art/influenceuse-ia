type ReplicatePrediction = {
  status?: string;
  output?: string | string[];
  error?: string;
  urls?: { get?: string };
};

const REPLICATE_HOSTS = new Set(["api.replicate.com", "replicate.delivery"]);
const MAX_POLLS = 60;

function replicateUrl(value: unknown): string | null {
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

async function fetchOutput(output: unknown): Promise<Buffer> {
  const url = replicateUrl(output);
  if (!url) {
    console.error("replicate output host rejected");
    throw new Error("generation_failed");
  }
  const image = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!image.ok) {
    throw new Error("generation_failed");
  }
  return Buffer.from(await image.arrayBuffer());
}

async function finishPrediction(
  initial: ReplicatePrediction,
  token: string,
): Promise<ReplicatePrediction> {
  let data = initial;
  let polls = 0;
  const deadline = Date.now() + 90_000;
  while (data.status === "starting" || data.status === "processing") {
    const url = replicateUrl(data.urls?.get);
    if (!url || Date.now() > deadline || polls >= MAX_POLLS) break;
    polls += 1;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const next = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!next.ok) throw new Error("generation_failed");
    data = (await next.json()) as ReplicatePrediction;
  }
  return data;
}

export async function generatePortrait(prompt: string): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("missing_key");
  }

  const response = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "3:4",
          num_outputs: 1,
          output_format: "jpg",
          output_quality: 90,
          go_fast: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("replicate portrait failed", response.status, detail.slice(0, 400));
    throw new Error(response.status === 401 ? "missing_key" : "generation_failed");
  }

  const data = (await response.json()) as ReplicatePrediction;
  if (data.status !== "succeeded") {
    console.error("replicate portrait status", data.status, data.error);
    throw new Error("generation_failed");
  }

  return fetchOutput(Array.isArray(data.output) ? data.output[0] : data.output);
}

export async function generateWithFace(
  prompt: string,
  face: Buffer,
  contentType: string,
): Promise<Buffer> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("missing_key");
  }

  const response = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt,
          input_image: `data:${contentType};base64,${face.toString("base64")}`,
          aspect_ratio: "3:4",
          output_format: "jpg",
          output_quality: 90,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error("replicate post failed", response.status, detail.slice(0, 400));
    throw new Error(response.status === 401 ? "missing_key" : "generation_failed");
  }

  const data = await finishPrediction((await response.json()) as ReplicatePrediction, token);
  if (data.status !== "succeeded") {
    console.error("replicate post status", data.status, data.error);
    throw new Error("generation_failed");
  }

  return fetchOutput(Array.isArray(data.output) ? data.output[0] : data.output);
}
