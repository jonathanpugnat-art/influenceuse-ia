/**
 * Instagram Graph API — OAuth, publication (photo, carousel, reel), insights.
 *
 * OAuth modes (INSTAGRAM_OAUTH_MODE):
 * - instagram (default) — Instagram Login, pas de Page Facebook obligatoire
 * - facebook — Facebook Login for Business + config_id ou scopes classiques
 *
 * Env: INSTAGRAM_LOGIN_APP_ID/SECRET ou INSTAGRAM_APP_ID/SECRET, NEXT_PUBLIC_APP_URL
 */

import axios, { type AxiosError } from "axios";
import {
  getFacebookLoginAppId,
  getFacebookLoginAppSecret,
  getInstagramLoginAppId,
  getInstagramLoginAppSecret,
  getInstagramOAuthProvider,
  INSTAGRAM_LOGIN_SCOPES,
  usesInstagramDirectLogin,
  type InstagramOAuthProvider,
} from "@/lib/instagram-oauth-config";

const BASE = "https://graph.instagram.com";
const FB_BASE = "https://graph.facebook.com";
const IG_OAUTH_BASE = "https://api.instagram.com";
const API_VERSION = "v21.0";

export type InstagramExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  igUserId: string;
  username?: string;
  oauthProvider: InstagramOAuthProvider;
};

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public subcode?: number
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

function handleError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{
      error?: { message?: string; code?: number; error_subcode?: number };
      error_message?: string;
      error_type?: string;
    }>;
    const status = ax.response?.status;
    const body = ax.response?.data?.error;
    const msg =
      body?.message ??
      ax.response?.data?.error_message ??
      ax.message ??
      "Instagram API error";
    if (status === 429) {
      throw new InstagramApiError("Rate limit dépassé. Réessayez plus tard.", "RATE_LIMIT", 429);
    }
    if (status === 401) {
      throw new InstagramApiError("Token expiré ou invalide. Reconnectez le compte.", "TOKEN_EXPIRED", 401);
    }
    throw new InstagramApiError(msg, String(body?.code ?? status), status, body?.error_subcode);
  }
  throw err;
}

