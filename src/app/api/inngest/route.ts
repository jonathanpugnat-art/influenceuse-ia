import { serve } from "inngest/next";

import { buildIdentityRefs } from "@/lib/jobs/build-identity-refs";
import { generatePost } from "@/lib/jobs/generate-post";
import { generateVideo } from "@/lib/jobs/generate-video";
import { inngest } from "@/lib/jobs/inngest";
import { trainLora } from "@/lib/jobs/train-lora";

export const runtime = "nodejs";
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePost, generateVideo, buildIdentityRefs, trainLora],
});
