import { db } from "@/server/db";

/**
 * Find or auto-create a user by Clerk ID.
 * If the user doesn't exist yet (webhook hasn't fired), we upsert with defaults
 * so the app remains functional. The webhook will fill in email/name later.
 */
export async function getDbUser(clerkId: string) {
  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  let email = "";
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const clerkUser = await currentUser();
    email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
  } catch {
    // Clerk not available or not configured
  }

  const user = await db.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: email || `pending-${clerkId}@placeholder.local`,
      plan: "FREE",
      creditsLimit: 50,
      creditsUsed: 0,
    },
  });

  console.log(`[getDbUser] Auto-created user for clerkId=${clerkId} email=${user.email}`);
  return user;
}
