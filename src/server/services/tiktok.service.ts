/**
 * TikTok Content Posting API — Direct Post (V1 Aura Social Publish).
 *
 * V1 references:
 * - Direct Post: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 * - Creator info query: https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
 *
 * Contract:
 * - is_aigc: true is HARDCODED on every publish (Aura only posts AI content).
 * - privacy_level MUST come from the values returned by /creator_info/query/.
 *   Un-audited apps typically only get ["SELF_ONLY"]; server-side enforcement
 *   guarantees we never send PUBLIC_TO_EVERYONE until audit is approved.
 * - Rate limit: 6 init/min/token. Callers must respect that.
 *
 * Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_AUDIT_APPROVED (default false).
 */

import axios, { type AxiosError } from "axios";

const API_BASE = "https://open.tiktokapis.com";
const AUTH_BASE = "https://www.tiktok.com";

// Read env lazily so tests that flip TIKTOK_CLIENT_KEY / AUDIT_APPROVED
// between spec files see the fresh value.
function getClientKey(): string | undefined {
  return process.env.TIKTOK_CLIENT_KEY;
}
function getClientSecret(): string | undefined {
  return process.env.TIKTOK_CLIENT_SECRET;
}

// ── Constants ────────────────────────────────────────────────────────────

/** All privacy levels TikTok currently exposes via creator_info. */
export const TIKTOK_PRIVACY_LEVELS = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;

export type TikTokPrivacyLevel = (typeof TIKTOK_PRIVACY_LEVELS)[number];

/**
 * Return true only if the operator has explicitly flipped the flag after
 * Content Posting API audit is approved. Defaults to false → we never send
 * PUBLIC_TO_EVERYONE while unaudited.
 */
export function isTikTokAuditApproved(): boolean {
  return process.env.TIKTOK_AUDIT_APPROVED === "true";
}

// ── Errors ───────────────────────────────────────────────────────────────

export class TikTokApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "TikTokApiError";
  }
}

/**
 * Map raw TikTok error codes to actionable French messages the operator can
 * show to the user. Spam / cap errors are visible failures in V1 — we don't
 * retry them.
 */
function friendlyTikTokMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "spam_risk_too_many_posts":
      return "TikTok signale trop de publications récentes (spam_risk_too_many_posts). Réessaie plus tard.";
    case "spam_risk_user_banned_from_posting":
      return "Ce compte TikTok est temporairement banni de la publication.";
    case "reached_active_user_cap":
    case "unaudited_client_can_only_post_to_private_accounts":
      return "L'app TikTok n'est pas encore auditée : publication limitée aux comptes privés (SELF_ONLY).";
    case "url_ownership_unverified":
      return "Le domaine de la vidéo n'est pas vérifié dans TikTok Developer (URL ownership).";
    case "invalid_privacy_level":
      return "Le niveau de confidentialité demandé n'est pas autorisé pour ce compte.";
    case "access_token_invalid":
    case "access_token_expired":
      return "Token TikTok expiré ou invalide. Reconnectez le compte.";
    case "rate_limit_exceeded":
      return "Limite d'API TikTok atteinte (6 init/min). Réessaie dans une minute.";
    default:
      return fallback;
  }
}

function handleError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
    const status = ax.response?.status;
    const body = ax.response?.data?.error;
    const code = body?.code ?? "unknown";
    const msg = friendlyTikTokMessage(code, body?.message ?? ax.message ?? "TikTok API error");
    if (status === 429 || code === "rate_limit_exceeded") {
      throw new TikTokApiError(msg, "rate_limit_exceeded", 429);
    }
    if (status === 401) {
      throw new TikTokApiError(msg, "access_token_invalid", 401);
    }
    throw new TikTokApiError(msg, code, status);
  }
  throw err;
}

// ── OAuth ────────────────────────────────────────────────────────────────

