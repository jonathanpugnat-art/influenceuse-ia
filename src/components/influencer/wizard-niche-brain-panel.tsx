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
  const [mobileOpen, setMobileOpen] = useState(true);
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
      {/* Mobile collapsible header */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left lg:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Brain className="h-4 w-4 text-slate-400" />
          {t("nicheBrainTitle")}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform",
            mobileOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4",
          !mobileOpen && "hidden lg:block"
        )}
      >
        <div className="hidden lg:block">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-medium text-white">
              {t("nicheBrainTitle")}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {t("nicheBrainSubtitle")}
          </p>
        </div>

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
          <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-3 py-4 text-center text-xs text-slate-500">
            {t("nicheProfileEmpty")}
          </p>
        )}

        {shotIdeas.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-violet-300/80">
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
                      ? "border-violet-500 bg-violet-500/15"
                      : "border-slate-700/80 bg-slate-800/30 hover:border-violet-500/50 hover:bg-violet-500/5"
                  )}
                >
                  <p className="text-xs font-medium text-white">{idea.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                    {idea.sceneDescription}
                  </p>
                </button>
              ))}
            </div>
            {selectedShotId ? (
              <p className="text-[11px] text-violet-300/90">
                {t("nicheShotSelected")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
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
    <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
          {nicheLabel ?? profile.nicheCategory}
        </span>
        {profile.subNiche.trim() ? (
          <span className="text-xs text-slate-300">{profile.subNiche}</span>
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
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t("nicheProfilePillars")}
          </p>
          <div className="flex flex-wrap gap-1">
            {profile.contentPillars.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full border border-slate-600/60 bg-slate-900/50 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {pillar}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(vc.settings.length > 0 || vc.wardrobe.length > 0 || vc.lighting) ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Palette className="h-3 w-3" />
            {t("nicheProfileVisuals")}
          </p>
          <ul className="space-y-0.5 text-[11px] text-slate-400">
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
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Ban className="h-3 w-3" />
            {t("nicheProfileDoNots")}
          </p>
          <ul className="space-y-0.5 text-[11px] text-slate-500">
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
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-xs leading-relaxed text-slate-300">{value}</p>
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
    <div className="space-y-1 border-t border-slate-700/50 pt-2">
      <label className="text-[10px] font-medium text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  );
}
