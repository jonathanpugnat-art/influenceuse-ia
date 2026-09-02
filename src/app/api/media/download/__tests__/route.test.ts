import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));

import { GET } from "../route";

function makeReq(url: string) {
  return new NextRequest(
    `http://localhost:3000/api/media/download?url=${encodeURIComponent(url)}`
  );
}

describe("GET /api/media/download", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...env };
    process.env.R2_PUBLIC_URL = "https://media.example.com";
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockAuth.mockResolvedValue({ userId: "clerk-1" });
  });

  afterEach(() => {
    process.env = env;
  });

  it("requires Clerk auth", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeReq("https://media.example.com/a.jpg"));
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 when an allowlisted host 302s to 127.0.0.1", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/secret" },
      })
    );

    const res = await GET(makeReq("https://media.example.com/a.jpg"));
    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toBe(
      "https://media.example.com/a.jpg"
    );
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("returns 403 when an allowlisted host 302s to 169.254.169.254", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data" },
      })
    );

    const res = await GET(makeReq("https://replicate.delivery/out.png"));
    expect(res.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("proxies an allowed https R2 URL", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    );

    const res = await GET(makeReq("https://media.example.com/content/abc.jpg"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("abc.jpg");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("proxies an allowed https replicate.delivery URL", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([9, 8]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );

    const res = await GET(makeReq("https://replicate.delivery/out.png"));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects http URLs without fetching", async () => {
    const res = await GET(makeReq("http://media.example.com/a.jpg"));
    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a body larger than 50MB via Content-Length", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { "content-length": String(51 * 1024 * 1024) },
      })
    );

    const res = await GET(makeReq("https://media.example.com/huge.bin"));
    expect(res.status).toBe(413);
  });
});