/**
 * URL d'autorisation OAuth TikTok.
 * Scopes: user.info.basic (UI) + video.publish (direct post).
 * state: à passer au callback (ex: signed influencerId).
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  const clientKey = getClientKey();
  if (!clientKey) throw new TikTokApiError("TIKTOK_CLIENT_KEY non configuré.");
  // V1: only what we need. video.upload is legacy for /inbox; direct post
  // needs video.publish only.
  const scope = "user.info.basic,video.publish";
  const params = new URLSearchParams({
    client_key: clientKey,
    scope,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state ?? "tiktok_connect",
  });
  return `${AUTH_BASE}/v2/auth/authorize/?${params.toString()}`;
}

/**
 * Échange le code contre un access_token + refresh_token.
 * Récupère aussi la liste des scopes accordés pour qu'on la stocke.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
  username?: string;
  scopes: string[];
}> {
  const clientKey = getClientKey();
  const clientSecret = getClientSecret();
  if (!clientKey || !clientSecret) {
    throw new TikTokApiError("TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET requis.");
  }

  const res = await axios
    .post<{
      data?: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
        scope?: string;
      };
      error?: { code: string; message: string };
      // TikTok v2/oauth/token returns flat fields at the root, not under `data`.
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      scope?: string;
    }>(
      `${API_BASE}/v2/oauth/token/`,
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  if (res.error?.code && res.error.code !== "ok") {
    throw new TikTokApiError(res.error.message ?? res.error.code, res.error.code);
  }
  const accessToken = res.data?.access_token ?? res.access_token;
  const refreshToken = res.data?.refresh_token ?? res.refresh_token ?? "";
  const expiresIn = res.data?.expires_in ?? res.expires_in ?? 86_400;
  const openId = res.data?.open_id ?? res.open_id ?? "";
  const scopesStr = res.data?.scope ?? res.scope ?? "";
  if (!accessToken) {
    throw new TikTokApiError("Réponse TikTok invalide: pas d'access_token.");
  }
  const scopes = scopesStr
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const userRes = await axios
    .get<{
      data?: { user?: { display_name?: string; unique_id?: string } };
      error?: { code: string };
    }>(`${API_BASE}/v2/user/info/`, {
      params: { fields: "display_name,unique_id" },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .then((r) => r.data)
    .catch(() => ({ data: {} }));

  const userData = userRes.data && "user" in userRes.data ? userRes.data.user : undefined;
  const username = userData?.unique_id ?? userData?.display_name;

  return {
    accessToken,
    refreshToken,
    expiresAt,
    openId,
    username,
    scopes,
  };
}

/**
 * Refresh a TikTok access token using the refresh_token grant.
 * TikTok refresh tokens are one-time-ish: the response carries a new refresh
 * token that we MUST persist next to the new access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}> {
  const clientKey = getClientKey();
  const clientSecret = getClientSecret();
  if (!clientKey || !clientSecret) {
    throw new TikTokApiError("TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET requis.");
  }
  const res = await axios
    .post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    }>(
      `${API_BASE}/v2/oauth/token/`,
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    .then((r) => r.data)
    .catch(handleError);

  if (res.error) {
    throw new TikTokApiError(res.error_description ?? res.error, res.error);
  }
  if (!res.access_token) {
    throw new TikTokApiError("Réponse TikTok invalide: pas d'access_token.");
  }
  const scopes = (res.scope ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + (res.expires_in ?? 86_400) * 1000),
    scopes,
  };
}

// ── Creator info ─────────────────────────────────────────────────────────

export type TikTokCreatorInfo = {
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
  creatorNickname: string | null;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
};

/**
 * Query the creator's Direct Post options before we init a publish.
 * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
 *
 * TikTok mandates this call — the response's privacy_level_options is the
 * only set of values we're allowed to send in /video/init/. Un-audited apps
 * usually see ["SELF_ONLY"] here.
 */
export async function queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const res = await axios
    .post<{
      data?: {
        privacy_level_options?: string[];
        comment_disabled?: boolean;
        duet_disabled?: boolean;
        stitch_disabled?: boolean;
        max_video_post_duration_sec?: number;
        creator_nickname?: string;
        creator_username?: string;
        creator_avatar_url?: string;
      };
      error?: { code: string; message: string };
    }>(
      `${API_BASE}/v2/post/publish/creator_info/query/`,
      null,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  if (res.error?.code && res.error.code !== "ok") {
    throw new TikTokApiError(
      friendlyTikTokMessage(res.error.code, res.error.message ?? res.error.code),
      res.error.code
    );
  }
  const data = res.data ?? {};
  const options = (data.privacy_level_options ?? []).filter((v): v is TikTokPrivacyLevel =>
    (TIKTOK_PRIVACY_LEVELS as readonly string[]).includes(v)
  );
  return {
    privacyLevelOptions: options.length > 0 ? options : ["SELF_ONLY"],
    commentDisabled: Boolean(data.comment_disabled),
    duetDisabled: Boolean(data.duet_disabled),
    stitchDisabled: Boolean(data.stitch_disabled),
    maxVideoPostDurationSec: data.max_video_post_duration_sec ?? null,
    creatorNickname: data.creator_nickname ?? null,
    creatorUsername: data.creator_username ?? null,
    creatorAvatarUrl: data.creator_avatar_url ?? null,
  };
}

