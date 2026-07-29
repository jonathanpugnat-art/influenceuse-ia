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

export const approveBatchInputSchema = z.object({
  batchId: z.string(),
  /** When omitted, approve every DRAFT in the batch. */
  contentIds: z.array(z.string()).min(1).max(70).optional(),
});

export const discardBatchContentsInputSchema = z.object({
  batchId: z.string(),
  contentIds: z.array(z.string()).min(1).max(70),
});
