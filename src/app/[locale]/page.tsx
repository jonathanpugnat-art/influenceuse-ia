import { Link } from "@/i18n/navigation";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold text-white">Influenceuse IA</h1>
      <Link
        href="/influencers"
        className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
      >
        Accéder au tableau de bord
      </Link>
    </div>
  );
}
