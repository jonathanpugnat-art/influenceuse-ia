"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;
const TIMEOUT_MS = 120_000;

type WizardIdentityPackWaitProps = {
  influencerId: string;
  influencerName: string;
  portraitUrl: string | null;
  onComplete: () => void;
};

export function WizardIdentityPackWait({
  influencerId,
  influencerName,
  portraitUrl,
  onComplete,
}: WizardIdentityPackWaitProps) {
  const t = useTranslations("wizard");
  const utils = trpc.useUtils();
  const completedRef = useRef(false);
  const timeoutHandledRef = useRef(false);

  const statusQuery = trpc.influencer.getIdentityPackStatus.useQuery(
    { influencerId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "ready" || status === "failed") return false;
        return POLL_MS;
      },
    }
  );

  const regenerateMutation = trpc.influencer.regenerateIdentityPack.useMutation({
    onSuccess: () => {
      void utils.influencer.getIdentityPackStatus.invalidate({ influencerId });
    },
    onError: (err) => toast.error(err.message),
  });

  const status = statusQuery.data?.status ?? "pending";
  const shotsReady = statusQuery.data?.shotsReady ?? 0;
  const isReady = status === "ready";
  const isFailed = status === "failed";
  const anglesActive = !isReady && !isFailed;

  const progressPercent = isReady
    ? 100
    : isFailed
      ? 66
      : status === "generating"
        ? Math.min(90, 33 + Math.round((shotsReady / 4) * 57))
        : 33;

  useEffect(() => {
    if (completedRef.current || !isReady) return;
    completedRef.current = true;
    onComplete();
  }, [isReady, onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (completedRef.current || timeoutHandledRef.current) return;
      timeoutHandledRef.current = true;
      toast.warning(t("identityPackWaitTimeout"));
      completedRef.current = true;
      onComplete();
    }, TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete, t]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center space-y-8 py-8 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">
          {t("identityPackWaitTitle")}
        </h2>
        <p className="text-sm text-slate-400">{influencerName}</p>
      </div>

      {portraitUrl ? (
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500/40 to-pink-500/40 blur-xl" />
          <img
            src={portraitUrl}
            alt=""
            className="relative h-28 w-28 rounded-full object-cover ring-2 ring-violet-500/50"
          />
        </div>
      ) : null}

      <div className="w-full space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <ul className="space-y-3 text-left text-sm">
          <WaitStep done label={t("identityPackWaitStepPortrait")} />
          <WaitStep
            done={isReady}
            active={anglesActive}
            label={t("identityPackWaitStepAngles")}
          />
          <WaitStep done={isReady} label={t("identityPackWaitStepReady")} />
        </ul>
      </div>

      <p className="max-w-sm text-xs leading-relaxed text-slate-400">
        {t("identityPackWaitMessage")}
      </p>

      {isFailed && (
        <div className="w-full space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-2 text-left text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("identityPackWaitFailed")}</span>
          </div>
          <button
            type="button"
            onClick={() => regenerateMutation.mutate({ influencerId })}
            disabled={regenerateMutation.isPending}
            className="w-full rounded-lg bg-red-500/20 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            {regenerateMutation.isPending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("identityPackWaitRetrying")}
              </span>
            ) : (
              t("identityPackWaitRetry")
            )}
          </button>
        </div>
      )}

      {!isFailed && !isReady && (
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      )}
    </div>
  );
}

function WaitStep({
  done,
  active,
  label,
}: {
  done?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      ) : active ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-400" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-slate-600" />
      )}
      <span
        className={cn(
          done ? "text-emerald-200" : active ? "text-white" : "text-slate-500"
        )}
      >
        {label}
      </span>
    </li>
  );
}
