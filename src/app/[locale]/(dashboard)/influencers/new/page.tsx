"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { WizardGuidedFlow } from "@/components/influencer/wizard-guided-flow";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { isMeaningfulWizardDraft } from "@/lib/wizard-draft";
import { formatInstagramOAuthError } from "@/lib/instagram-oauth-errors";
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
  const { reset, step } = useInfluencerWizard();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const draftCheckedRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (draftCheckedRef.current) return;
      draftCheckedRef.current = true;
      if (isMeaningfulWizardDraft(useInfluencerWizard.getState())) {
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
    if (!hydrationReady || showDraftDialog || oauthHandledRef.current) return;
    const instagramError = searchParams.get("instagram_error");
    if (instagramError) {
      oauthHandledRef.current = true;
      toast.error(formatInstagramOAuthError(instagramError), { duration: 12000 });
      window.history.replaceState({}, "", `/${locale}/influencers/new`);
    }
  }, [hydrationReady, showDraftDialog, locale, searchParams]);

  useEffect(() => {
    if (!hydrationReady || showDraftDialog) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isMeaningfulWizardDraft(useInfluencerWizard.getState())) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hydrationReady, showDraftDialog]);

  if (!hydrationReady) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
              onClick={() => {
                reset();
                setShowDraftDialog(false);
              }}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              {t("draftRestart")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setShowDraftDialog(false)}
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

      <WizardGuidedFlow />
    </div>
  );
}
