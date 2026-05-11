import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  influencer: { count: vi.fn() },
  content: { count: vi.fn() },
  socialAccount: { count: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock("@/server/db", () => ({ db: mockDb }));

import { getOnboardingState } from "@/server/services/onboarding.service";

describe("onboarding.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0% with all steps undone for a brand-new user", async () => {
    mockDb.influencer.count.mockResolvedValue(0);
    mockDb.content.count.mockResolvedValue(0);
    mockDb.socialAccount.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({ plan: "FREE" });

    const state = await getOnboardingState("u1");
    expect(state.completed).toBe(false);
    expect(state.progress).toBe(0);
    expect(state.steps.every((s) => !s.done)).toBe(true);
  });

  it("marks completed=true once all 4 required steps are done", async () => {
    mockDb.influencer.count.mockResolvedValue(2);
    mockDb.content.count
      .mockResolvedValueOnce(5) // generated content
      .mockResolvedValueOnce(3); // scheduled+published
    mockDb.socialAccount.count.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({ plan: "FREE" });

    const state = await getOnboardingState("u1");
    expect(state.completed).toBe(true);
    expect(state.progress).toBe(1);
    // upgradePlan stays "not done" but is optional, so completed is still true.
    expect(state.steps.find((s) => s.id === "upgradePlan")?.done).toBe(false);
  });

  it("computes partial progress correctly", async () => {
    mockDb.influencer.count.mockResolvedValue(1);
    mockDb.content.count
      .mockResolvedValueOnce(2) // generated
      .mockResolvedValueOnce(0); // scheduled
    mockDb.socialAccount.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({ plan: "FREE" });

    const state = await getOnboardingState("u1");
    // 2 done out of 4 required → 50%.
    expect(state.progress).toBe(0.5);
    expect(state.completed).toBe(false);
  });

  it("marks upgradePlan done when user is on a paid plan", async () => {
    mockDb.influencer.count.mockResolvedValue(0);
    mockDb.content.count.mockResolvedValue(0);
    mockDb.socialAccount.count.mockResolvedValue(0);
    mockDb.user.findUnique.mockResolvedValue({ plan: "PRO" });

    const state = await getOnboardingState("u1");
    expect(state.steps.find((s) => s.id === "upgradePlan")?.done).toBe(true);
  });
});