// ── Direct Post ──────────────────────────────────────────────────────────

export type TikTokPublishOptions = {
  /** MUST be one of creator_info.privacy_level_options. Defaults to SELF_ONLY. */
  privacyLevel?: TikTokPrivacyLevel;
  /** Disable comments on the post (default false). */
  disableComment?: boolean;
  /** Disable duet on the post (default false). */
  disableDuet?: boolean;
  /** Disable stitch on the post (default false). */
  disableStitch?: boolean;
  /** Force FILE_UPLOAD path even when the URL domain is verified. */
  forceFileUpload?: boolean;
  /**
   * Optional pre-fetched creator info. Callers that already ran the
   * creator_info query should pass it here to save one round-trip.
   */
  creatorInfo?: TikTokCreatorInfo;
};

export type TikTokPublishResult = {
  publishId: string;
  privacyLevel: TikTokPrivacyLevel;
  source: "PULL_FROM_URL" | "FILE_UPLOAD";
};

/**
 * Publie une vidéo via Direct Post (/v2/post/publish/video/init/).
 *
 * V1 contract:
 * - Toujours `post_mode: DIRECT_POST` (pas d'inbox/brouillon).
 * - Toujours `is_aigc: true` (hardcoded).
 * - `privacy_level` doit être présent dans creator_info.privacy_level_options.
 *   Sans audit, on force SELF_ONLY même si l'appelant demande autre chose.
 * - Tente d'abord PULL_FROM_URL ; bascule sur FILE_UPLOAD si le domaine
 *   n'est pas vérifié (url_ownership_unverified).
 */
export async function publishVideo(
  accessToken: string,
  videoUrl: string,
  caption: string,
  options: TikTokPublishOptions = {}
): Promise<TikTokPublishResult> {
  const creatorInfo = options.creatorInfo ?? (await queryCreatorInfo(accessToken));

  const auditApproved = isTikTokAuditApproved();
  const requested = options.privacyLevel ?? "SELF_ONLY";
  // Server-side lock: while unaudited we NEVER let PUBLIC_TO_EVERYONE
  // through, even if the client asks for it. Belt & suspenders: creator_info
  // will only expose SELF_ONLY for unaudited apps anyway.
  const clampedByAudit: TikTokPrivacyLevel = auditApproved ? requested : "SELF_ONLY";
  // If the requested/clamped level is not among the ones the API allowed for
  // this token, fall back to the safest option TikTok gave us.
  const allowed = new Set(creatorInfo.privacyLevelOptions);
  const privacyLevel: TikTokPrivacyLevel = allowed.has(clampedByAudit)
    ? clampedByAudit
    : (creatorInfo.privacyLevelOptions[0] ?? "SELF_ONLY");

  const postInfo = {
    title: caption.slice(0, 2200),
    privacy_level: privacyLevel,
    disable_comment: Boolean(options.disableComment),
    disable_duet: Boolean(options.disableDuet),
    disable_stitch: Boolean(options.disableStitch),
    is_aigc: true,
  };

  if (!options.forceFileUpload) {
    try {
      const initRes = await axios
        .post<{
          data?: { publish_id?: string };
          error?: { code: string; message: string };
        }>(
          `${API_BASE}/v2/post/publish/video/init/`,
          {
            post_info: postInfo,
            source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json; charset=UTF-8",
            },
          }
        )
        .then((r) => r.data);

      if (initRes.error?.code && initRes.error.code !== "ok") {
        // Fall back to FILE_UPLOAD if the URL domain isn't verified. Every
        // other error is surfaced verbatim (spam risk, banned, invalid privacy
        // level, etc.) and NOT retried.
        if (initRes.error.code === "url_ownership_unverified") {
          return uploadViaFile(accessToken, videoUrl, postInfo, privacyLevel);
        }
        throw new TikTokApiError(
          friendlyTikTokMessage(initRes.error.code, initRes.error.message ?? initRes.error.code),
          initRes.error.code
        );
      }
      const publishId = initRes.data?.publish_id ?? "";
      if (!publishId) {
        throw new TikTokApiError("Réponse TikTok invalide: publish_id manquant.");
      }
      return { publishId, privacyLevel, source: "PULL_FROM_URL" };
    } catch (err) {
      const isUnverified =
        axios.isAxiosError(err) &&
        err.response?.data?.error?.code === "url_ownership_unverified";
      if (!isUnverified) {
        // If it's an axios error we still want the friendly mapping.
        if (axios.isAxiosError(err)) handleError(err);
        throw err;
      }
      // else fall through to FILE_UPLOAD.
    }
  }

  return uploadViaFile(accessToken, videoUrl, postInfo, privacyLevel);
}

