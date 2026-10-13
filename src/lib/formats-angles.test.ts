import { describe, expect, it } from "vitest";

import { FORMATS } from "@/lib/formats";
import { isFaceAngle } from "@/lib/identity/angles";
import { SCENES } from "@/lib/scenes";

describe("format/scene angles", () => {
  it("chaque format a un angle valide", () => {
    for (const format of FORMATS) {
      expect(isFaceAngle(format.angle)).toBe(true);
    }
  });

  it("chaque scène a un angle valide", () => {
    for (const scene of SCENES) {
      expect(isFaceAngle(scene.angle)).toBe(true);
    }
  });
});
