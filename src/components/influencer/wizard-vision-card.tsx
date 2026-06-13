"use client";

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { cn } from "@/lib/utils";

/**
 * "Ta vision" — surfaces the creative-director brief the wizard agent builds
 * during step 1. The brief drives every downstream agent (calendar, photo),
 * so making it visible + editable turns the conversation into a tangible
 * artefact instead of silently filling form fields.
 */
export function WizardVisionCard() {
  const t = useTranslations("wizard");
  const { data, updateData } = useInfluencerWizard();
  const brief = data.brief?.trim() ?? "";

  const [draft, setDraft] = useState(brief);
  const [validated, setValidated] = useState(false);
  const [syncedBrief, setSyncedBrief] = useState(brief);

  // Sync local draft when the agent pushes a new brief into the store.
  if (brief !== syncedBrief) {
    setSyncedBrief(brief);
    setDraft(brief);
    setValidated(false);
  }

  if (!brief) return null;

  const dirty = draft.trim() !== brief;

  const handleValidate = () => {
    const next = draft.trim();
    if (next) updateData({ brief: next });
    setValidated(true);
  };

  return (
    <div
      className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-slate-900/60 to-slate-900/40 p-4"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-300" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
          {t("visionTitle")}
        </p>
      </div>

      <p className="mb-3 text-xs text-slate-400">{t("visionHint")}</p>

      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setValidated(false);
        }}
        rows={4}
        maxLength={1000}
        className="resize-none border-slate-800/60 bg-slate-900/50 text-sm leading-relaxed text-slate-200 focus:border-violet-500"
      />

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleValidate}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            validated && !dirty
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
          )}
        >
          {validated && !dirty ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {t("visionValidated")}
            </>
          ) : (
            t("visionValidate")
          )}
        </button>
      </div>
    </div>
  );
}
