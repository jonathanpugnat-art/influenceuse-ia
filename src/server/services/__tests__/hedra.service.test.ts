import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.HEDRA_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
});

import { getGenerationStatus, hedraModelSlug } from "@/server/services/hedra.service";

function mockJsonOnce(body: unknown, status = 200) {
  // @ts-expect-error stub
  global.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

describe("hedra.service", () => {
  it("hedraModelSlug defaults to together/hedra-avatar", () => {
    delete process.env.HEDRA_MODEL_SLUG;
    expect(hedraModelSlug()).toBe("together/hedra-avatar");
  });

  it("normalizes 'complete' from status + asset_id/url shapes", async () => {
    mockJsonOnce({
      status: "COMPLETE",
      asset_id: "asset-1",
      url: "https://cdn.hedra/x.mp4",
    });
    const s = await getGenerationStatus("gen_1");
    expect(s.state).toBe("complete");
    expect(s.assetId).toBe("asset-1");
    expect(s.url).toBe("https://cdn.hedra/x.mp4");
  });

  it("normalizes nested output.url / output.thumbnail_url shape", async () => {
    mockJsonOnce({
      state: "succeeded",
      output: {
        asset_id: "asset-2",
        url: "https://cdn.hedra/y.mp4",
        thumbnail_url: "https://cdn.hedra/y.jpg",
      },
    });
    const s = await getGenerationStatus("gen_2");
    expect(s.state).toBe("complete");
    expect(s.url).toBe("https://cdn.hedra/y.mp4");
    expect(s.thumbnailUrl).toBe("https://cdn.hedra/y.jpg");
  });

  it("normalizes 'processing' / 'queued' variants", async () => {
    mockJsonOnce({ status: "queued" });
    let s = await getGenerationStatus("g1");
    expect(s.state).toBe("queued");

    mockJsonOnce({ status: "processing", progress: 42 });
    s = await getGenerationStatus("g2");
    expect(s.state).toBe("processing");
  });

  it("normalizes error shapes and extracts the message", async () => {
    mockJsonOnce({ status: "failed", error: { message: "content policy" } });
    const s = await getGenerationStatus("g_err");
    expect(s.state).toBe("error");
    expect(s.error).toBe("content policy");
  });

  it("throws on non-2xx with the response body embedded", async () => {
    mockJsonOnce({ error: "bad model" }, 400);
    await expect(getGenerationStatus("g_bad")).rejects.toThrow(/HTTP 400/);
  });
});
