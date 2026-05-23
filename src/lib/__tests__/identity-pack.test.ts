import { describe, it, expect } from "vitest";
import {
  parseIdentityPack,
  selectIdentityPackRefs,
  type IdentityPackRecord,
} from "@/lib/identity-pack";

describe("identity-pack", () => {
  const pack: IdentityPackRecord = {
    status: "ready",
    updatedAt: "2026-01-01T00:00:00.000Z",
    shots: [
      { id: "portrait_front", url: "https://cdn.example.com/front.jpg" },
      { id: "profile", url: "https://cdn.example.com/profile.jpg" },
      { id: "three_quarter", url: "https://cdn.example.com/34.jpg" },
      { id: "full_body", url: "https://cdn.example.com/body.jpg" },
    ],
  };

  it("parses a valid identity pack record", () => {
    const parsed = parseIdentityPack(pack);
    expect(parsed?.status).toBe("ready");
    expect(parsed?.shots).toHaveLength(4);
  });

  it("defaults to base + three_quarter + full_body for generic poses", () => {
    const refs = selectIdentityPackRefs("https://cdn.example.com/front.jpg", pack);
    expect(refs[0]).toBe("https://cdn.example.com/front.jpg");
    expect(refs).toContain("https://cdn.example.com/34.jpg");
    expect(refs).toContain("https://cdn.example.com/body.jpg");
    expect(refs.length).toBeLessThanOrEqual(4);
  });

  it("prioritizes full_body ref for full-body scenes", () => {
    const refs = selectIdentityPackRefs("https://cdn.example.com/front.jpg", pack, {
      pose: "full_body",
      maxTotal: 3,
    });
    expect(refs[1]).toBe("https://cdn.example.com/body.jpg");
  });
});
