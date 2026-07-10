"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { buildWizardCreateInput } from "@/lib/wizard-create-payload";
import { ensureOfSocialDefaults } from "@/lib/wizard-of-flow";
import { buildWizardInstagramReturnPath } from "@/lib/instagram-oauth-return";
import {
  isAppearanceStepComplete,
  isIdentityStepComplete,
} from "@/lib/wizard-validation";
import { trpc } from "@/lib/trpc";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { cn } from "@/lib/utils";
import {
  wizardInputClass,
  wizardPrimaryButtonClass,
  wizardSecondaryButtonClass,
} from "@/components/influencer/wizard-ui";

type InstagramConnectProps = {
  enabled: boolean;
  username: string;
  influencerId: string | null;
  locale: string;
  isEnsuringInfluencer: boolean;
};

function InstagramConnectSection({
  enabled,
  username,
  influencerId,
  locale,
  isEnsuringInfluencer,
}: InstagramConnectProps) {
  const t = useTranslations("wizard");
  const utils = trpc.useUtils();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: accounts, refetch } = trpc.publish.getConnectedAccounts.useQuery(
    { influencerId: influencerId ?? "" },
    { enabled: Boolean(influencerId) }
  );

  const instagramAccount = accounts?.find((a) => a.platform === "INSTAGRAM");
  const isConnected = Boolean(instagramAccount?.isConnected);
  const connectedHandle = instagramAccount?.username?.replace(/^@/, "");

  const disconnectMut = trpc.publish.disconnectAccount.useMutation({
    onSuccess: () => {
      if (influencerId) {
        void utils.publish.getConnectedAccounts.invalidate({ influencerId });
      }
      toast.success(t("instagramDisconnected"));
    },
    onError: (err) => toast.error(err.message),
  });

  const trimmedUsername = username.trim();
  const canConnect =
    enabled &&
    trimmedUsername.length > 0 &&
    Boolean(influencerId) &&
    !isConnected &&
    !isEnsuringInfluencer &&
    !isRedirecting;

  const handleConnect = () => {
    if (!influencerId) return;
    setIsRedirecting(true);
    const redirectTo = buildWizardInstagramReturnPath(locale, {
      connected: "instagram",
    });
    const params = new URLSearchParams({
      influencerId,
      redirectTo,
    });
    window.location.href = `/api/auth/instagram/start?${params.toString()}`;
  };

  const handleDisconnect = () => {
    if (!instagramAccount?.id) return;
    disconnectMut.mutate({ socialAccountId: instagramAccount.id });
  };

  useEffect(() => {
    if (influencerId) {
      void refetch();
    }
  }, [influencerId, refetch]);

  if (isConnected && connectedHandle) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {t("instagramConnectedBadge", { username: connectedHandle })}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnectMut.isPending}
          className="w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
        >
          {disconnectMut.isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("instagramDisconnecting")}
            </span>
          ) : (
            t("instagramDisconnect")
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!canConnect}
      onClick={handleConnect}
      className={cn(
        "w-full rounded-lg border py-2 text-xs font-medium transition-colors",
        canConnect
          ? "border-pink-500/40 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20"
          : "border-slate-700 text-slate-500"
      )}
    >
      {isRedirecting ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("instagramConnecting")}
        </span>
      ) : isEnsuringInfluencer ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("instagramPreparingProfile")}
        </span>
      ) : (
        t("connectInstagram")
      )}
    </button>
  );
}

