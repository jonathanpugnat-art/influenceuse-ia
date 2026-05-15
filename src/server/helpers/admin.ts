/**
 * Admin gating for /admin/* routes and the `admin.*` tRPC router.
 *
 * During the closed beta we don't need a full role/permission system —
 * a comma-separated list of admin emails in `ADMIN_EMAILS` is enough:
 *
 *   ADMIN_EMAILS="jonathan@example.com, ops@example.com"
 *
 * We match against the **primary email** on the Clerk user (lower-cased
 * and trimmed) which is verified at sign-up, so this can't be spoofed by
 * adding the address to a user account post-hoc.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Returns true when the Clerk user's primary email is in `ADMIN_EMAILS`.
 * Returns false when env is unset (defensive: no admins == no access).
 */
export async function isAdminClerkId(clerkUserId: string): Promise<boolean> {
  const allowed = getAdminEmails();
  if (allowed.size === 0) return false;
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const primaryId = user.primaryEmailAddressId;
  const primary = user.emailAddresses.find((e) => e.id === primaryId);
  const email = primary?.emailAddress?.toLowerCase().trim();
  if (!email) return false;
  return allowed.has(email);
}

/**
 * tRPC helper — throws FORBIDDEN if the caller isn't on the admin list.
 * Use inside protected procedures after `getDbUser()` resolves `clerkId`.
 */
export async function requireAdmin(clerkUserId: string): Promise<void> {
  const ok = await isAdminClerkId(clerkUserId);
  if (!ok) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }
}
