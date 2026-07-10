"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  Eyebrow,
  wizardCardClass,
  wizardSecondaryButtonClass,
  wizardTextareaClass,
} from "@/components/influencer/wizard-ui";
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
    <div className={cn(wizardCardClass, "p-4")} aria-live="polite">
      <Eyebrow>{t("visionTitle")}</Eyebrow>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{t("visionHint")}</p>

      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setValidated(false);
        }}
        rows={4}
        maxLength={1000}
        className={cn(wizardTextareaClass, "mt-3 resize-none text-sm leading-relaxed")}
      />

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleValidate}
          className={cn(
            wizardSecondaryButtonClass,
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs",
            validated && !dirty && "border-violet-400/40 text-violet-200"
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
