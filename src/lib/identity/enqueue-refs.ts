import { getEnv } from "@/lib/env";
import { inngest } from "@/lib/jobs/inngest";

export async function enqueueIdentityRefs(input: {
  characterId: string;
  userId: string;
}): Promise<void> {
  const env = getEnv();
  if (!env.IDENTITY_REFS_ENABLED || env.METADATA_DRIVER !== "db") return;
  if (!process.env.INNGEST_EVENT_KEY && !process.env.INNGEST_DEV) return;
  await inngest.send({
    name: "ofmia/identity.refs.requested",
    data: { characterId: input.characterId, userId: input.userId },
  });
}
