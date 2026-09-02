import { describe, it, expect } from "vitest";
import { feedStatusLabel } from "@/components/influencer/influencer-feed";

describe("feedStatusLabel", () => {
  it("localizes every ContentStatus value to French", () => {
    expect(feedStatusLabel("DRAFT")).toBe("Brouillon");
    expect(feedStatusLabel("GENERATING")).toBe("En cours");
    expect(feedStatusLabel("READY")).toBe("Prêt");
    expect(feedStatusLabel("SCHEDULED")).toBe("Programmé");
    expect(feedStatusLabel("PUBLISHED")).toBe("Publié");
  });

  it("localizes FAILED so the feed tile no longer shows a raw English badge (QA face-lock bug)", () => {
    expect(feedStatusLabel("FAILED")).toBe("Échec");
    expect(feedStatusLabel("FAILED")).not.toBe("FAILED");
  });

  it("falls back to the raw string for unexpected values", () => {
    expect(feedStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});