function SocialCard({
  icon,
  name,
  gradientFrom,
  gradientTo,
  enabled,
  onToggle,
  username,
  onUsernameChange,
  disabled,
  disabledMessage,
  note,
  hideConnect,
  instagramConnect,
}: {
  icon: React.ReactNode;
  name: string;
  gradientFrom: string;
  gradientTo: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  username: string;
  onUsernameChange: (val: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
  note?: string;
  hideConnect?: boolean;
  instagramConnect?: InstagramConnectProps;
}) {
  const t = useTranslations("wizard");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl transition-all",
        disabled && "opacity-50"
      )}
    >
      {disabled && disabledMessage && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/80 backdrop-blur-sm">
          <p className="max-w-[200px] text-center text-sm text-slate-400">
            {disabledMessage}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br",
              gradientFrom,
              gradientTo
            )}
          >
            {icon}
          </div>
          <span className="text-base font-semibold text-white">{name}</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">
                  {t("socialUsernameLabel")}
                </Label>
                <Input
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder={`@${name.toLowerCase().replace(" ", "")}`}
                  className={cn(wizardInputClass, "h-9 text-sm")}
                />
              </div>

              {!hideConnect && instagramConnect ? (
                <InstagramConnectSection {...instagramConnect} />
              ) : null}

              {note && (
                <p className="text-xs italic text-slate-500">{note}</p>
              )}

              {!hideConnect && !instagramConnect && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                  {t("socialNotConnected")}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WizardStepSocial({
  onNext,
  onPrev,
  influencerId,
  locale,
}: {
  onNext: () => void;
  onPrev: () => void;
  influencerId: string | null;
  locale: string;
}) {
  const t = useTranslations("wizard");
  const {
    data,
    updateData,
    generatedImages,
    selectedImageIndex,
    setCreatedInfluencerId,
  } = useInfluencerWizard();
  const { data: plan } = useCurrentPlan();
  const allowNsfw = plan?.features.hasNsfw ?? false;
  const showOnlyFans = allowNsfw && data.isNsfw;
  const ensureStartedRef = useRef(false);

  useEffect(() => {
    const patch = ensureOfSocialDefaults(data);
    if (patch) updateData(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync once on mount
  }, []);

  const selectedImageUrl =
    data.baseImageUrl || generatedImages[selectedImageIndex] || null;

  const ensureCreateMut = trpc.influencer.create.useMutation({
    onSuccess: (inf) => {
      setCreatedInfluencerId(inf.id);
    },
    onError: (err) => {
      ensureStartedRef.current = false;
      toast.error(err.message);
    },
  });

  const shouldEnsureInfluencer =
    data.instagramEnabled &&
    data.instagramUsername.trim().length > 0 &&
    !influencerId &&
    isIdentityStepComplete(data) &&
    isAppearanceStepComplete(data, generatedImages, selectedImageIndex);

  useEffect(() => {
    if (!shouldEnsureInfluencer || ensureCreateMut.isPending) return;
    if (ensureCreateMut.isError) return;
    if (ensureStartedRef.current) return;
    ensureStartedRef.current = true;
    ensureCreateMut.mutate(
      buildWizardCreateInput(data, selectedImageUrl || undefined)
    );
  }, [
    shouldEnsureInfluencer,
    ensureCreateMut.isPending,
    ensureCreateMut.isError,
    ensureCreateMut.mutate,
    data,
    selectedImageUrl,
  ]);

  const effectiveInfluencerId = influencerId ?? ensureCreateMut.data?.id ?? null;
  const isEnsuringInfluencer =
    shouldEnsureInfluencer &&
    !effectiveInfluencerId &&
    (ensureCreateMut.isPending ||
      (!ensureCreateMut.isError && !ensureCreateMut.isSuccess));

  return (
    <div className="space-y-6 max-md:pb-[var(--mobile-nav-height)]">
      <div className="space-y-4">
        {data.isNsfw && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            <p className="font-medium">{t("ofSocialBannerTitle")}</p>
            <p className="mt-1 text-xs text-blue-200/80">{t("ofSocialBannerHint")}</p>
          </div>
        )}

        <SocialCard
          icon={<InstagramIcon className="h-5 w-5 text-white" />}
          name="Instagram"
          gradientFrom="from-pink-500"
          gradientTo="to-orange-500"
          enabled={data.instagramEnabled}
          onToggle={(v) => updateData({ instagramEnabled: v })}
          username={data.instagramUsername}
          onUsernameChange={(v) => updateData({ instagramUsername: v })}
          instagramConnect={{
            enabled: data.instagramEnabled,
            username: data.instagramUsername,
            influencerId: effectiveInfluencerId,
            locale,
            isEnsuringInfluencer,
          }}
        />

        <SocialCard
          icon={<TikTokIcon className="h-5 w-5 text-white" />}
          name="TikTok"
          gradientFrom="from-gray-900"
          gradientTo="to-gray-700"
          enabled={data.tiktokEnabled}
          onToggle={(v) => updateData({ tiktokEnabled: v })}
          username={data.tiktokUsername}
          onUsernameChange={(v) => updateData({ tiktokUsername: v })}
        />

        {showOnlyFans && (
          <SocialCard
            icon={<OnlyFansIcon className="h-5 w-5 text-white" />}
            name="OnlyFans"
            gradientFrom="from-blue-500"
            gradientTo="to-blue-400"
            enabled={data.onlyfansEnabled}
            onToggle={(v) => updateData({ onlyfansEnabled: v })}
            username={data.onlyfansUsername}
            onUsernameChange={(v) => updateData({ onlyfansUsername: v })}
            hideConnect
            note={t("onlyfansManualNote")}
          />
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/80" />
        <p className="text-xs text-slate-400">{t("socialOptionalHint")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onPrev}
          className={wizardSecondaryButtonClass}
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={onNext}
          className={wizardPrimaryButtonClass}
        >
          {data.instagramEnabled || data.tiktokEnabled || data.onlyfansEnabled
            ? `${t("next")} →`
            : `${t("socialSkipToFinalize")} →`}
        </button>
      </div>
    </div>
  );
}
