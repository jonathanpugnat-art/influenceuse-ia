"use client";

import { useMemo } from "react";
import { ArrowLeft, Rocket } from "lucide-react";
import { WizardCollisionBanner } from "@/components/influencer/wizard-collision-banner";
import { WizardIdentityPackWait } from "@/components/influencer/wizard-identity-pack-wait";
import { useTranslations } from "next-intl";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { deriveSocialUsername, isOfPrimaryWizard } from "@/lib/wizard-of-flow";
import { nicheConfig } from "@/lib/influencer-utils";
import { cn } from "@/lib/utils";
import {
  wizardPrimaryButtonClass,
  wizardSecondaryButtonClass,
} from "@/components/influencer/wizard-ui";
import { useWizardCreateFlow } from "./use-wizard-create-flow";
import { WizardInstagramProfileMockup } from "./wizard-instagram-profile-mockup";
import { WizardOfProfileMockup } from "./wizard-of-profile-mockup";
import { WizardSummaryPlatformPill } from "./wizard-summary-ui";

export function WizardStepSummary({ onPrev }: { onPrev: () => void }) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const { setStep } = useInfluencerWizard();

  const {
    data,
    generatedImages,
    selectedImageIndex,
    selectedImageUrl,
    identityPackWait,
    finishWizardAndRedirect,
    handleCreate,
    isCreating,
  } = useWizardCreateFlow();

  const niche = nicheConfig[data.niche] ?? {
    label: data.niche,
    text: "text-slate-400",
    bg: "bg-slate-800",
  };

  const isOfFlow = isOfPrimaryWizard(data);

  const fakeStats = useMemo(() => {
    const seed = (data.name || "x")
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const followers = 1500 + (seed * 137) % 23500;
    const following = 200 + (seed * 31) % 600;
    const posts = 9;
    return { followers, following, posts };
  }, [data.name]);

  const handle = useMemo(() => {
    if (data.instagramUsername?.trim()) {
      return data.instagramUsername.replace(/^@/, "");
    }
    const slug = (data.name || "your_handle")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_.]/g, "");
    return slug || "your_handle";
  }, [data.name, data.instagramUsername]);

  const ofHandle = useMemo(() => {
    if (data.onlyfansUsername?.trim()) {
      return data.onlyfansUsername.replace(/^@/, "");
    }
    return deriveSocialUsername(data.name);
  }, [data.name, data.onlyfansUsername]);

  const ofStats = useMemo(() => {
    const seed = (data.name || "x")
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return {
      photos: 8 + (seed % 20),
      videos: 1 + (seed % 5),
      likes: 1200 + ((seed * 89) % 48000),
    };
  }, [data.name]);

  if (identityPackWait) {
    return (
      <WizardIdentityPackWait
        influencerId={identityPackWait.id}
        influencerName={identityPackWait.name}
        portraitUrl={identityPackWait.portraitUrl}
        onComplete={() =>
          finishWizardAndRedirect(
            identityPackWait.id,
            identityPackWait.name,
            data.isNsfw
          )
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-md:pb-[var(--mobile-nav-height)]">
      {isOfFlow ? (
        <WizardOfProfileMockup
          name={data.name}
          bio={data.bio}
          brief={data.brief}
          niche={niche}
          handle={ofHandle}
          portraitUrl={selectedImageUrl}
          stats={ofStats}
        />
      ) : (
        <WizardInstagramProfileMockup
          name={data.name}
          bio={data.bio}
          niche={niche}
          handle={handle}
          portraitUrl={selectedImageUrl}
          generatedImages={generatedImages}
          selectedImageIndex={selectedImageIndex}
          stats={fakeStats}
        />
      )}

      {isOfFlow && (
        <p className="mx-auto max-w-md text-center text-xs text-blue-200/70">
          {t("ofSummaryHint")}
        </p>
      )}

      <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2">
        {data.instagramEnabled && (
          <WizardSummaryPlatformPill
            icon={<InstagramIcon className="h-3.5 w-3.5 text-pink-400" />}
            label={data.instagramUsername || tInfluencer("instagram")}
          />
        )}
        {data.tiktokEnabled && (
          <WizardSummaryPlatformPill
            icon={<TikTokIcon className="h-3.5 w-3.5 text-white" />}
            label={data.tiktokUsername || tInfluencer("tiktok")}
          />
        )}
        {data.onlyfansEnabled && (
          <WizardSummaryPlatformPill
            icon={<OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />}
            label={data.onlyfansUsername || tInfluencer("onlyfans")}
          />
        )}
        {!data.instagramEnabled &&
          !data.tiktokEnabled &&
          !data.onlyfansEnabled && (
            <p className="text-xs italic text-slate-500">{t("noSocialYet")}</p>
          )}
      </div>

      {data.personality && (
        <details className="mx-auto max-w-md rounded-xl border border-slate-800/50 bg-slate-900/50 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("personality")}
          </summary>
          <p className="mt-2 leading-relaxed">{data.personality}</p>
        </details>
      )}

      <WizardCollisionBanner
        fingerprint={data.appearanceFingerprint}
        onReroll={() => setStep(2)}
      />

      <div className="mx-auto max-w-md space-y-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className={cn(
            wizardPrimaryButtonClass,
            "w-full justify-center px-8 py-4 text-base"
          )}
        >
          {isCreating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("creating")}
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              {t("createMyInfluencer")}
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-500">
          {isOfFlow ? t("ofEditLaterHint") : t("editLaterHint")}
        </p>
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={onPrev}
          className={wizardSecondaryButtonClass}
        >
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </button>
      </div>
    </div>
  );
}
