import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", mockFetch);

import {
  extractFalErrorDetail,
  FalQueueSubmitError,
  falQueueSubmit,
  redactFalSecrets,
} from "@/server/services/image-providers/fal-queue.client";

describe("extractFalErrorDetail", () => {
  it("prefers JSON detail / message / error and caps length", () => {
    expect(
      extractFalErrorDetail(
        JSON.stringify({ detail: "Unexpected status code: 422" })
      )
    ).toBe("Unexpected status code: 422");
    expect(
      extractFalErrorDetail(JSON.stringify({ message: "likeness rejected" }))
    ).toBe("likeness rejected");
    expect(
      extractFalErrorDetail(JSON.stringify({ error: "content policy" }))
    ).toBe("content policy");
  });

  it("redacts webhook secrets from snippets", () => {
    const raw =
      "bad url https://www.aurainfluenceai.com/api/webhooks/fal-seedance?job=abc&secret=super-secret-value";
    expect(redactFalSecrets(raw)).not.toContain("super-secret-value");
    expect(extractFalErrorDetail(raw)).not.toContain("super-secret-value");
  });
});

describe("falQueueSubmit 422", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env, FAL_KEY: "test-fal-key" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("throws FalQueueSubmitError with status 422 and JSON detail snippet", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () =>
        JSON.stringify({
          detail: "Unexpected status code: 422",
          extra: "https://queue.fal.run/leak",
        }),
    });

    let caught: unknown;
    try {
      await falQueueSubmit(
        "bytedance/seedance-2.5/image-to-video",
        {
          prompt: "x",
          duration: "10",
          resolution: "480p",
          image_urls: ["https://cdn.example.com/a.jpg"],
        },
        { webhookUrl: "https://www.aurainfluenceai.com/hook?secret=do-not-log" }
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(FalQueueSubmitError);
    const fail = caught as FalQueueSubmitError;
    expect(fail.status).toBe(422);
    expect(fail.message).toContain("422");
    expect(fail.message).toContain("Unexpected status code: 422");
    expect(fail.detail).toContain("Unexpected status code: 422");
    expect(fail.message).not.toContain("do-not-log");
    expect(fail.detail).not.toContain("do-not-log");
  });
});
