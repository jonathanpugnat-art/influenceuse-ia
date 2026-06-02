import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Root `/[locale]` — dashboard for signed-in users, marketing home for guests.
 * Landing content lives at `/[locale]/home`.
 */
export default async function LocaleRootPage({ params }: Props) {
  const { locale } = await params;
  const { userId } = await auth();

  if (userId) {
    redirect(`/${locale}/influencers`);
  }

  redirect(`/${locale}/home`);
}
