"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Camera,
  ChevronDown,
  Target,
  Users,
  Palette,
  Ban,
} from "lucide-react";
import { AgentPanel } from "@/components/shared/agent-panel";
import { useWizardAgentContext } from "@/contexts/wizard-agent-context";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import {
  buildNicheShotIdeas,
  type NicheShotIdea,
} from "@/lib/niche-shot-ideas";
import { isNicheProfileUsable } from "@/lib/niche-profile";
import { cn } from "@/lib/utils";

const NICHE_I18N_KEYS: Record<string, "nicheFashion" | "nicheFitness" | "nicheLifestyle" | "nicheTravel" | "nicheTech" | "nicheGaming" | "nicheAdult" | "nicheFood"> = {
  FASHION: "nicheFashion",
  FITNESS: "nicheFitness",
  LIFESTYLE: "nicheLifestyle",
  TRAVEL: "nicheTravel",
  TECH: "nicheTech",
  GAMING: "nicheGaming",
  ADULT: "nicheAdult",
  FOOD: "nicheFood",
};

export function WizardNicheBrainPanel({ className }: { className?: string }) {
  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  // Optional by default — identity step already has niche + angle.
  const [open, setOpen] = useState(false);
  const { updateData } = useInfluencerWizard();
  const {
    messages,
    sendMessage,
    isLoading,
    quickReplies,
    nicheProfile,
    updateNicheProfile,
    wizardData,
  } = useWizardAgentContext();

  const shotIdeas = useMemo(
    () => buildNicheShotIdeas(nicheProfile),
    [nicheProfile]
  );

  const profileUsable = isNicheProfileUsable(nicheProfile ?? null);
  const selectedShotId = wizardData.pendingNicheShotId;

  const handleSelectShot = (idea: NicheShotIdea) => {
    updateData({ pendingNicheShotId: idea.id, pendingNicheShot: idea });
  };

  const nicheLabel =
    nicheProfile?.nicheCategory &&
    NICHE_I18N_KEYS[nicheProfile.nicheCategory]
      ? tInfluencer(NICHE_I18N_KEYS[nicheProfile.nicheCategory])
      : nicheProfile?.nicheCategory;

  return (
    <aside className={cn("min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Brain className="h-4 w-4 text-muted-foreground" />
            {t("nicheBrainTitleOptional")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t("nicheBrainSubtitleOptional")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
        <AgentPanel
          domain="wizard"
          messages={messages}
          onSend={sendMessage}
          isLoading={isLoading}
          quickReplies={quickReplies}
          emptyTitle={t("agentEmptyTitle")}
          emptyHint={t("agentEmptyHint")}
          inputPlaceholder={t("agentInputPlaceholder")}
          thinkingLabel={t("agentThinking")}
        />

        {profileUsable && nicheProfile ? (
          <NicheProfileCard
            profile={nicheProfile}
            nicheLabel={nicheLabel}
            onUpdate={updateNicheProfile}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background/30 px-3 py-4 text-center text-xs text-muted-foreground">
            {t("nicheProfileEmpty")}
          </p>
        )}

        {shotIdeas.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Camera className="h-3.5 w-3.5" />
              {t("nicheShotIdeasTitle")}
            </p>
            <div className="grid gap-2">
              {shotIdeas.map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => handleSelectShot(idea)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    selectedShotId === idea.id
                      ? "border-rose-400/60 bg-rose-500/10"
                      : "border-border bg-muted/20 hover:border-foreground/30"
                  )}
                >
                  <p className="text-xs font-medium text-foreground">{idea.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {idea.sceneDescription}
                  </p>
                </button>
              ))}
            </div>
            {selectedShotId ? (
              <p className="text-[11px] text-rose-300/90">
                {t("nicheShotSelected")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      ) : null}
    </aside>
  );
}

function NicheProfileCard({
  profile,
  nicheLabel,
  onUpdate,
}: {
  profile: NonNullable<ReturnType<typeof useWizardAgentContext>["nicheProfile"]>;
  nicheLabel?: string;
  onUpdate: (p: typeof profile) => void;
}) {
  const t = useTranslations("wizard");
  const vc = profile.visualCodes;

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          {nicheLabel ?? profile.nicheCategory}
        </span>
        {profile.subNiche.trim() ? (
          <span className="text-xs text-foreground/80">{profile.subNiche}</span>
        ) : null}
      </div>

      {profile.purpose.trim() ? (
        <ProfileRow icon={Target} label={t("nicheProfilePurpose")} value={profile.purpose} />
      ) : null}
      {profile.targetAudience.trim() ? (
        <ProfileRow icon={Users} label={t("nicheProfileAudience")} value={profile.targetAudience} />
      ) : null}
      {profile.tone.trim() ? (
        <ProfileRow icon={Brain} label={t("nicheProfileTone")} value={profile.tone} />
      ) : null}

      {profile.contentPillars.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("nicheProfilePillars")}
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.contentPillars.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] text-foreground/80"
              >
                {pillar}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(vc.settings.length > 0 || vc.wardrobe.length > 0 || vc.lighting) ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Palette className="h-3 w-3" />
            {t("nicheProfileVisuals")}
          </p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {vc.settings.slice(0, 2).map((s) => (
              <li key={s}>• {s}</li>
            ))}
            {vc.wardrobe.slice(0, 2).map((w) => (
              <li key={w}>• {w}</li>
            ))}
            {vc.lighting.trim() ? <li>• {vc.lighting}</li> : null}
          </ul>
        </div>
      ) : null}

      {profile.doNots.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Ban className="h-3 w-3" />
            {t("nicheProfileDoNots")}
          </p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground/80">
            {profile.doNots.slice(0, 3).map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <EditableField
        label={t("nicheProfileEditSubNiche")}
        value={profile.subNiche}
        onChange={(subNiche) => onUpdate({ ...profile, subNiche })}
      />
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-xs leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1 border-t border-border/50 pt-2">
      <label className="text-[10px] font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring/60 focus:outline-none"
      />
    </div>
  );
}
