import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Aura Influences",
  description:
    "Politique de confidentialité et traitement des données personnelles pour Aura Influences AI.",
};

/**
 * Public privacy policy page (RGPD-compliant minimum).
 *
 * Required by:
 * - GDPR Art. 13 (information transparency)
 * - Meta Developer App settings (privacy URL is mandatory)
 * - Stripe / Clerk / Replicate ToS (must disclose subprocessors)
 *
 * Kept intentionally minimal and factual — when a real DPO is appointed
 * this page should be replaced with a properly reviewed legal text.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <header className="space-y-2 border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-white">
            Politique de confidentialité
          </h1>
          <p className="text-sm text-slate-400">
            Dernière mise à jour : 18 mai 2026
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">1. Responsable du traitement</h2>
          <p className="leading-relaxed">
            Le responsable du traitement des données collectées sur Aura
            Influences AI (ci-après «&nbsp;Aura&nbsp;») est Jonathan Pugnat,
            joignable à l&apos;adresse{" "}
            <a
              href="mailto:jonathanpugnat@gmail.com"
              className="text-violet-400 hover:underline"
            >
              jonathanpugnat@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">2. Données collectées</h2>
          <p className="leading-relaxed">
            Aura collecte uniquement les données nécessaires au fonctionnement
            du service&nbsp;:
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>Adresse email et profil utilisateur (via Clerk)</li>
            <li>Caractéristiques des influenceuses virtuelles que vous créez</li>
            <li>Contenus générés (photos, vidéos, légendes) et leurs métadonnées</li>
            <li>Historique de facturation (via Stripe, données bancaires non stockées chez nous)</li>
            <li>Comptes sociaux que vous choisissez de connecter (handles uniquement)</li>
            <li>Journaux techniques (IP, user-agent) pour la sécurité et le debugging</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Finalités</h2>
          <p className="leading-relaxed">
            Vos données sont utilisées exclusivement pour&nbsp;:
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>Fournir le service (générer des contenus, gérer votre catalogue d&apos;influenceuses)</li>
            <li>Gérer votre abonnement et la facturation</li>
            <li>Publier sur vos comptes sociaux uniquement si vous l&apos;autorisez explicitement</li>
            <li>Améliorer le produit (analyse agrégée et anonyme)</li>
          </ul>
          <p className="leading-relaxed">
            Aucune donnée n&apos;est revendue à des tiers commerciaux.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. Sous-traitants</h2>
          <p className="leading-relaxed">
            Aura s&apos;appuie sur les sous-traitants suivants, qui traitent vos
            données conformément à leur propre politique&nbsp;:
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li><strong>Clerk</strong> — authentification (USA, certifié SOC 2)</li>
            <li><strong>Stripe</strong> — paiements (Irlande/USA, certifié PCI-DSS)</li>
            <li><strong>Neon</strong> — base de données (UE, hébergement Frankfurt)</li>
            <li><strong>Vercel</strong> — hébergement de l&apos;application (USA/UE)</li>
            <li><strong>Cloudflare R2</strong> — stockage des images générées</li>
            <li><strong>Replicate, Anthropic, DeepSeek, Google</strong> — modèles IA (les prompts sont transmis aux APIs)</li>
            <li><strong>Meta (Facebook/Instagram)</strong> — uniquement si vous activez l&apos;intégration Instagram</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">5. Durée de conservation</h2>
          <p className="leading-relaxed">
            Vos données de compte sont conservées tant que votre compte est
            actif. Après suppression de votre compte, toutes les données sont
            effacées dans un délai de 30 jours, à l&apos;exception des
            documents comptables conservés 10 ans conformément au Code de
            commerce.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">6. Vos droits (RGPD)</h2>
          <p className="leading-relaxed">
            Conformément au RGPD, vous disposez des droits d&apos;accès, de
            rectification, d&apos;opposition, de portabilité et{" "}
            <strong>de suppression</strong> de vos données. Pour exercer ces
            droits, consultez notre{" "}
            <Link
              href="/data-deletion"
              className="text-violet-400 hover:underline"
            >
              page de suppression des données
            </Link>
            {" "}ou écrivez à{" "}
            <a
              href="mailto:jonathanpugnat@gmail.com"
              className="text-violet-400 hover:underline"
            >
              jonathanpugnat@gmail.com
            </a>
            .
          </p>
          <p className="leading-relaxed">
            Vous avez également le droit d&apos;introduire une réclamation
            auprès de la CNIL.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Cookies</h2>
          <p className="leading-relaxed">
            Aura utilise uniquement les cookies strictement nécessaires au
            fonctionnement (session Clerk, préférences UI). Aucun cookie
            publicitaire ni de tracking tiers n&apos;est déposé.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">8. Contact</h2>
          <p className="leading-relaxed">
            Pour toute question relative à vos données&nbsp;:{" "}
            <a
              href="mailto:jonathanpugnat@gmail.com"
              className="text-violet-400 hover:underline"
            >
              jonathanpugnat@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