async function uploadViaFile(
  accessToken: string,
  videoUrl: string,
  postInfo: Record<string, unknown>,
  privacyLevel: TikTokPrivacyLevel
): Promise<TikTokPublishResult> {
  const videoBuffer = await axios
    .get(videoUrl, { responseType: "arraybuffer", timeout: 120_000 })
    .then((r) => Buffer.from(r.data));
  const size = videoBuffer.length;
  const chunkSize = Math.min(size, 5 * 1024 * 1024);
  const totalChunks = Math.ceil(size / chunkSize);

  const initUpload = await axios
    .post<{
      data?: { publish_id?: string; upload_url?: string };
      error?: { code: string; message: string };
    }>(
      `${API_BASE}/v2/post/publish/video/init/`,
      {
        post_info: postInfo,
        source_info: {
          source: "FILE_UPLOAD",
          video_size: size,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  if (initUpload.error?.code && initUpload.error.code !== "ok") {
    throw new TikTokApiError(
      friendlyTikTokMessage(
        initUpload.error.code,
        initUpload.error.message ?? initUpload.error.code
      ),
      initUpload.error.code
    );
  }
  const uploadUrl = initUpload.data?.upload_url;
  const publishId = initUpload.data?.publish_id ?? "";
  if (!publishId) {
    throw new TikTokApiError("Réponse TikTok invalide: publish_id manquant.");
  }
  if (uploadUrl) {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, size);
      const chunk = videoBuffer.subarray(start, end);
      await axios.put(uploadUrl, chunk, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end - 1}/${size}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    }
  }
  return { publishId, privacyLevel, source: "FILE_UPLOAD" };
}

/**
 * Query the publish status of a Direct Post publish_id.
 * Useful for surfacing 'PROCESSING_UPLOAD' vs 'PUBLISH_COMPLETE'.
 * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-get-post-status
 */
export async function fetchPublishStatus(
  accessToken: string,
  publishId: string
): Promise<{
  status: string;
  postId?: string;
  failReason?: string;
}> {
  const res = await axios
    .post<{
      data?: {
        status?: string;
        publicaly_available_post_id?: string[];
        fail_reason?: string;
      };
      error?: { code: string; message: string };
    }>(
      `${API_BASE}/v2/post/publish/status/fetch/`,
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  if (res.error?.code && res.error.code !== "ok") {
    throw new TikTokApiError(
      friendlyTikTokMessage(res.error.code, res.error.message ?? res.error.code),
      res.error.code
    );
  }
  return {
    status: res.data?.status ?? "UNKNOWN",
    postId: res.data?.publicaly_available_post_id?.[0],
    failReason: res.data?.fail_reason,
  };
}

/**
 * Récupère les infos / stats d'une vidéo (si l'API le permet).
 * TikTok Post Info API : POST avec post_id_list.
 */
export async function getVideoInfo(
  accessToken: string,
  videoId: string
): Promise<Record<string, unknown>> {
  const res = await axios
    .post<{ data?: Record<string, unknown>; error?: { code: string } }>(
      `${API_BASE}/v2/post/info/`,
      { post_id_list: [videoId] },
      {
        params: { fields: "id,title,create_time,cover_url,share_url,like_count,comment_count,view_count" },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  return (res.data as Record<string, unknown>) ?? {};
}
