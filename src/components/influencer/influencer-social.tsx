"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Link2,
  Loader2,
  Unlink,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Platform = "INSTAGRAM" | "TIKTOK" | "ONLYFANS";

const PLATFORM_META: Record<
  Platform,
  {
    name: string;
    icon: typeof InstagramIcon;
    iconColor: string;
    gradient: string;
    description: string;
    /** Whether OAuth is actually implemented + reviewable today. */
    oauthSupported: boolean;
  }
> = {
  INSTAGRAM: {
    name: "Instagram",
    icon: InstagramIcon,
    iconColor: "text-pink-400",
    gradient: "from-pink-500/20 to-orange-500/20",
    description:
      "Publication directe de photos, carrousels et reels via l'API Graph officielle. Compte Business ou Creator requis.",
    oauthSupported: true,
  },
  TIKTOK: {
    name: "TikTok",
    icon: TikTokIcon,
    iconColor: "text-white",
    gradient: "from-cyan-500/20 to-pink-500/20",
    description:
      "Publication de vidéos via Content Posting API. En attente de validation Meta-side avant activation.",
    oauthSupported: false,
  },
  ONLYFANS: {
    name: "OnlyFans",
    icon: OnlyFansIcon,
    iconColor: "text-blue-400",
    gradient: "from-blue-500/20 to-cyan-500/20",
    description:
      "OnlyFans ne propose pas d'API publique. Le contenu est préparé pour téléchargement et publication manuelle.",
    oauthSupported: false,
  },
};

/**
 * Sprint 14 — OAuth Instagram social tab on the influencer profile.
 *
 * Renders one card per supported platform with:
 *  - Connected: green checkmark, username, expiry hint, "Disconnect" button
 *  - Disconnected with OAuth: "Connecter" button → trpc.publish.connectInstagram
 *    returns the FB OAuth URL → we redirect the browser
 *  - Disconnected without OAuth: greyed out with explanatory caption
 *
 * Also reads ?instagram=connected / ?instagram_error=... from the URL after
 * Facebook redirects back, surfaces a toast, and cleans the query string.
 */
export function InfluencerSocial({ influencerId }: { influencerId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(
    null
  );

  const { data: accounts, isLoading } =
    trpc.publish.getConnectedAccounts.useQuery({ influencerId });

  const connectInstagramMut = trpc.publish.connectInstagram.useMutation({
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => {
      setConnectingPlatform(null);
      toast.error(err.message);
    },
  });

  const disconnectMut = trpc.publish.disconnectAccount.useMutation({
    onSuccess: () => {
      utils.publish.getConnectedAccounts.invalidate({ influencerId });
      toast.success("Compte déconnecté");
    },
    onError: (err) => toast.error(err.message),
  });

  // Surface OAuth callback feedback then strip the query so a refresh doesn't
  // re-fire the toast indefinitely. We intentionally keep this effect minimal:
  // setSearchParams isn't a thing in Next 16 yet, so we router.replace instead.
  useEffect(() => {
    const connected = searchParams.get("instagram");
    const error = searchParams.get("instagram_error");

    if (connected === "connected") {
      toast.success("Instagram connecté avec succès !");
      utils.publish.getConnectedAccounts.invalidate({ influencerId });
      router.replace(window.location.pathname);
    } else if (error) {
      toast.error(`Erreur Instagram : ${decodeURIComponent(error)}`);
      router.replace(window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const findAccount = (platform: Platform) =>
    accounts?.find((a) => a.platform === platform);

  const handleConnect = (platform: Platform) => {
    if (platform !== "INSTAGRAM") return;
    setConnectingPlatform(platform);
    connectInstagramMut.mutate({ influencerId });
  };

  const handleDisconnect = (socialAccountId: string) => {
    if (
      !window.confirm(
        "Déconnecter ce compte ? Les publications planifiées seront mises en pause."
      )
    ) {
      return;
    }
    disconnectMut.mutate({ socialAccountId });
  };

  return (
    <div className="space-y-4">
      {/* Onboarding banner — surfaces prereqs that catch most users off-guard */}
      <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
        <div className="space-y-1.5 text-sm text-slate-300">
          <p className="font-semibold text-white">
            Avant de connecter Instagram
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
            <li>
              Ton compte Instagram doit être en mode{" "}
              <strong>Professionnel</strong> (Business ou Creator)
            </li>
            <li>
              Il doit être lié à une <strong>Page Facebook</strong> (même
              vide)
            </li>
            <li>
              Tu autoriseras Aura à publier en ton nom — révocable à tout
              moment
            </li>
            <li>
              Publication via l’<strong>API officielle Meta</strong> — pas de
              likes automatisés ni de bots (réduit le risque de sanction)
            </li>
          </ul>
        </div>
      </div>

      {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
        const meta = PLATFORM_META[platform];
        const Icon = meta.icon;
        const account = findAccount(platform);
        const isConnected = Boolean(account?.isConnected);
        const isConnecting = connectingPlatform === platform;
        const isDisconnecting =
          disconnectMut.isPending &&
          disconnectMut.variables?.socialAccountId === account?.id;

        const expiresAt = account?.tokenExpiresAt
          ? new Date(account.tokenExpiresAt)
          : null;
        const tokenAboutToExpire =
          expiresAt &&
          expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

        return (
          <div
            key={platform}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl",
              isConnected
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-slate-800/50 bg-slate-900/50"
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", meta.gradient)} />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    isConnected ? "bg-emerald-500/20" : "bg-slate-800/50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", meta.iconColor)} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {meta.name}
                    </h3>
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Connecté
                      </span>
                    ) : !meta.oauthSupported ? (
                      <span className="rounded-full bg-slate-800/50 px-2 py-0.5 text-xs text-slate-500">
                        Bientôt
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm text-slate-400">
                    {meta.description}
                  </p>

                  {isConnected && account && (
                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      <p>
                        <span className="text-slate-500">Compte :</span>{" "}
                        <strong className="text-slate-200">
                          @{account.username}
                        </strong>
                      </p>
                      {expiresAt && (
                        <p
                          className={cn(
                            tokenAboutToExpire
                              ? "text-amber-300"
                              : "text-slate-500"
                          )}
                        >
                          {tokenAboutToExpire ? (
                            <>
                              <AlertCircle className="mr-1 inline h-3 w-3" />
                              Le token expire bientôt — il sera renouvelé
                              automatiquement à la prochaine publication.
                            </>
                          ) : (
                            <>
                              Token valide jusqu&apos;au{" "}
                              {expiresAt.toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                ) : isConnected && account ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={isDisconnecting}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    Déconnecter
                  </button>
                ) : meta.oauthSupported ? (
                  <button
                    type="button"
                    onClick={() => handleConnect(platform)}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Redirection...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3 w-3" />
                        Connecter
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-center text-xs text-slate-500">
        🔒 Tes tokens d&apos;accès sont chiffrés (AES-256) avant stockage et
        ne sont jamais accessibles en clair.{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-violet-400 hover:underline"
        >
          En savoir plus
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