/** Nettoie le code OAuth (Meta ajoute parfois #_ en fin d’URL). */
export function normalizeOAuthCode(code: string): string {
  return code.replace(/#_.*$/, "").trim();
}

export function getAuthUrl(redirectUri: string, state?: string): string {
  assertInstagramOAuthReady();
  return usesInstagramDirectLogin()
    ? buildInstagramLoginAuthUrl(redirectUri, state)
    : buildFacebookLoginAuthUrl(redirectUri, state);
}

function buildInstagramLoginAuthUrl(redirectUri: string, state?: string): string {
  const appId = getInstagramLoginAppId();
  if (!appId) {
    throw new InstagramApiError("INSTAGRAM_LOGIN_APP_ID (ou INSTAGRAM_APP_ID) non configuré.");
  }
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_LOGIN_SCOPES.join(","),
    state: state ?? "instagram_connect",
    enable_fb_login: "0",
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

function buildFacebookLoginAuthUrl(redirectUri: string, state?: string): string {
  const appId = getFacebookLoginAppId();
  if (!appId) {
    throw new InstagramApiError("INSTAGRAM_APP_ID (ou FACEBOOK_APP_ID) non configuré.");
  }
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state ?? "instagram_connect",
  });
  const configId = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim();
  if (configId) {
    params.set("config_id", configId);
    params.set("override_default_response_type", "true");
  } else {
    const scopes = (
      process.env.INSTAGRAM_OAUTH_SCOPES ??
      "instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");
    params.set("scope", scopes);
  }
  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

export function assertInstagramOAuthReady(): void {
  if (usesInstagramDirectLogin()) {
    if (!getInstagramLoginAppId() || !getInstagramLoginAppSecret()) {
      throw new InstagramApiError(
        "INSTAGRAM_LOGIN_APP_ID et INSTAGRAM_LOGIN_APP_SECRET requis (Meta → Instagram → Business login)."
      );
    }
    return;
  }
  if (!getFacebookLoginAppId()) {
    throw new InstagramApiError("INSTAGRAM_APP_ID (ou FACEBOOK_APP_ID) non configuré.");
  }
  const configId = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim();
  const requireConfig =
    process.env.INSTAGRAM_REQUIRE_LOGIN_CONFIG_ID === "true" || Boolean(configId);
  if (requireConfig && !configId) {
    throw new InstagramApiError(
      "FACEBOOK_LOGIN_CONFIG_ID manquant. Meta → Facebook Login for Business → Configurations.",
      "MISSING_CONFIG_ID"
    );
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<InstagramExchangeResult> {
  const normalized = normalizeOAuthCode(code);
  return usesInstagramDirectLogin()
    ? exchangeCodeInstagramLogin(normalized, redirectUri)
    : exchangeCodeFacebookLogin(normalized, redirectUri);
}

async function exchangeCodeInstagramLogin(
  code: string,
  redirectUri: string
): Promise<InstagramExchangeResult> {
  const appId = getInstagramLoginAppId();
  const appSecret = getInstagramLoginAppSecret();
  if (!appId || !appSecret) {
    throw new InstagramApiError("INSTAGRAM_LOGIN_APP_ID et INSTAGRAM_LOGIN_APP_SECRET requis.");
  }

  const form = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await axios
    .post<
      | { access_token: string; user_id: string }
      | { data: Array<{ access_token: string; user_id: string }> }
    >(`${IG_OAUTH_BASE}/oauth/access_token`, form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    .then((r) => r.data)
    .catch(handleError);

  const shortToken =
    "data" in tokenRes && tokenRes.data?.[0]
      ? tokenRes.data[0].access_token
      : (tokenRes as { access_token: string }).access_token;
  const igUserId =
    "data" in tokenRes && tokenRes.data?.[0]
      ? tokenRes.data[0].user_id
      : (tokenRes as { user_id: string }).user_id;

  const longLived = await axios
    .get<{ access_token: string; expires_in: number }>(`${BASE}/access_token`, {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: shortToken,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const expiresAt = new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000);

  const profile = await axios
    .get<{ username?: string; user_id?: string }>(`${BASE}/${API_VERSION}/me`, {
      params: { fields: "user_id,username", access_token: longLived.access_token },
    })
    .then((r) => r.data)
    .catch(() => null);

  return {
    accessToken: longLived.access_token,
    expiresAt,
    igUserId: profile?.user_id ?? igUserId,
    username: profile?.username,
    oauthProvider: "instagram_login",
  };
}

async function exchangeCodeFacebookLogin(
  code: string,
  redirectUri: string
): Promise<InstagramExchangeResult> {
  const appId = getFacebookLoginAppId();
  const appSecret = getFacebookLoginAppSecret();
  if (!appId || !appSecret) {
    throw new InstagramApiError("INSTAGRAM_APP_ID et INSTAGRAM_APP_SECRET requis.");
  }

  const shortLived = await axios
    .get<{ access_token: string }>(`${FB_BASE}/${API_VERSION}/oauth/access_token`, {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const shortToken = shortLived.access_token;

  const longLived = await axios
    .get<{ access_token: string; expires_in: number }>(`${FB_BASE}/${API_VERSION}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const expiresAt = new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60) * 1000);

  const me = await axios
    .get<{ id: string; username?: string }>(`${FB_BASE}/${API_VERSION}/me`, {
      params: {
        fields: "id,username",
        access_token: longLived.access_token,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const pages = await axios
    .get<{ data?: Array<{ id: string; access_token: string }> }>(`${FB_BASE}/${API_VERSION}/me/accounts`, {
      params: { access_token: longLived.access_token },
    })
    .then((r) => r.data)
    .catch(handleError);

  if (!pages.data?.length) {
    throw new InstagramApiError(
      "Aucune Page Facebook liée à ce compte. Crée une Page et relie-la à Instagram Professionnel.",
      "NO_FB_PAGE"
    );
  }

  let igUserId: string | null = null;
  let pageToken = longLived.access_token;
  for (const page of pages.data) {
    const igAccount = await axios
      .get<{ instagram_business_account?: { id: string } }>(
        `${FB_BASE}/${API_VERSION}/${page.id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: page.access_token,
          },
        }
      )
      .then((r) => r.data)
      .catch(() => null);
    if (igAccount?.instagram_business_account?.id) {
      igUserId = igAccount.instagram_business_account.id;
      pageToken = page.access_token;
      break;
    }
  }

  if (!igUserId) {
    throw new InstagramApiError(
      "Aucun compte Instagram Professionnel trouvé sur tes Pages Facebook. Passe Instagram en mode Pro et lie-le à ta Page.",
      "NO_IG_BUSINESS"
    );
  }

  const igUser = await axios
    .get<{ username?: string }>(`${FB_BASE}/${API_VERSION}/${igUserId}`, {
      params: {
        fields: "username",
        access_token: pageToken,
      },
    })
    .then((r) => r.data)
    .catch(() => ({}));

  return {
    accessToken: longLived.access_token,
    refreshToken: undefined,
    expiresAt,
    igUserId,
    username: "username" in igUser ? igUser.username : undefined,
    oauthProvider: "facebook_login",
  };
}

/**
 * Rafraîchit un token long-lived Instagram (valide ~60 jours).
 */
export async function refreshToken(
  token: string,
  oauthProvider?: InstagramOAuthProvider | null
): Promise<{ accessToken: string; expiresAt: Date }> {
  const provider = oauthProvider ?? getInstagramOAuthProvider();
  if (provider === "instagram_login") {
    const res = await axios
      .get<{ access_token: string; expires_in: number }>(`${BASE}/refresh_access_token`, {
        params: {
          grant_type: "ig_refresh_token",
          access_token: token,
        },
      })
      .then((r) => r.data)
      .catch(handleError);
    const expiresAt = new Date(Date.now() + (res.expires_in ?? 60 * 24 * 60 * 60) * 1000);
    return { accessToken: res.access_token, expiresAt };
  }

  const appId = getFacebookLoginAppId();
  const appSecret = getFacebookLoginAppSecret();
  if (!appId || !appSecret) {
    throw new InstagramApiError("INSTAGRAM_APP_ID et INSTAGRAM_APP_SECRET requis.");
  }
  const res = await axios
    .get<{ access_token: string; expires_in: number }>(`${FB_BASE}/${API_VERSION}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: token,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const expiresAt = new Date(Date.now() + (res.expires_in ?? 60 * 24 * 60) * 1000);
  return { accessToken: res.access_token, expiresAt };
}

/**
 * Poll le `status_code` d'un container média jusqu'à FINISHED. Meta traite
 * les containers de façon asynchrone : appeler `media_publish` trop tôt
 * échoue avec « media not ready ». Les reels prennent 10-60 s, les photos
 * quelques secondes — d'où des budgets différents par type.
 */
async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  opts: { maxAttempts: number; intervalMs: number; label: string }
): Promise<void> {
  for (let i = 0; i < opts.maxAttempts; i++) {
    const statusRes = await axios
      .get<{ status_code: string }>(`${BASE}/${API_VERSION}/${containerId}`, {
        params: { fields: "status_code", access_token: accessToken },
      })
      .then((r) => r.data)
      .catch(handleError);

    if (statusRes.status_code === "FINISHED") return;
    if (statusRes.status_code === "ERROR") {
      throw new InstagramApiError(
        `Le média ${opts.label} n'a pas pu être traité par Instagram. Vérifiez le format et l'URL publique du média.`
      );
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new InstagramApiError(
    `Timeout: le média ${opts.label} n'est pas prêt à être publié. Réessayez dans une minute.`
  );
}

/**
 * Étape 1 : Crée un container média image.
 * Étape 2 : Poll du status jusqu'à FINISHED.
 * Étape 3 : Publie le container.
 */
export async function publishPhoto(
  accessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
): Promise<{ mediaId: string }> {
  const createRes = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${igUserId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: caption.slice(0, 2200),
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  const containerId = createRes.id;

  // Photos process fast; ~15s budget covers the slow tail.
  await waitForContainerReady(accessToken, containerId, {
    maxAttempts: 10,
    intervalMs: 1500,
    label: "photo",
  });

  const publishRes = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${igUserId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  return { mediaId: publishRes.id };
}

/**
 * Carousel : créer un container par image (is_carousel_item=true), puis un container parent avec children[].
 */
export async function publishCarousel(
  accessToken: string,
  igUserId: string,
  imageUrls: string[],
  caption: string
): Promise<{ mediaId: string }> {
  if (imageUrls.length === 0 || imageUrls.length > 10) {
    throw new InstagramApiError("Un carousel doit contenir 1 à 10 images.");
  }

  const children: string[] = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const createRes = await axios
      .post<{ id: string }>(
        `${BASE}/${API_VERSION}/${igUserId}/media`,
        null,
        {
          params: {
            image_url: imageUrls[i],
            is_carousel_item: true,
            access_token: accessToken,
          },
        }
      )
      .then((r) => r.data)
      .catch(handleError);
    children.push(createRes.id);
  }

  const carouselRes = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${igUserId}/media`,
      null,
      {
        params: {
          media_type: "CAROUSEL",
          children: children.join(","),
          caption: caption.slice(0, 2200),
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  // The parent container aggregates children processing — poll it before publish.
  await waitForContainerReady(accessToken, carouselRes.id, {
    maxAttempts: 15,
    intervalMs: 2000,
    label: "carousel",
  });

  const publishRes = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${igUserId}/media_publish`,
      null,
      {
        params: {
          creation_id: carouselRes.id,
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  return { mediaId: publishRes.id };
}

export type PublishReelOptions = {
  thumbnailUrl?: string;
  /** Mirror the reel to the main feed (default true). */
  shareToFeed?: boolean;
};

/**
 * Reel : media_type=REELS, video_url, caption, cover_url optionnel.
 *
 * V1 Social Publish forces `is_ai_generated=true` on every reel — Aura only
 * publishes AI-authored assets, and Meta's AI labeling policy requires that
 * disclosure. No user opt-out.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing
 */
export async function publishReel(
  accessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string,
  optionsOrThumbnail?: PublishReelOptions | string
): Promise<{ mediaId: string; containerId: string }> {
  const options: PublishReelOptions =
    typeof optionsOrThumbnail === "string"
      ? { thumbnailUrl: optionsOrThumbnail }
      : (optionsOrThumbnail ?? {});

  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption.slice(0, 2200),
    // V1: hardcoded AI disclosure. Never expose an opt-out to the user.
    is_ai_generated: "true",
    share_to_feed: options.shareToFeed === false ? "false" : "true",
    access_token: accessToken,
  };
  if (options.thumbnailUrl) params.cover_url = options.thumbnailUrl;

  const createRes = await axios
    .post<{ id: string }>(`${BASE}/${API_VERSION}/${igUserId}/media`, null, { params })
    .then((r) => r.data)
    .catch(handleError);

  const containerId = createRes.id;

  await waitForContainerReady(accessToken, containerId, {
    maxAttempts: 30,
    intervalMs: 2000,
    label: "reel",
  });

  const publishRes = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${igUserId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);
  return { mediaId: publishRes.id, containerId };
}

/**
 * Post a first comment on an already-published IG media (photo, reel,
 * carousel). Best-effort in V1: if the `instagram_manage_comments` scope is
 * missing (or the user turned comments off), the caller catches and moves on.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/reference/ig-media/comments
 */
export async function postComment(
  accessToken: string,
  mediaId: string,
  message: string
): Promise<{ commentId: string }> {
  const clean = message.trim();
  if (!clean) throw new InstagramApiError("Commentaire vide.");
  const res = await axios
    .post<{ id: string }>(
      `${BASE}/${API_VERSION}/${mediaId}/comments`,
      null,
      {
        params: {
          message: clean.slice(0, 2200),
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);
  return { commentId: res.id };
}

/**
 * Récupère les métriques d'un post (impressions, reach, engagement, etc.).
 */
export async function getInsights(
  accessToken: string,
  mediaId: string,
  metrics: string[] = ["impressions", "reach", "engagement", "saved"]
): Promise<Record<string, number>> {
  const res = await axios
    .get<{ data?: Array<{ name: string; values: Array<{ value: string }> }> }>(
      `${BASE}/${API_VERSION}/${mediaId}/insights`,
      {
        params: {
          metric: metrics.join(","),
          access_token: accessToken,
        },
      }
    )
    .then((r) => r.data)
    .catch(handleError);

  const out: Record<string, number> = {};
  for (const item of res.data ?? []) {
    const val = item.values?.[0]?.value;
    out[item.name] = val ? parseInt(val, 10) : 0;
  }
  return out;
}
