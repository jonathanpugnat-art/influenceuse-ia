/**
 * Instagram Graph API — OAuth, publication (photo, carousel, reel), insights.
 * Requiert un compte Instagram professionnel (Business/Creator) lié à une Page Facebook.
 *
 * Env: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, NEXT_PUBLIC_APP_URL
 */

import axios, { type AxiosError } from "axios";

const BASE = "https://graph.instagram.com";
const FB_BASE = "https://graph.facebook.com";
const API_VERSION = "v21.0";

const APP_ID = process.env.INSTAGRAM_APP_ID ?? process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET;

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
    const ax = err as AxiosError<{ error?: { message?: string; code?: number; error_subcode?: number } }>;
    const status = ax.response?.status;
    const body = ax.response?.data?.error;
    const msg = body?.message ?? ax.message ?? "Instagram API error";
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

/**
 * Génère l'URL d'autorisation OAuth Instagram (Facebook Login pour Instagram).
 * Scopes: instagram_basic, instagram_content_publish.
 * state: à passer au callback (ex: influencerId).
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  if (!APP_ID) throw new InstagramApiError("INSTAGRAM_APP_ID (ou FACEBOOK_APP_ID) non configuré.");
  const scopes = ["instagram_basic", "instagram_content_publish"].join(",");
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
    state: state ?? "instagram_connect",
  });
  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Échange le code d'autorisation contre un access token (court terme).
 * Puis échange contre un long-lived token et récupère l'IG User ID.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date; igUserId: string; username?: string }> {
  if (!APP_ID || !APP_SECRET) {
    throw new InstagramApiError("INSTAGRAM_APP_ID et INSTAGRAM_APP_SECRET requis.");
  }

  const shortLived = await axios
    .get<{ access_token: string }>(`${FB_BASE}/${API_VERSION}/oauth/access_token`, {
      params: {
        client_id: APP_ID,
        client_secret: APP_SECRET,
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
        client_id: APP_ID,
        client_secret: APP_SECRET,
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
    .catch(() => ({ data: [] }));

  let igUserId = me.id;
  if (pages.data?.length) {
    const igAccount = await axios
      .get<{ instagram_business_account?: { id: string } }>(
        `${FB_BASE}/${API_VERSION}/${pages.data[0].id}`,
        {
          params: {
            fields: "instagram_business_account",
            access_token: pages.data[0].access_token,
          },
        }
      )
      .then((r) => r.data)
      .catch(() => null);
    if (igAccount?.instagram_business_account?.id) {
      igUserId = igAccount.instagram_business_account.id;
    }
  }

  const igUser = await axios
    .get<{ username?: string }>(`${BASE}/${API_VERSION}/${igUserId}`, {
      params: {
        fields: "username",
        access_token: longLived.access_token,
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
  };
}

/**
 * Rafraîchit un token long-lived Instagram (valide ~60 jours).
 */
export async function refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!APP_ID || !APP_SECRET) {
    throw new InstagramApiError("INSTAGRAM_APP_ID et INSTAGRAM_APP_SECRET requis.");
  }
  const res = await axios
    .get<{ access_token: string; expires_in: number }>(`${FB_BASE}/${API_VERSION}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: token,
      },
    })
    .then((r) => r.data)
    .catch(handleError);

  const expiresAt = new Date(Date.now() + (res.expires_in ?? 60 * 24 * 60) * 1000);
  return { accessToken: res.access_token, expiresAt };
}

/**
 * Étape 1 : Crée un container média image.
 * Étape 2 : Publie le container.
 * Étape 3 : Optionnel — poll du status jusqu'à FINISHED.
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

/**
 * Reel : media_type=REELS, video_url, caption, cover_url optionnel.
 */
export async function publishReel(
  accessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string,
  thumbnailUrl?: string
): Promise<{ mediaId: string }> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption.slice(0, 2200),
    access_token: accessToken,
  };
  if (thumbnailUrl) params.cover_url = thumbnailUrl;

  const createRes = await axios
    .post<{ id: string }>(`${BASE}/${API_VERSION}/${igUserId}/media`, null, { params })
    .then((r) => r.data)
    .catch(handleError);

  const containerId = createRes.id;

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await axios
      .get<{ status_code: string }>(`${BASE}/${API_VERSION}/${containerId}`, {
        params: { fields: "status_code", access_token: accessToken },
      })
      .then((r) => r.data)
      .catch(handleError);

    if (statusRes.status_code === "FINISHED") {
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
    if (statusRes.status_code === "ERROR") {
      throw new InstagramApiError("Le média reel n'a pas pu être traité par Instagram.");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new InstagramApiError("Timeout: le reel n'est pas prêt à être publié.");
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
