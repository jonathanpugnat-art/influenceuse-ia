import { describe, expect, it } from "vitest";

import {
  estimateYaw,
  pickAngleSources,
  pickReference,
  yawToAngle,
} from "@/lib/identity/angles";

describe("identity angles", () => {
  it("estime le yaw depuis les landmarks", () => {
    const yaw = estimateYaw([
      [40, 50],
      [60, 50],
      [55, 60],
      [45, 70],
      [55, 70],
    ]);
    expect(yaw).toBeGreaterThan(0);
    expect(yawToAngle(yaw)).toBe("three_quarter_right");
  });

  it("répartit les sources par angle", () => {
    const picked = pickAngleSources([
      { key: "a", contentType: "image/jpeg", yaw: 0 },
      { key: "b", contentType: "image/jpeg", yaw: -0.3 },
      { key: "c", contentType: "image/jpeg", yaw: 0.4 },
    ]);
    expect(picked.front?.key).toBe("a");
    expect(picked.three_quarter_left?.key).toBe("b");
    expect(picked.three_quarter_right?.key).toBe("c");
  });

  it("pickReference se replie sur front", () => {
    const refs = [
      { angle: "front" as const, key: "f" },
      { angle: "three_quarter_left" as const, key: "l" },
    ];
    expect(pickReference(refs, "three_quarter_right")?.key).toBe("f");
    expect(pickReference(refs, "three_quarter_left")?.key).toBe("l");
  });
});
