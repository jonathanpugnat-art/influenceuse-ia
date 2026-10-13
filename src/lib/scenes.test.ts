import assert from "node:assert/strict";
import test from "node:test";

import { buildScenePrompt, sceneById } from "./scenes.ts";

const niche = {
  subject: "café du matin",
  audience: "femmes de 25 à 34 ans",
  promise: "un rituel simple avant le travail",
  tone: "calme",
};

test("une scène connue produit une consigne qui garde le visage et la niche", () => {
  const scene = sceneById("cafe");
  assert.ok(scene);
  const prompt = buildScenePrompt(scene, niche);
  assert.match(prompt, /same face/i);
  assert.match(prompt, /café/i);
  assert.match(prompt, /femmes de 25 à 34 ans/);
  assert.doesNotMatch(prompt, /celebrity/i);
});

test("une scène inconnue n’existe pas", () => {
  assert.equal(sceneById("nulle-part"), null);
});
