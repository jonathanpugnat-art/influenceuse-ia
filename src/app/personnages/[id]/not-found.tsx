import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { IconArrowLeft } from "@/components/icons";

export default function CharacterNotFound() {
  return (
    <AppShell>
      <main className="page-in mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5">
        <h1 className="font-display text-4xl font-medium tracking-tight text-balance">
          Cette influenceuse n’existe pas.
        </h1>
        <p className="mt-3 text-sm text-mute">Elle a été retirée, ou le lien est incomplet.</p>
        <Link href="/" className="btn btn-ghost ring-focus mt-8 self-start">
          <IconArrowLeft size={16} />
          Influenceuses
        </Link>
      </main>
    </AppShell>
  );
}
