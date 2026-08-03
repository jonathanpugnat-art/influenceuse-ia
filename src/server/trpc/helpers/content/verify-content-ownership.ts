import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";

export async function verifyContentOwnership(contentId: string, clerkId: string) {
  const user = await getDbUser(clerkId);
  const content = await db.content.findUnique({
    where: { id: contentId },
    include: { influencer: { select: { userId: true } } },
  });
  if (!content || content.influencer.userId !== user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
  }
  return { user, content };
}
