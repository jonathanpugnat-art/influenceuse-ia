"use client";

import { useMemo } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { PhotoPublishFlowState } from "@/hooks/photo-studio";

/**
 * TikTok composer section — audit-compliant Content Posting API UX.
 *
 * This component implements the UX items TikTok's Content Posting API audit
 * mandates (see https://developers.tiktok.com/doc/content-sharing-guidelines):
 *
 *   • Creator header: nickname + avatar + "Posting to @…" so the user always
 *     knows which account the post will go to.
 *   • Posting-cap / disabled-account warnings sourced from creator_info.
 *   • Privacy dropdown driven by creator_info.privacy_level_options with
 *     NO default value — the Publish button stays disabled until the user
 *     explicitly picks one. (SELF_ONLY is kept as the only option until
 *     TIKTOK_AUDIT_APPROVED is flipped on.)
 *   • Allow Comment / Duet / Stitch checkboxes, all unchecked by default
 *     (meaning interactions are ON), greyed and locked off when creator_info
 *     reports them disabled at the account level. Duet / Stitch rows are
 *     hidden for photo posts (TikTok V1 restricts us to REEL anyway).
 *   • Commercial content disclosure toggle (OFF by default) → Your brand
 *     ("Promotional content" label) or Branded content ("Paid partnership"
 *     label). Publish is blocked until a choice is ticked when the toggle
 *     is ON. Branded content cannot be SELF_ONLY per TikTok's guideline.
 *   • Consent text above Publish: "By posting, you agree to TikTok's Music
 *     Usage Confirmation", switching to also include the "Branded Content
 *     Policy" link when branded content is selected.
 *   • Max video duration guard versus creator_info.max_video_post_duration_sec.
 *
 * The flow state owns the actual values so the publish mutation can send
 * exactly what the user confirmed. The server re-validates every rule.
 */
