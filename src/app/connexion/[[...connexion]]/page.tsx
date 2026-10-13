import { SignIn } from "@clerk/nextjs";

import { Wordmark } from "@/components/wordmark";

export const metadata = {
  title: "Connexion",
};

export default function ConnexionPage() {
  return (
    <main className="stage-glow flex min-h-[100dvh] flex-col items-center justify-center gap-10 px-6 py-16">
      <Wordmark className="text-2xl" />
      <SignIn />
    </main>
  );
}
