import assert from "node:assert/strict";
import test from "node:test";

import { buildFormatPrompt, buildReelPrompt, formatById } from "./formats.ts";

const niche = {
  subject: "quotidien proche",
  audience: "hommes de 18 à 30 ans",
  promise: "une fille qui leur parle",
  tone: "doux",
};

test("un format POV garde le visage et la niche", () => {
  const format = formatById("pov");
  assert.ok(format);
  const prompt = buildFormatPrompt(format, niche);
  assert.match(prompt, /same face/i);
  assert.match(prompt, /9:16/);
  assert.match(prompt, /quotidien proche/);
});

test("un reel scrappé donne l’idée sans ses hashtags", () => {
  const prompt = buildReelPrompt({ caption: "matin lent #grwm #paris" }, niche);
  assert.match(prompt, /matin lent/);
  assert.doesNotMatch(prompt, /#grwm/);
  assert.match(prompt, /same face/i);
});
