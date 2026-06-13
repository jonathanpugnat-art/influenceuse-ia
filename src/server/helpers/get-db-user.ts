import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";

type ClerkProfile = {
  email: string;
  name: string | null;
  imageUrl: string | null;
};

async function readClerkProfile(): Promise<ClerkProfile | null> {
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    return {
      email: clerkUser.emailAddresses?.[0]?.emailAddress?.trim() ?? "",
      name: clerkUser.fullName ?? clerkUser.firstName ?? null,
      imageUrl: clerkUser.imageUrl ?? null,
    };
  } catch {
    // Clerk not available or not configured
    return null;
  }
}

/**
 * Find or auto-create a user by Clerk ID.
 * If the user doesn't exist yet (webhook hasn't fired), we create with defaults
 * so the app remains functional.
 *
 * When the same email already exists under an older Clerk ID (common after
 * switching Clerk test ↔ live keys), we re-link the existing row instead of
 * failing on the unique email constraint.
 */
export async function getDbUser(clerkId: string) {
  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const profile = await readClerkProfile();
  const email = profile?.email ?? "";

  if (email) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      const user = await db.user.update({
        where: { id: byEmail.id },
        data: {
          clerkId,
          ...(profile?.name ? { name: profile.name } : {}),
          ...(profile?.imageUrl ? { imageUrl: profile.imageUrl } : {}),
        },
      });
      console.log(
        `[getDbUser] Re-linked clerkId=${clerkId} to existing user id=${user.id} email=${user.email}`
      );
      return user;
    }
  }

  const user = await db.user.create({
    data: {
      clerkId,
      email: email || `pending-${clerkId}@placeholder.local`,
      name: profile?.name ?? undefined,
      imageUrl: profile?.imageUrl ?? undefined,
      plan: "FREE",
      creditsLimit: PLANS.FREE.credits,
      creditsUsed: 0,
    },
  });

  console.log(`[getDbUser] Auto-created user for clerkId=${clerkId} email=${user.email}`);
  return user;
}
