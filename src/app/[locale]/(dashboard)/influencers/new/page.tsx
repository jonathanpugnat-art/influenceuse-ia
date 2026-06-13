"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { WizardProgress } from "@/components/influencer/wizard-progress";
import {
  canNavigateToWizardStep,
  getMaxReachableWizardStep,
} from "@/lib/wizard-validation";
import { WizardStepIdentity } from "@/components/influencer/wizard-step-identity";
import { WizardStepAppearance } from "@/components/influencer/wizard-step-appearance";
import { WizardStepSocial } from "@/components/influencer/wizard-step-social";
import { WizardStepSummary } from "@/components/influencer/wizard-step-summary";
import { WizardEntryChoice } from "@/components/influencer/wizard-entry-choice";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { formatInstagramOAuthError } from "@/lib/instagram-oauth-errors";
import { isMeaningfulWizardDraft } from "@/lib/wizard-draft";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function NewInfluencerPage() {
  const t = useTranslations("wizard");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const oauthHandledRef = useRef(false);
  const {
    step,
    setStep,
    nextStep,
    prevStep,
    reset,
    data,
    generatedImages,
    selectedImageIndex,
    createdInfluencerId,
    entryMode,
  } = useInfluencerWizard();
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward"
  );
  const [hydrationReady, setHydrationReady] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const draftCheckedRef = useRef(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const maxReachableStep = getMaxReachableWizardStep(
    data,
    generatedImages,
    selectedImageIndex
  );

  useEffect(() => {
    const finish = () => {
      if (draftCheckedRef.current) return;
      draftCheckedRef.current = true;

      const state = useInfluencerWizard.getState();
      if (isMeaningfulWizardDraft(state)) {
        setShowDraftDialog(true);
      }
      setHydrationReady(true);
    };

    if (useInfluencerWizard.persist.hasHydrated()) {
      finish();
      return;
    }

    const unsub = useInfluencerWizard.persist.onFinishHydration(finish);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrationReady || showDraftDialog) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useInfluencerWizard.getState();
      if (!isMeaningfulWizardDraft(state)) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hydrationReady, showDraftDialog]);

  useEffect(() => {
    if (!hydrationReady || showDraftDialog || oauthHandledRef.current) return;

    const connected = searchParams.get("connected");
    const instagramError = searchParams.get("instagram_error");
    const stepParam = searchParams.get("step");

    if (connected === "instagram") {
      oauthHandledRef.current = true;
      toast.success(t("instagramConnectedToast"));
      setStep(3);
      window.history.replaceState({}, "", `/${locale}/influencers/new?step=3`);
      return;
    }

    if (instagramError) {
      oauthHandledRef.current = true;
      toast.error(formatInstagramOAuthError(instagramError), { duration: 12000 });
      setStep(3);
      window.history.replaceState({}, "", `/${locale}/influencers/new?step=3`);
      return;
    }

    if (stepParam === "3") {
      setStep(3);
    }
  }, [hydrationReady, showDraftDialog, locale, searchParams, setStep, t]);

  const goNext = () => {
    setSlideDirection("forward");
    nextStep();
  };

  const goPrev = () => {
    setSlideDirection("backward");
    prevStep();
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    if (
      !canNavigateToWizardStep(
        target,
        data,
        generatedImages,
        selectedImageIndex
      )
    ) {
      if (target >= 2) {
        toast.info(t("progressBlockedAppearance"));
      } else {
        toast.info(t("progressBlockedIdentity"));
      }
      return;
    }
    setSlideDirection(target > step ? "forward" : "backward");
    setStep(target);
  };

  useEffect(() => {
    if (!hydrationReady || showDraftDialog) return;
    stepHeadingRef.current?.focus();
  }, [step, hydrationReady, showDraftDialog]);

  const handleResumeDraft = () => {
    setShowDraftDialog(false);
  };

  const handleRestartDraft = () => {
    reset();
    setShowDraftDialog(false);
  };

  const slideVariants = {
    enter: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? 60 : -60,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? -60 : 60,
      opacity: 0,
    }),
  };

  const stepMeta: Record<number, { title: string; subtitle: string }> = {
    1: { title: t("step1Title"), subtitle: t("step1Subtitle") },
    2: { title: t("step2Title"), subtitle: t("step2Subtitle") },
    3: { title: t("step3Title"), subtitle: t("step3Subtitle") },
    4: { title: t("step4Title"), subtitle: t("step4Subtitle") },
  };

  const info = stepMeta[step] ?? stepMeta[1];

  if (!hydrationReady) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 pb-16 md:pb-0">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-800/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16 md:pb-0">
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent className="border-slate-800 bg-slate-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("draftResumeTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {t("draftResumeDescription", { step })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleRestartDraft}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              {t("draftRestart")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResumeDraft}
              className="bg-violet-600 hover:bg-violet-500"
            >
              {t("draftContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link
        href="/influencers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("pageSubtitle")}</p>
      </div>

      {step === 1 && entryMode === "unset" ? (
        <WizardEntryChoice
          onStarted={() => setSlideDirection("forward")}
        />
      ) : (
        <>
          <WizardProgress
            currentStep={step}
            maxReachableStep={maxReachableStep}
            onStepClick={goToStep}
          />

          <div className="text-center">
            <h2
              ref={stepHeadingRef}
              id="wizard-step-heading"
              tabIndex={-1}
              className="text-lg font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded"
            >
              {info.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{info.subtitle}</p>
          </div>

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={step}
                custom={slideDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  type: "spring" as const,
                  bounce: 0.1,
                  duration: 0.4,
                }}
              >
                {step === 1 && <WizardStepIdentity onNext={goNext} />}
                {step === 2 && (
                  <WizardStepAppearance onNext={goNext} onPrev={goPrev} />
                )}
                {step === 3 && (
                  <WizardStepSocial
                    onNext={goNext}
                    onPrev={goPrev}
                    influencerId={createdInfluencerId}
                    locale={locale}
                  />
                )}
                {step === 4 && <WizardStepSummary onPrev={goPrev} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
