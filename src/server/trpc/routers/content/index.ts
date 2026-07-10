import { mergeRouters } from "@/server/trpc";
import { contentPhotoRouter } from "./photo.router";
import { contentReelRouter } from "./reel.router";
import { contentTextRouter } from "./text.router";
import { contentCrudRouter } from "./crud.router";
import { contentBatchRouter } from "./batch.router";
import { contentRecycleRouter } from "./recycle.router";

export type { PhotoCreatorInput } from "@/server/trpc/schemas/content";

export const contentRouter = mergeRouters(
  contentPhotoRouter,
  contentReelRouter,
  contentTextRouter,
  contentCrudRouter,
  contentBatchRouter,
  contentRecycleRouter
);