export function PhotoPublishTiktokSection({
  flow,
}: {
  flow: PhotoPublishFlowState;
}) {
  const t = useTranslations("content");
  const {
    params,
    platforms,
    tiktokPrivacyLevel,
    setTiktokPrivacyLevel,
    tiktokAllowComment,
    setTiktokAllowComment,
    tiktokAllowDuet,
    setTiktokAllowDuet,
    tiktokAllowStitch,
    setTiktokAllowStitch,
    tiktokCommercialDisclosure,
    setTiktokCommercialDisclosure,
    tiktokCommercialKind,
    setTiktokCommercialKind,
    contentKind,
  } = flow;

  const tiktokSelected = platforms.includes("TIKTOK");

  const creatorInfoQuery = trpc.publish.getTiktokCreatorInfo.useQuery(
    { influencerId: params.influencerId ?? "" },
    {
      enabled: Boolean(params.influencerId) && tiktokSelected,
      staleTime: 60_000,
    }
  );

  const info = creatorInfoQuery.data;
  const auditApproved = info?.auditApproved ?? false;
  const connected = info?.connected ?? false;
  const privacyOptions = useMemo(
    () => (info?.privacyLevelOptions ?? ["SELF_ONLY"]) as readonly string[],
    [info?.privacyLevelOptions]
  );
  const commentDisabled = info?.commentDisabled ?? false;
  const duetDisabled = info?.duetDisabled ?? false;
  const stitchDisabled = info?.stitchDisabled ?? false;
  const isReel = contentKind === "REEL";

  // Interaction toggles are hidden on photo posts (TikTok disallows duet /
  // stitch on image carousels; we only publish REELS to TikTok today, but
  // keep the guard so a future photo-to-TikTok path cannot regress the UX).
  const showDuet = isReel;
  const showStitch = isReel;

  if (!tiktokSelected) return null;

  // While the account is not connected we show a single row driving the
  // user to the Social Accounts page — Publish is already gated elsewhere.
  if (!connected && !creatorInfoQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-amber-100">
              {t("publishTiktokNotConnectedTitle")}
            </p>
            <p className="text-[11px] leading-snug text-amber-200/80">
              {t("publishTiktokNotConnectedHint")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const brandedContentWithPrivate =
    tiktokCommercialDisclosure &&
    tiktokCommercialKind === "BRANDED_CONTENT" &&
    tiktokPrivacyLevel === "SELF_ONLY";

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      {/* Creator header — mandatory for audit: show WHICH account we post to. */}
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 border border-border/60">
          {info?.creatorAvatarUrl ? (
            <AvatarImage src={info.creatorAvatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="text-[10px] uppercase">
            {(info?.creatorUsername ?? info?.creatorNickname ?? "TK")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">
            {t("publishTiktokPostingTo", {
              nickname: info?.creatorNickname ?? "—",
            })}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {info?.creatorUsername
              ? `@${info.creatorUsername}`
              : t("publishTiktokConnected")}
          </p>
        </div>
      </div>

      {/* Sandbox / audit banner — explicit so the user understands privacy is locked. */}
      {!auditApproved && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
          <p className="text-[10px] leading-snug text-amber-200">
            {t("publishTiktokSandboxHint")}
          </p>
        </div>
      )}

      {/* Creator cap warning if max duration is known and absurdly low. */}
      {typeof info?.maxVideoPostDurationSec === "number" && isReel && (
        <p className="rounded-md bg-background/50 px-2 py-1 text-[10px] leading-snug text-muted-foreground/80">
          {t("publishTiktokMaxDurationHint", {
            seconds: info.maxVideoPostDurationSec,
          })}
        </p>
      )}

      {/* Privacy — dropdown with placeholder, NO default. */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("publishTiktokPrivacyLabel")}
        </Label>
        <Select
          value={tiktokPrivacyLevel ?? undefined}
          onValueChange={(v) =>
            setTiktokPrivacyLevel(
              v as
                | "PUBLIC_TO_EVERYONE"
                | "MUTUAL_FOLLOW_FRIENDS"
                | "FOLLOWER_OF_CREATOR"
                | "SELF_ONLY"
            )
          }
        >
          <SelectTrigger size="sm" className="w-full text-xs">
            <SelectValue placeholder={t("publishTiktokPrivacyPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {privacyOptions.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {t(`publishTiktokPrivacy_${opt}` as const)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tiktokPrivacyLevel === null && (
          <p className="text-[10px] text-muted-foreground/80">
            {t("publishTiktokPrivacyRequired")}
          </p>
        )}
      </div>

      {/* Interactions — allow comment / duet / stitch, all OFF (checkbox
          unchecked) by default. Checking the box = we send disable_* = false
          to TikTok, i.e. the interaction is ALLOWED. Greyed when the creator
          disabled the interaction at the account level. */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("publishTiktokInteractionsLabel")}
        </Label>
        <InteractionCheckbox
          id="tt-allow-comment"
          label={t("publishTiktokAllowComment")}
          checked={tiktokAllowComment && !commentDisabled}
          disabled={commentDisabled}
          disabledHint={commentDisabled ? t("publishTiktokLockedByCreator") : undefined}
          onCheckedChange={setTiktokAllowComment}
        />
        {showDuet && (
          <InteractionCheckbox
            id="tt-allow-duet"
            label={t("publishTiktokAllowDuet")}
            checked={tiktokAllowDuet && !duetDisabled}
            disabled={duetDisabled}
            disabledHint={duetDisabled ? t("publishTiktokLockedByCreator") : undefined}
            onCheckedChange={setTiktokAllowDuet}
          />
        )}
        {showStitch && (
          <InteractionCheckbox
            id="tt-allow-stitch"
            label={t("publishTiktokAllowStitch")}
            checked={tiktokAllowStitch && !stitchDisabled}
            disabled={stitchDisabled}
            disabledHint={stitchDisabled ? t("publishTiktokLockedByCreator") : undefined}
            onCheckedChange={setTiktokAllowStitch}
          />
        )}
      </div>

      {/* Commercial content disclosure — OFF by default. When ON, the user
          MUST pick Your brand or Branded content. */}
      <div className="space-y-2 rounded-md border border-border/50 bg-background/40 p-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-0.5">
            <p className="text-xs font-medium text-foreground">
              {t("publishTiktokDisclosureLabel")}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {t("publishTiktokDisclosureHint")}
            </p>
          </div>
          <Switch
            size="sm"
            checked={tiktokCommercialDisclosure}
            onCheckedChange={(v) => {
              setTiktokCommercialDisclosure(v);
              if (!v) setTiktokCommercialKind(null);
            }}
          />
        </div>

        {tiktokCommercialDisclosure && (
          <div className="space-y-1.5 border-t border-border/40 pt-2">
            <DisclosureRadio
              id="tt-your-brand"
              name="tiktok-commercial-kind"
              label={t("publishTiktokYourBrand")}
              description={t("publishTiktokYourBrandLabelHint")}
              checked={tiktokCommercialKind === "YOUR_BRAND"}
              onChange={() => setTiktokCommercialKind("YOUR_BRAND")}
            />
            <DisclosureRadio
              id="tt-branded-content"
              name="tiktok-commercial-kind"
              label={t("publishTiktokBrandedContent")}
              description={t("publishTiktokBrandedContentLabelHint")}
              checked={tiktokCommercialKind === "BRANDED_CONTENT"}
              onChange={() => setTiktokCommercialKind("BRANDED_CONTENT")}
            />
            {tiktokCommercialKind === null && (
              <p className="flex items-center gap-1 text-[10px] text-amber-200">
                <Info className="h-3 w-3" />
                {t("publishTiktokDisclosureRequired")}
              </p>
            )}
            {brandedContentWithPrivate && (
              <p className="flex items-center gap-1 text-[10px] text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {t("publishTiktokBrandedPrivateBlocked")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Consent text above Publish — fixed copy with inline links. */}
      <div className="rounded-md bg-background/30 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
        {tiktokCommercialDisclosure && tiktokCommercialKind === "BRANDED_CONTENT" ? (
          <>
            {t("publishTiktokConsentBranded")}{" "}
            <a
              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              {t("publishTiktokConsentMusicLink")}
            </a>{" "}
            {t("publishTiktokConsentAnd")}{" "}
            <a
              href="https://www.tiktok.com/legal/page/global/bc-policy/en"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              {t("publishTiktokConsentBrandedLink")}
            </a>
            .
          </>
        ) : (
          <>
            {t("publishTiktokConsent")}{" "}
            <a
              href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              {t("publishTiktokConsentMusicLink")}
            </a>
            .
          </>
        )}
      </div>
    </div>
  );
}

function InteractionCheckbox({
  id,
  label,
  checked,
  disabled,
  disabledHint,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  disabledHint?: string;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-2 rounded-md px-1 py-1 text-[11px]",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-background/40"
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <span className="flex-1 leading-snug">
        {label}
        {disabledHint && (
          <span className="ml-1 text-[10px] text-muted-foreground/70">
            — {disabledHint}
          </span>
        )}
      </span>
    </label>
  );
}

function DisclosureRadio({
  id,
  name,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-[11px] hover:bg-background/40",
        checked && "bg-background/40"
      )}
    >
      <input
        type="radio"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-rose-400"
      />
      <span className="flex-1 leading-snug">
        <span className="font-medium text-foreground">{label}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">
          — {description}
        </span>
      </span>
    </label>
  );
}
