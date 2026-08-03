"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PROPORTION_LABELS,
  WIZARD_BODY_TYPES_V2,
  WIZARD_HEIGHTS,
  WIZARD_MAKEUP_LEVELS,
  WIZARD_SKIN_TONES,
  WIZARD_TATTOO_OPTIONS,
  type AppearanceV2PanelFields,
  type ProportionLabelKey,
} from "@/lib/appearance-v2";
import { cn } from "@/lib/utils";

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
        selected
          ? "border-violet-500 bg-violet-500/20 text-violet-300"
          : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600"
      )}
    >
      {label}
    </button>
  );
}

type Props = {
  data: AppearanceV2PanelFields;
  onChange: (partial: Partial<AppearanceV2PanelFields>) => void;
  /** OF flow — keep extended body generation on. */
  forceExtendedBody?: boolean;
};

export function WizardAppearanceV2Panel({ data, onChange, forceExtendedBody }: Props) {
  const t = useTranslations("wizard");

  const toggleTattoo = (option: string) => {
    const current = data.tattoos ?? [];
    if (option === "Aucun") {
      onChange({ tattoos: [] });
      return;
    }
    const next = current.includes(option)
      ? current.filter((x) => x !== option)
      : [...current.filter((x) => x !== "Aucun"), option];
    onChange({ tattoos: next });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-slate-300">{t("skinTone")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_SKIN_TONES.map((tone) => (
            <Chip
              key={tone}
              label={t(`skinToneOptions.${tone}`)}
              selected={data.skinTone === tone}
              onClick={() => onChange({ skinTone: tone })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">{t("height")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_HEIGHTS.map((h) => (
            <Chip
              key={h}
              label={t(`heightOptions.${h}`)}
              selected={data.height === h}
              onClick={() => onChange({ height: h })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-800/20 p-3">
        <Label className="text-slate-300">{t("proportions")}</Label>
        {(["bust", "hips", "shoulders"] as const).map((axis) => {
          const value =
            axis === "bust"
              ? data.bustLevel
              : axis === "hips"
                ? data.hipsLevel
                : data.shouldersLevel;
          const labels = PROPORTION_LABELS[axis];
          return (
            <div key={axis} className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{t(`proportionAxis.${axis}`)}</span>
                <span>{labels[String(value) as ProportionLabelKey]}</span>
              </div>
              <Slider
                min={-3}
                max={3}
                step={1}
                value={[value]}
                onValueChange={([v]) => {
                  if (axis === "bust") onChange({ bustLevel: v });
                  if (axis === "hips") onChange({ hipsLevel: v });
                  if (axis === "shoulders") onChange({ shouldersLevel: v });
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">{t("bodyType")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_BODY_TYPES_V2.map((b) => (
            <Chip
              key={b}
              label={t(`bodyTypeOptions.${b}`)}
              selected={data.bodyType === b}
              onClick={() =>
                onChange({
                  bodyType: b,
                  bodyGenerationMode:
                    b === "Plus-size" ? "extended" : data.bodyGenerationMode,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">{t("morphologyNotes")}</Label>
        <Textarea
          value={data.morphologyNotes ?? ""}
          onChange={(e) => onChange({ morphologyNotes: e.target.value })}
          placeholder={t("morphologyNotesPlaceholder")}
          maxLength={400}
          rows={2}
          className="min-h-[64px] resize-none border-slate-700 bg-slate-800/30 text-sm text-slate-200 placeholder:text-slate-600"
        />
        <p className="text-[11px] text-slate-500">{t("morphologyNotesHint")}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">{t("makeupLevel")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_MAKEUP_LEVELS.map((m) => (
            <Chip
              key={m}
              label={t(`makeupOptions.${m}`)}
              selected={data.makeupLevel === m}
              onClick={() => onChange({ makeupLevel: m })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">{t("tattoos")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_TATTOO_OPTIONS.map((tat) => (
            <Chip
              key={tat}
              label={t(`tattooOptions.${tat}`)}
              selected={
                tat === "Aucun"
                  ? !(data.tattoos?.length ?? 0)
                  : (data.tattoos ?? []).includes(tat)
              }
              onClick={() => toggleTattoo(tat)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <div>
          <Label className="text-xs text-amber-200/90">{t("extendedBodyLabel")}</Label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {forceExtendedBody ? t("ofExtendedBodyHint") : t("extendedBodyHint")}
          </p>
        </div>
        <Switch
          checked={forceExtendedBody || data.bodyGenerationMode === "extended"}
          disabled={forceExtendedBody}
          onCheckedChange={(v) =>
            onChange({ bodyGenerationMode: v ? "extended" : "standard" })
          }
        />
      </div>
    </div>
  );
}
