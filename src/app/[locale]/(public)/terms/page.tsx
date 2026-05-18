import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Aura Influences",
  description:
    "Conditions générales d'utilisation du service Aura Influences AI.",
};

/**
 * Public terms of service page.
 *
 * Required by:
 * - Stripe (terms URL must be discoverable from the checkout flow)
 * - Meta Developer App settings (terms URL is mandatory)
 * - Clerk Pro tier (visible on the sign-up screen footer)
 */
export default function TermsPage() {
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
            Conditions d&apos;utilisation
          </h1>
          <p className="text-sm text-slate-400">
            Dernière mise à jour : 18 mai 2026
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">1. Objet</h2>
          <p className="leading-relaxed">
            Les présentes conditions régissent l&apos;utilisation du service
            Aura Influences AI (ci-après «&nbsp;Aura&nbsp;»), plateforme de
            création d&apos;influenceuses virtuelles et de génération de
            contenus assistée par intelligence artificielle.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">2. Acceptation</h2>
          <p className="leading-relaxed">
            En créant un compte sur Aura, vous acceptez sans réserve les
            présentes conditions. Si vous n&apos;acceptez pas ces conditions,
            vous ne devez pas utiliser le service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Éligibilité</h2>
          <p className="leading-relaxed">
            Vous devez être âgé(e) d&apos;au moins 18 ans pour utiliser Aura.
            En vous inscrivant, vous garantissez avoir la capacité juridique
            de contracter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. Compte utilisateur</h2>
          <p className="leading-relaxed">
            Vous êtes seul(e) responsable de la confidentialité de vos
            identifiants. Toute activité réalisée depuis votre compte est
            présumée provenir de vous. Vous devez signaler immédiatement
            toute utilisation non autorisée à{" "}
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
          <h2 className="text-xl font-semibold text-white">5. Utilisation acceptable</h2>
          <p className="leading-relaxed">
            Vous vous engagez à ne pas utiliser Aura pour&nbsp;:
          </p>
          <ul className="list-inside list-disc space-y-1 text-slate-300">
            <li>Générer du contenu illégal, diffamatoire, haineux ou enfreignant les droits d&apos;autrui</li>
            <li>Créer des influenceuses ressemblant à des personnes réelles sans leur consentement</li>
            <li>Générer du contenu pédopornographique (zéro tolérance, signalement systématique)</li>
            <li>Diffuser du contenu trompeur sans mention de son caractère synthétique</li>
            <li>Tenter d&apos;accéder à des comptes tiers ou à l&apos;infrastructure d&apos;Aura</li>
            <li>Revendre l&apos;accès au service ou ses générations en marque blanche sans accord</li>
          </ul>
          <p className="leading-relaxed">
            Tout manquement entraîne la suspension immédiate du compte sans
            remboursement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">6. Contenus générés</h2>
          <p className="leading-relaxed">
            Vous conservez la propriété intellectuelle des contenus que vous
            générez via Aura, dans les limites permises par les modèles IA
            sous-jacents (Replicate, Anthropic, Google). Aura se réserve un
            droit d&apos;usage anonymisé et agrégé à des fins d&apos;amélioration
            du service.
          </p>
          <p className="leading-relaxed">
            <strong>Transparence&nbsp;:</strong> conformément à l&apos;AI Act
            européen, vous vous engagez à indiquer le caractère synthétique
            des contenus générés lorsque vous les publiez sur des plateformes
            tierces.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Abonnement et facturation</h2>
          <p className="leading-relaxed">
            Aura propose des plans gratuits et payants. Les paiements sont
            traités par Stripe. Sauf mention contraire, les abonnements sont
            renouvelés automatiquement à la fin de chaque période. Vous pouvez
            annuler à tout moment depuis votre espace facturation — le service
            reste accessible jusqu&apos;à la fin de la période en cours.
          </p>
          <p className="leading-relaxed">
            Aucun remboursement n&apos;est accordé pour les périodes entamées,
            sauf cas prévu par la loi (droit de rétractation de 14 jours pour
            le premier abonnement, sauf si vous avez utilisé du crédit
            payant).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">8. Disponibilité</h2>
          <p className="leading-relaxed">
            Aura est fourni «&nbsp;en l&apos;état&nbsp;». Aucune garantie de
            disponibilité 24/7 n&apos;est offerte pendant la phase beta. En cas
            d&apos;interruption supérieure à 24h, des crédits compensatoires
            pourront être attribués sur demande.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">9. Responsabilité</h2>
          <p className="leading-relaxed">
            La responsabilité d&apos;Aura est limitée au montant payé par
            l&apos;utilisateur sur les 12 derniers mois. Aura ne saurait être
            tenu responsable de l&apos;usage que vous faites des contenus
            générés, ni des conséquences d&apos;une publication sur des
            plateformes tierces.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">10. Droit applicable</h2>
          <p className="leading-relaxed">
            Les présentes conditions sont régies par le droit français. Tout
            litige sera soumis aux tribunaux compétents de Paris, après
            tentative de résolution amiable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">11. Contact</h2>
          <p className="leading-relaxed">
            Pour toute question&nbsp;:{" "}
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
