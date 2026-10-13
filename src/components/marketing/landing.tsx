import Link from "next/link";

import {
  IconArrowRight,
  IconCheck,
  IconDownload,
  IconFaces,
  IconSpark,
  IconTrend,
} from "@/components/icons";
import { FormatShowcase } from "@/components/marketing/format-showcase";
import { LockedFace } from "@/components/marketing/locked-face";
import { Wordmark } from "@/components/wordmark";
import { PLANS, type Plan } from "@/lib/billing/plans";
import {
  AMANI_LOCK,
  AUDIENCE_FACES,
  LUNA_LOCK,
  LUNA_SCENES,
} from "@/lib/landing-faces";

const NAV = [
  { href: "#fonctionnement", label: "Fonctionnement" },
  { href: "#consistance", label: "Consistance" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
] as const;

const LOOP = [
  {
    step: "01",
    title: "Trouve ce qui marche",
    body: "On remonte les reels qui prennent des vues sur un hashtag. Tu vois la structure qui tourne avant de produire quoi que ce soit.",
    Icon: IconTrend,
  },
  {
    step: "02",
    title: "Refais-le avec ton visage",
    body: "Même hook, même format. Le visage, le style et la marque restent les tiens, verrouillés sur chaque post.",
    Icon: IconSpark,
  },
  {
    step: "03",
    title: "Publie, ou télécharge",
    body: "Caption et hashtags générés depuis le visuel. Tu récupères le post prêt pour Instagram, sans shoot ni montage.",
    Icon: IconDownload,
  },
] as const;

const CONSISTENCY = [
  { title: "Visage verrouillé", body: "Le même visage, la même carrure, le même style sur chaque image et chaque reel." },
  { title: "Produit en série", body: "Des dizaines de posts depuis une seule niche. Tu changes la scène, pas la personne." },
  { title: "À toi, pour toujours", body: "Droits commerciaux complets. Tu exportes et tu utilises partout." },
] as const;

const AUDIENCES = [
  {
    tag: "Manager OFM",
    title: "Un catalogue, pas un shoot",
    body: "Monte une influenceuse par niche et sors des semaines de contenu sans caméra, sans modèle, sans retouche.",
  },
  {
    tag: "Créateur solo",
    title: "Poste sans te filmer",
    body: "Une présence reconnaissable qui bosse à ta place. Pas de prise, pas de reprise, pas de prompt à écrire.",
  },
  {
    tag: "Agence",
    title: "Plusieurs visages, un seul atelier",
    body: "Gère les comptes de tes clients avec un visage constant par marque, à volume, au même endroit.",
  },
] as const;

const COMPARISON = [
  "Le même visage sur chaque photo et chaque vidéo",
  "Partir de traits, ou d’un visage que tu uploades",
  "Reprendre un reel qui marche, structure comprise",
  "Caption et hashtags générés depuis le visuel",
  "Droits commerciaux complets sur ce que tu produis",
] as const;

const FAQ = [
  {
    q: "C’est quoi, une influenceuse IA ?",
    a: "Une personne virtuelle générée par IA : un visage et un style cohérents, créés une fois puis réutilisés sur toutes tes images, vidéos et posts. Pas de caméra, pas de shoot.",
  },
  {
    q: "Pourquoi la consistance change tout ?",
    a: "La plupart des générateurs changent de visage à chaque prompt. Ofmia verrouille le visage : ton audience reconnaît toujours la même personne, campagne après campagne.",
  },
  {
    q: "Combien ça coûte ?",
    a: "On commence gratuitement avec le plan Découverte et ses crédits offerts. Les plans payants démarrent à 29 € par mois. Un post coûte 1 crédit, une vidéo 10.",
  },
  {
    q: "J’ai les droits sur ce que je crée ?",
    a: "Oui. Tu as les droits commerciaux complets sur les images et vidéos générées avec ton influenceuse.",
  },
  {
    q: "Et la légalité ?",
    a: "Tu crées des personnages fictifs ou tu clones un visage dont tu as le droit d’usage. Pas de célébrité ni de personne réelle sans consentement.",
  },
] as const;

const PRICE_ORDER: readonly { plan: Plan; highlight?: boolean; note: string }[] = [
  { plan: PLANS.decouverte, note: "Pour tester la boucle complète" },
  { plan: PLANS.starter, note: "Pour un créateur qui publie" },
  { plan: PLANS.creator, highlight: true, note: "Le plus choisi" },
  { plan: PLANS.agence, note: "Pour gérer plusieurs clients" },
];

export function Landing() {
  return (
    <div className="page-in">
      <header className="sticky top-0 z-50 border-b border-line bg-stage/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-10">
          <Wordmark />
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="telemetry shift text-[0.6875rem] text-mute hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="btn btn-quiet ring-focus hidden sm:inline-flex">
              Connexion
            </Link>
            <Link href="/inscription" className="btn btn-primary ring-focus pr-2 pl-4">
              Créer mon influenceuse
              <span className="btn-icon">
                <IconArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 md:px-10">
        {/* Hero */}
        <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="telemetry text-[0.625rem] text-dim">Ofmia / Studio d’influenceuses IA</p>
            <h1 className="font-display mt-4 text-4xl font-bold tracking-[-0.03em] text-balance uppercase md:text-6xl">
              Un visage verrouillé. Du contenu qui marche déjà sur Instagram.
            </h1>
            <p className="mt-5 max-w-prose text-base text-pretty text-mute">
              Invente une influenceuse à partir de traits, ou clone un visage depuis tes photos.
              Reprends les reels qui prennent des vues, refais-les avec elle, publie. Toujours la
              même personne, à volume.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/inscription" className="btn btn-primary ring-focus pr-2 pl-5">
                Créer mon influenceuse
                <span className="btn-icon">
                  <IconArrowRight size={14} />
                </span>
              </Link>
              <a href="#fonctionnement" className="btn btn-ghost ring-focus">
                Voir le fonctionnement
              </a>
            </div>
            <p className="telemetry mt-5 text-[0.625rem] text-dim">
              Gratuit pour commencer · Visage constant · Droits commerciaux à toi
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <LockedFace
              src={LUNA_LOCK.src}
              alt={LUNA_LOCK.alt}
              label={LUNA_LOCK.label}
              priority
              sizes="(min-width: 768px) 260px, 46vw"
            />
            <LockedFace
              src={LUNA_SCENES[1]!.src}
              alt={LUNA_SCENES[1]!.alt}
              label="Même visage · autre scène"
              priority
              className="mt-8"
              sizes="(min-width: 768px) 260px, 46vw"
            />
          </div>
        </section>

        <hr className="rule" />

        {/* Boucle 3 étapes */}
        <section id="fonctionnement" className="py-16 md:py-24">
          <p className="telemetry text-[0.625rem] text-dim">La boucle</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Trouve ce qui marche. Refais-le. Publie.
          </h2>
          <p className="mt-4 max-w-prose text-sm text-pretty text-mute">
            Toute la boucle de contenu au même endroit. Moins de temps à déplacer des fichiers entre
            outils, plus de temps à construire une présence reconnaissable.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {LOOP.map(({ step, title, body, Icon }) => (
              <div key={step} className="panel lift flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-bold text-lime">{step}</span>
                  <span className="btn-icon bg-lime-soft">
                    <Icon size={16} className="text-lime" />
                  </span>
                </div>
                <h3 className="font-display text-xl font-medium">{title}</h3>
                <p className="text-sm text-pretty text-mute">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="rule" />

        {/* Consistance */}
        <section id="consistance" className="grid gap-10 py-16 md:grid-cols-[1fr_1fr] md:py-24">
          <div>
            <p className="telemetry text-[0.625rem] text-dim">Une persona</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
              Un visage. Des centaines de posts.
            </h2>
            <p className="mt-4 max-w-prose text-sm text-pretty text-mute">
              La plupart des outils changent de visage à chaque prompt. Pas celui-ci. La même
              personne sur chaque photo, chaque reel, chaque campagne. Ton audience sait toujours
              qui elle suit.
            </p>
            <ul className="mt-8 space-y-4">
              {CONSISTENCY.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="btn-icon mt-0.5 bg-lime-soft">
                    <IconCheck size={14} className="text-lime" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-display text-base font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm text-pretty text-mute">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {LUNA_SCENES.map((face) => (
              <LockedFace
                key={face.src}
                src={face.src}
                alt={face.alt}
                label={face.label}
                sizes="(min-width: 768px) 240px, 46vw"
              />
            ))}
          </div>
        </section>

        <hr className="rule" />

        {/* Formats qui marchent */}
        <section className="py-16 md:py-24">
          <p className="telemetry text-[0.625rem] text-dim">Formats</p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Les formats qui retiennent, prêts à refaire.
          </h2>
          <p className="mt-4 max-w-prose text-sm text-pretty text-mute">
            Pas besoin de deviner ce qui marche. On part des formats qui tournent déjà, ton
            influenceuse les rejoue.
          </p>
          <FormatShowcase />
        </section>

        <hr className="rule" />

        {/* Comparatif / ROI */}
        <section className="grid gap-10 py-16 md:grid-cols-[1fr_1fr] md:py-24">
          <div>
            <p className="telemetry text-[0.625rem] text-dim">Pourquoi un atelier dédié</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
              29 € par mois, pas 5 000 € de shoot.
            </h2>
            <p className="mt-4 max-w-prose text-sm text-pretty text-mute">
              Un brief UGC empile cachets, droits, reprises et marge d’agence. Ton influenceuse
              travaille depuis un seul abonnement, disponible en continu, toujours sur la marque.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="panel p-5">
                <p className="telemetry text-[0.625rem] text-dim">Shoot classique</p>
                <p className="font-display mt-2 text-2xl font-bold">5 semaines</p>
                <p className="mt-1 text-sm text-mute">casting, prise, reprises</p>
              </div>
              <div className="panel border-lime p-5">
                <p className="telemetry text-[0.625rem] text-lime">Avec Ofmia</p>
                <p className="font-display mt-2 text-2xl font-bold">5 minutes</p>
                <p className="mt-1 text-sm text-mute">génère, revois, recommence</p>
              </div>
            </div>
          </div>
          <div className="panel p-6 md:p-8">
            <p className="telemetry text-[0.625rem] text-dim">Ce que fait un générateur dédié</p>
            <ul className="mt-5 divide-y divide-line">
              {COMPARISON.map((line) => (
                <li key={line} className="flex items-center gap-3 py-3">
                  <IconCheck size={16} className="text-lime" strokeWidth={3} />
                  <span className="text-sm text-pretty">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="rule" />

        {/* Audiences */}
        <section className="py-16 md:py-24">
          <p className="telemetry text-[0.625rem] text-dim">Pour qui</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Managers, créateurs, agences.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((item, index) => {
              const face = AUDIENCE_FACES[index];
              return (
                <div key={item.tag} className="panel lift overflow-hidden">
                  {face ? (
                    <LockedFace
                      src={face.src}
                      alt={face.alt}
                      framed={false}
                      aspect="aspect-[5/6]"
                      objectPosition={index === 0 ? "center 28%" : undefined}
                      sizes="(min-width: 768px) 320px, 92vw"
                    />
                  ) : null}
                  <div className="flex flex-col gap-3 p-6">
                    <span className="telemetry text-[0.625rem] text-lime">{item.tag}</span>
                    <h3 className="font-display text-xl font-medium">{item.title}</h3>
                    <p className="text-sm text-pretty text-mute">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <hr className="rule" />

        {/* Tarifs */}
        <section id="tarifs" className="py-16 md:py-24">
          <p className="telemetry text-[0.625rem] text-dim">Tarifs</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Simple, et qui suit ta cadence.
          </h2>
          <p className="mt-4 max-w-prose text-sm text-pretty text-mute">
            Commence gratuitement, passe à l’échelle quand tu publies. Un post = 1 crédit, une vidéo
            = 10. Détail complet dans l’app.
          </p>
          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {PRICE_ORDER.map(({ plan, highlight, note }) => (
              <div
                key={plan.id}
                className={`panel flex flex-col p-5 ${highlight ? "border-lime" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="telemetry text-[0.625rem] text-dim">{plan.name}</p>
                  {highlight ? (
                    <span className="telemetry text-[0.625rem] text-lime">{note}</span>
                  ) : null}
                </div>
                <p className="font-display mt-3 text-3xl font-bold tabular">
                  {plan.priceEur}
                  <span className="text-base font-medium text-mute">€</span>
                  <span className="text-sm font-medium text-mute"> / mois</span>
                </p>
                <p className="mt-2 tabular text-sm text-mute">
                  {plan.creditsPerMonth.toLocaleString("fr-FR")} crédits ·{" "}
                  {plan.maxInfluencers} {plan.maxInfluencers > 1 ? "influenceuses" : "influenceuse"}
                </p>
                {!highlight ? <p className="mt-1 text-sm text-dim">{note}</p> : null}
                <Link
                  href="/inscription"
                  className={`btn ring-focus mt-6 w-full ${highlight ? "btn-primary" : "btn-ghost"}`}
                >
                  {plan.priceEur === 0 ? "Commencer gratuitement" : "Choisir"}
                </Link>
              </div>
            ))}
          </div>
          <p className="telemetry mt-5 text-[0.625rem] text-dim">
            Paiement sécurisé par Stripe · Annulable à tout moment
          </p>
        </section>

        <hr className="rule" />

        {/* FAQ */}
        <section id="faq" className="py-16 md:py-24">
          <p className="telemetry text-[0.625rem] text-dim">FAQ</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
            Les questions avant de commencer.
          </h2>
          <div className="panel mt-10 divide-y divide-line overflow-hidden">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4 md:px-6">
                <summary className="ring-focus flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-display text-lg font-medium">{item.q}</span>
                  <span className="btn-icon bg-white/8 transition-transform group-open:rotate-45">
                    <IconArrowRight size={14} className="text-lime -rotate-45" />
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-sm text-pretty text-mute">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="pb-24">
          <div className="bezel lift">
            <div className="bezel-core grid items-center gap-8 p-0 md:grid-cols-[1.2fr_1fr]">
              <div className="stage-glow p-8 md:p-12">
                <h2 className="font-display text-3xl font-bold tracking-tight text-balance uppercase md:text-4xl">
                  Crée le visage. Construis le feed.
                </h2>
                <p className="mt-3 max-w-xl text-sm text-pretty text-mute">
                  D’une idée à une influenceuse reconnaissable et une boucle de contenu répétable,
                  dans un seul atelier.
                </p>
                <Link href="/inscription" className="btn btn-primary ring-focus mt-8 pr-2 pl-5">
                  Créer mon influenceuse
                  <span className="btn-icon">
                    <IconArrowRight size={14} />
                  </span>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <LockedFace
                  src={LUNA_LOCK.src}
                  alt={LUNA_LOCK.alt}
                  framed={false}
                  aspect="aspect-[3/4]"
                  sizes="(min-width: 768px) 220px, 46vw"
                />
                <LockedFace
                  src={AMANI_LOCK.src}
                  alt={AMANI_LOCK.alt}
                  framed={false}
                  aspect="aspect-[3/4]"
                  sizes="(min-width: 768px) 220px, 46vw"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-center md:px-10">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="telemetry text-[0.625rem] text-dim">
              <IconFaces size={12} className="mr-1 inline text-dim" aria-hidden />
              Studio d’influenceuses IA
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="telemetry shift text-[0.625rem] text-dim hover:text-mute"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/connexion"
              className="telemetry shift text-[0.625rem] text-dim hover:text-mute"
            >
              Connexion
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
