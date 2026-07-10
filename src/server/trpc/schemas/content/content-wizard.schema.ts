import { z } from "zod";
import { extendedStyleSchema } from "@/lib/appearance-v2";

export const styleInputSchema = extendedStyleSchema;

export const appearanceVariationsInputSchema = z.object({
  faceShape: z.number().int().min(0),
  eyeShape: z.number().int().min(0),
  eyeColor: z.number().int().min(0),
  nose: z.number().int().min(0),
  distinctiveFeature: z.number().int().min(0),
  expression: z.number().int().min(0),
});

export const wizardPortraitInputSchema = z.object({
  age: z.number().int().min(18).max(80),
  gender: z.enum(["female", "male", "nonbinary"]).default("female"),
  style: styleInputSchema,
  /** Wizard expert mode — optional fixed trait indices from UI chips. */
  appearanceVariations: appearanceVariationsInputSchema.optional(),
});
