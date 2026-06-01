"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { useTranslations } from "next-intl";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 backdrop-blur-xl transition-all",
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
                  Nom d&apos;utilisateur
                </Label>
                <Input
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder={`@${name.toLowerCase().replace(" ", "")}`}
                  className="h-9 border-slate-800/50 bg-slate-800/30 text-white placeholder:text-slate-600"
                />
              </div>

              {!hideConnect && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg border border-slate-700 py-2 text-xs text-slate-500"
                    >
                      Connecter le compte
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Bientôt disponible
                  </TooltipContent>
                </Tooltip>
              )}

              {note && (
                <p className="text-xs italic text-slate-500">{note}</p>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                Non connecté
              </div>
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
}: {
  onNext: () => void;
  onPrev: () => void;
}) {
  const t = useTranslations("wizard");
  const { data, updateData } = useInfluencerWizard();
  const { data: plan } = trpc.billing.getCurrentPlan.useQuery();
  const allowNsfw = plan?.features.hasNsfw ?? false;
  const showOnlyFans = allowNsfw && data.isNsfw;

  const handleNext = () => {
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Instagram */}
        <SocialCard
          icon={<InstagramIcon className="h-5 w-5 text-white" />}
          name="Instagram"
          gradientFrom="from-pink-500"
          gradientTo="to-orange-500"
          enabled={data.instagramEnabled}
          onToggle={(v) => updateData({ instagramEnabled: v })}
          username={data.instagramUsername}
          onUsernameChange={(v) => updateData({ instagramUsername: v })}
        />

        {/* TikTok */}
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

      {/* Note */}
      <div className="flex items-start gap-2 rounded-xl bg-slate-800/30 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-500">{t("connectLater")}</p>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          ← {t("back")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {t("socialSkip")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("next")} →
          </button>
        </div>
      </div>
    </div>
  );
}

