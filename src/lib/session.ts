import { auth } from "@clerk/nextjs/server";

export async function requireUserId(): Promise<string> {
  const session = await auth.protect();
  if (!session.userId) {
    throw new Error("session sans utilisateur");
  }
  return session.userId;
}

export async function requireSession(): Promise<void> {
  await requireUserId();
}
