import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Clock, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Suppression des données — Aura Influences",
  description:
    "Procédure pour demander la suppression de votre compte et de toutes vos données personnelles sur Aura Influences AI.",
};

/**
 * Public data deletion request page.
 *
 * Required by:
 * - GDPR Art. 17 (right to erasure)
 * - California CCPA (right to delete)
 * - Meta Developer App settings (mandatory data deletion URL)
 *
 * The page MUST be publicly accessible without authentication — Meta
 * scrapes it during App Review. The middleware whitelists this route
 * explicitly to bypass Clerk's auth wall.
 */
export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <header className="space-y-2 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-white">
            Suppression de vos données
          </h1>
          <p className="text-sm text-slate-400">
            Conforme au RGPD (Art. 17) et au CCPA californien
          </p>
        </header>

        <section className="space-y-4">
          <p className="leading-relaxed">
            Vous pouvez à tout moment demander la suppression complète de
            votre compte Aura Influences AI et de l&apos;intégralité des
            données associées (influenceuses créées, contenus générés,
            historique de facturation, comptes sociaux connectés).
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Mail className="h-5 w-5 text-violet-400" />
            Procédure par email
          </h2>
          <ol className="ml-4 list-decimal space-y-3 text-slate-300">
            <li>
              <p>
                Envoyez un email à{" "}
                <a
                  href="mailto:jonathanpugnat@gmail.com?subject=Demande%20de%20suppression%20de%20donn%C3%A9es%20%E2%80%94%20Aura"
                  className="font-semibold text-violet-300 hover:underline"
                >
                  jonathanpugnat@gmail.com
                </a>
              </p>
            </li>
            <li>
              <p>
                <strong>Objet&nbsp;:</strong> «&nbsp;Demande de suppression de
                données — Aura&nbsp;»
              </p>
            </li>
            <li>
              <p>
                <strong>Corps du message&nbsp;:</strong> indiquez l&apos;adresse
                email que vous avez utilisée pour créer votre compte Aura.
                Aucune autre information n&apos;est nécessaire.
              </p>
            </li>
          </ol>
          <p className="text-sm text-slate-400">
            💡 Astuce&nbsp;: vous pouvez cliquer directement sur l&apos;email
            ci-dessus, votre client de messagerie ouvrira un brouillon
            pré-rempli.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <Clock className="h-5 w-5 text-violet-400" />
            <h3 className="font-semibold text-white">Délai</h3>
            <p className="text-sm text-slate-400">
              Votre demande est traitée sous 7 jours ouvrés et toutes vos
              données sont supprimées de nos systèmes (et de nos sous-traitants)
              dans un délai maximum de <strong>30 jours</strong>.
            </p>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <Shield className="h-5 w-5 text-violet-400" />
            <h3 className="font-semibold text-white">Confirmation</h3>
            <p className="text-sm text-slate-400">
              Vous recevrez un email de confirmation une fois la suppression
              effective. Les sauvegardes chiffrées sont automatiquement
              expirées sous 90 jours.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Ce qui sera supprimé
          </h2>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>Votre profil utilisateur (email, nom, préférences)</li>
            <li>Toutes vos influenceuses virtuelles et leurs configurations</li>
            <li>Tous les contenus générés (photos, vidéos, brouillons)</li>
            <li>Les comptes sociaux que vous aviez connectés</li>
            <li>Les jetons d&apos;accès OAuth (Instagram, etc.) sont révoqués</li>
            <li>Vos données d&apos;analyse et de personnalisation</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Ce qui peut être conservé
          </h2>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>
              <strong>Documents comptables</strong> (factures Stripe) —
              conservés 10 ans, obligation légale du Code de commerce
              français
            </li>
            <li>
              <strong>Journaux de sécurité anonymisés</strong> — conservés
              12 mois pour la détection d&apos;abus
            </li>
          </ul>
          <p className="text-sm text-slate-400">
            Ces données conservées ne permettent plus de vous identifier
            personnellement.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-white">Plateformes tierces</h2>
          <p className="leading-relaxed text-slate-300">
            La suppression sur Aura n&apos;efface pas automatiquement les
            contenus que vous auriez publiés sur Instagram, TikTok ou d&apos;autres
            plateformes. Vous devez les supprimer directement depuis ces
            plateformes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Réclamation</h2>
          <p className="leading-relaxed">
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez
            introduire une réclamation auprès de la CNIL via{" "}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline"
            >
              cnil.fr/fr/plaintes
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
