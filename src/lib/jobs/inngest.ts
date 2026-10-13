import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "ofmia" });

export type PostRequestedData = {
  jobId: string;
  postId: string;
  characterId: string;
  userId: string;
};

export type VideoRequestedData = {
  jobId: string;
  postId: string;
  characterId: string;
  userId: string;
  parentPostId: string;
};

export type PreviewRequestedData = {
  jobId: string;
  previewId: string;
  userId: string;
};

export type PredictionCompletedData = {
  predictionId: string;
  status: string;
  output?: string | string[] | null;
  error?: string | null;
  metrics?: { predict_time?: number };
};

export type IdentityRefsRequestedData = {
  characterId: string;
  userId: string;
};

export type LoraRequestedData = {
  jobId: string;
  characterId: string;
  userId: string;
  loraId: string;
};
