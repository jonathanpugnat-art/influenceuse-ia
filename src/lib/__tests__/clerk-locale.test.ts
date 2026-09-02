import { describe, expect, it } from "vitest";
import { clerkAuthPaths } from "@/lib/clerk-locale";

describe("clerkAuthPaths", () => {
  it("keeps French auth on /fr", () => {
    expect(clerkAuthPaths("fr")).toEqual({
      signInUrl: "/fr/sign-in",
      signUpUrl: "/fr/sign-up",
      afterSignOutUrl: "/fr/home",
      fallbackRedirectUrl: "/fr/influencers",
    });
  });

  it("does not send English visitors to /fr/sign-in", () => {
    expect(clerkAuthPaths("en").signInUrl).toBe("/en/sign-in");
    expect(clerkAuthPaths("en").signUpUrl).toBe("/en/sign-up");
  });
});
