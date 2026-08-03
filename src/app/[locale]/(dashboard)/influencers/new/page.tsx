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
    const instagramConnected = searchParams.get("instagram");
    if (instagramError) {
      oauthHandledRef.current = true;
      toast.error(formatInstagramOAuthError(instagramError), { duration: 12000 });
      window.history.replaceState({}, "", `/${locale}/influencers/new`);
    } else if (instagramConnected === "connected" || instagramConnected === "instagram") {
      oauthHandledRef.current = true;
      toast.success(t("instagramConnectedToast"));
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
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="h-4 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded-lg bg-muted/60" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("draftResumeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("draftResumeDescription", { step })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                reset();
                setShowDraftDialog(false);
              }}
            >
              {t("draftRestart")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowDraftDialog(false)}>
              {t("draftContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link
        href="/influencers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <WizardGuidedFlow />
    </div>
  );
}
