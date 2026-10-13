import { AppShell } from "@/components/app-shell";
import { CharacterCreator } from "@/components/character-creator";
import { requireSession } from "@/lib/session";

export const metadata = {
  title: "Créer une influenceuse",
};

export default async function CreatePage() {
  await requireSession();
  return (
    <AppShell>
      <CharacterCreator />
    </AppShell>
  );
}
