import assert from "node:assert/strict";
import test from "node:test";

import { parseHashtag, rankReels, toReel } from "./reels.ts";

test("un hashtag se nettoie et se valide", () => {
  assert.equal(parseHashtag(" #GRWM "), "grwm");
  assert.equal(parseHashtag("a"), null);
  assert.equal(parseHashtag("bad tag"), null);
});

test("un item Apify vidéo devient un reel, une photo est ignorée", () => {
  const video = toReel(
    {
      shortCode: "abc",
      url: "https://www.instagram.com/reel/abc/",
      type: "Video",
      videoPlayCount: 1200,
      likesCount: 30,
      caption: "matin",
      ownerUsername: "lina",
      displayUrl: "https://cdn/x.jpg",
    },
    "grwm",
    "2026-09-27T00:00:00.000Z",
  );
  assert.ok(video);
  assert.equal(video.plays, 1200);
  const photo = toReel(
    { shortCode: "p", url: "https://www.instagram.com/p/p/", type: "Image" },
    "grwm",
    "2026-09-27T00:00:00.000Z",
  );
  assert.equal(photo, null);
});

test("les reels se classent par vues", () => {
  const base = { url: "https://www.instagram.com/reel/x/", caption: "", likes: 0, thumbnail: null, owner: "", hashtag: "t", fetchedAt: "" };
  const ranked = rankReels([
    { ...base, id: "a", plays: 10 },
    { ...base, id: "b", plays: 500 },
  ]);
  assert.equal(ranked[0]?.id, "b");
});
