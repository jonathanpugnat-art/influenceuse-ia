import { describe, expect, it } from "vitest";

import { FORMATS } from "@/lib/formats";
import { AUDIENCE_FACES, FORMAT_FACES, LUNA_SCENES } from "@/lib/landing-faces";

describe("landing faces", () => {
  it("covers every published format with a locked-face visual", () => {
    for (const format of FORMATS) {
      expect(FORMAT_FACES[format.id]?.src).toMatch(/^\/landing\//);
    }
  });

  it("proves Luna consistency with four distinct scenes", () => {
    const srcs = LUNA_SCENES.map((face) => face.src);
    expect(new Set(srcs).size).toBe(4);
    expect(srcs.every((src) => src.includes("luna"))).toBe(true);
  });

  it("maps one face per audience card", () => {
    expect(AUDIENCE_FACES).toHaveLength(3);
  });
});
