import { z } from "zod";

export const listBatchesInputSchema = z.object({
  influencerId: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const batchIdInputSchema = z.object({
  batchId: z.string(),
});

export const processBatchSliceInputSchema = z.object({
  batchId: z.string(),
  sliceSize: z.number().int().min(1).max(5).default(3),
});
