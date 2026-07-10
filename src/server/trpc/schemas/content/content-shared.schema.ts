import { z } from "zod";

export const platformValues = ["INSTAGRAM", "TIKTOK", "ONLYFANS"] as const;
export const contentTypeValues = ["PHOTO", "CAROUSEL", "REEL", "STORY"] as const;
export const contentStatusValues = [
  "DRAFT",
  "GENERATING",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
] as const;
export const contentModeValues = ["SFW", "NSFW"] as const;

export const platformSchema = z.enum(platformValues);
export const contentTypeSchema = z.enum(contentTypeValues);
export const contentStatusSchema = z.enum(contentStatusValues);
export const contentModeSchema = z.enum(contentModeValues);
