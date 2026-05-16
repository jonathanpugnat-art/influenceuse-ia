import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { PLANS } from "@/lib/constants";

const WEBHOOK_SECRET =
  process.env.CLERK_WEBHOOK_SIGNING_SECRET ?? process.env.WEBHOOK_SECRET;

/**
 * When `BETA_REQUIRE_INVITE=true`, sign-ups are restricted to emails that
 * an admin has explicitly promoted to "INVITED" on the waitlist. Anyone
 * who slips past the Clerk sign-up form (e.g. by hitting /sign-up directly
 * during the beta window) gets their freshly-created Clerk user deleted
 * and we skip the `db.user` row creation.
 *
 * Disabled by default so a missing env var doesn't accidentally lock you
 * out of your own app. Flip it on once the waitlist UX is wired in prod.
 */
const BETA_REQUIRE_INVITE =
  (process.env.BETA_REQUIRE_INVITE ?? "").toLowerCase() === "true";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET (or WEBHOOK_SECRET) is not set");
    return NextResponse.json(
      { error: "Webhook signing secret not configured" },
      { status: 500 }
    );
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Svix signature headers" },
      { status: 401 }
    );
  }

  const rawBody = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let payload: ClerkWebhookEvent;
  try {
    payload = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("[clerk-webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  try {
    const { type, data } = payload;

    console.log(`[clerk-webhook] Received event: ${type}`);

    const clerkId = data.id;
    const email = data.email_addresses?.[0]?.email_address;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    const imageUrl = data.image_url ?? null;

    switch (type) {
      case "user.created": {
        if (!email) {
          console.warn("[clerk-webhook] No email in user.created event");
          break;
        }

        const normalized = email.toLowerCase().trim();

        // Beta gate: only emails an admin has explicitly invited can land.
        // We check the waitlist; the Clerk invitation flow auto-bumps the
        // entry to "INVITED" so this matches the invited audience exactly.
        if (BETA_REQUIRE_INVITE) {
          const waitlistEntry = await db.waitlistEntry.findUnique({
            where: { email: normalized },
            select: { id: true, status: true },
          });
          const allowed =
            waitlistEntry?.status === "INVITED" ||
            waitlistEntry?.status === "SIGNED_UP";
          if (!allowed) {
            console.warn(
              `[clerk-webhook] Rejecting non-invited sign-up: ${normalized} (waitlist status: ${waitlistEntry?.status ?? "none"})`
            );
            try {
              const client = await clerkClient();
              await client.users.deleteUser(clerkId);
            } catch (err) {
              console.error(
                "[clerk-webhook] Failed to delete non-invited Clerk user:",
                err
              );
            }
            // Return 200 so Clerk doesn't retry — we handled the event by
            // deleting the user.
            return NextResponse.json({ received: true, rejected: true });
          }
          // Mark the waitlist entry as converted so admin dashboard
          // reflects reality.
          if (waitlistEntry) {
            await db.waitlistEntry.update({
              where: { id: waitlistEntry.id },
              data: { status: "SIGNED_UP", signedUpAt: new Date() },
            });
          }
        }

        await db.user.upsert({
          where: { clerkId },
          update: { email, name, imageUrl },
          create: {
            clerkId,
            email,
            name,
            imageUrl,
            plan: "FREE",
            creditsUsed: 0,
            // Reads from PLANS.FREE.credits so a single source of truth
            // governs the free-tier credit grant. During the bêta this is
            // 500 (cf. src/lib/constants.ts) — drops back to 50 when the
            // free beta ends.
            creditsLimit: PLANS.FREE.credits,
            locale: "fr",
          },
        });

        console.log(`[clerk-webhook] User created: ${email}`);
        break;
      }

      case "user.updated": {
        const existingUser = await db.user.findUnique({
          where: { clerkId },
        });

        if (existingUser) {
          await db.user.update({
            where: { clerkId },
            data: {
              ...(email ? { email } : {}),
              ...(name !== null ? { name } : {}),
              ...(imageUrl !== null ? { imageUrl } : {}),
            },
          });
          console.log(`[clerk-webhook] User updated: ${clerkId}`);
        }
        break;
      }

      case "user.deleted": {
        const user = await db.user.findUnique({
          where: { clerkId },
        });

        if (user) {
          await db.user.update({
            where: { clerkId },
            data: {
              email: `deleted-${clerkId}@deleted.local`,
              name: "Utilisateur supprimé",
              imageUrl: null,
            },
          });

          await db.influencer.updateMany({
            where: { userId: user.id },
            data: { status: "ARCHIVED" },
          });

          console.log(`[clerk-webhook] User anonymized: ${clerkId}`);
        }
        break;
      }

      default:
        console.log(`[clerk-webhook] Unhandled event: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[clerk-webhook] Error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
