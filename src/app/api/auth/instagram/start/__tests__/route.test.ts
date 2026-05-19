import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  influencer: { findUnique: vi.fn() },
}));
const mockGetAuthUrl = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }));
vi.mock("@/server/db", () => ({ db: mockDb }));
vi.mock("@/server/services/instagram.service", () => ({
  getAuthUrl: mockGetAuthUrl,
}));

import { GET } from "../route";

function makeReq(qs: string) {
  return new NextRequest(`http://localhost:3000/api/auth/instagram/start${qs}`);
}

describe("GET /api/auth/instagram/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUrl.mockReturnValue(
      "https://www.facebook.com/v21.0/dialog/oauth?client_id=fake"
    );
  });

  it("redirects anonymous users to /sign-in", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeReq("?influencerId=inf-1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("errors when influencerId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk-1" });
    const res = await GET(makeReq(""));
    expect(res.headers.get("location")).toContain("missing_influencer_id");
  });

  it("rejects influencers the caller does not own (IDOR guard)", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk-1" });
    mockDb.user.findUnique.mockResolvedValue({ id: "u-1" });
    mockDb.influencer.findUnique.mockResolvedValue({
      id: "inf-1",
      userId: "u-OTHER",
    });
    const res = await GET(makeReq("?influencerId=inf-1"));
    expect(res.headers.get("location")).toContain("invalid_influencer");
    expect(mockGetAuthUrl).not.toHaveBeenCalled();
  });

  it("redirects to the Facebook OAuth dialog when the caller owns the influencer", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk-1" });
    mockDb.user.findUnique.mockResolvedValue({ id: "u-1" });
    mockDb.influencer.findUnique.mockResolvedValue({
      id: "inf-1",
      userId: "u-1",
    });
    const res = await GET(makeReq("?influencerId=inf-1"));
    expect(mockGetAuthUrl).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/instagram$/),
      "inf-1"
    );
    expect(res.headers.get("location")).toBe(
      "https://www.facebook.com/v21.0/dialog/oauth?client_id=fake"
    );
  });

  it("surfaces a friendly error if the service throws (missing env)", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk-1" });
    mockDb.user.findUnique.mockResolvedValue({ id: "u-1" });
    mockDb.influencer.findUnique.mockResolvedValue({
      id: "inf-1",
      userId: "u-1",
    });
    mockGetAuthUrl.mockImplementation(() => {
      throw new Error("INSTAGRAM_APP_ID non configuré.");
    });
    const res = await GET(makeReq("?influencerId=inf-1"));
    expect(res.headers.get("location")).toContain("instagram_error=");
    expect(res.headers.get("location")).toContain("INSTAGRAM_APP_ID");
  });
});
