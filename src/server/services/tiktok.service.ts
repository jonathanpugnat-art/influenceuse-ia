/**
 * TikTok Content Posting API — OAuth, publication vidéo, infos.
 * Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, NEXT_PUBLIC_APP_URL
 */

import axios, { type AxiosError } from "axios";

const API_BASE = "https://open.tiktokapis.com";
const AUTH_BASE = "https://www.tiktok.com";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

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

function handleError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ error?: { code?: string; message?: string } }>;
    const status = ax.response?.status;
    const body = ax.response?.data?.error;
    const code = body?.code ?? "unknown";
    const msg = body?.message ?? ax.message ?? "TikTok API error";
    if (status === 429) {
      throw new TikTokApiError("Rate limit TikTok. Réessayez plus tard.", "rate_limit_exceeded", 429);
    }
    if (status === 401) {
      throw new TikTokApiError("Token TikTok expiré ou invalide. Reconnectez le compte.", "access_token_invalid", 401);
    }
    if (code === "url_ownership_unverified") {
      throw new TikTokApiError(
        "Le domaine de la vidéo n'est pas vérifié dans TikTok Developer. Utilisez un domaine vérifié ou uploadez le fichier.",
        code,
        status
      );
    }
    throw new TikTokApiError(msg, code, status);
  }
  throw err;
}

/**
 * URL d'autorisation OAuth TikTok.
 * Scopes: user.info.basic, video.upload, video.publish
 * state: à passer au callback (ex: influencerId).
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  if (!CLIENT_KEY) throw new TikTokApiError("TIKTOK_CLIENT_KEY non configuré.");
  const scope = "user.info.basic,video.upload,video.publish";
  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    scope,
    response_type: "code",
    redirect_uri: redirectUri,
    state: state ?? "tiktok_connect",
  });
  return `${AUTH_BASE}/v2/auth/authorize/?${params.toString()}`;
}

/**
 * Échange le code contre un access_token.
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
}> {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    throw new TikTokApiError("TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET requis.");
  }

  const res = await axios
    .post<{
      data?: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
      };
      error?: { code: string; message: string };
    }>(
      `${API_BASE}/v2/oauth/token/`,
      new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
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
    throw new TikTokApiError(res.error.message ?? res.error.code);
  }
  const data = res.data;
  if (!data?.access_token) {
    throw new TikTokApiError("Réponse TikTok invalide: pas d'access_token.");
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000);

  const userRes = await axios
    .get<{
      data?: { user?: { display_name?: string; unique_id?: string } };
      error?: { code: string };
    }>(`${API_BASE}/v2/user/info/`, {
      params: { fields: "display_name,unique_id" },
      headers: { Authorization: `Bearer ${data.access_token}` },
    })
    .then((r) => r.data)
    .catch(() => ({ data: {} }));

  const userData = userRes.data && "user" in userRes.data ? userRes.data.user : undefined;
  const username = userData?.unique_id ?? userData?.display_name;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt,
    openId: data.open_id ?? "",
    username,
  };
}

/**
 * Publie une vidéo.
 * 1) Tente PULL_FROM_URL (le domaine de videoUrl doit être vérifié dans TikTok).
 * 2) Si url_ownership_unverified, fallback: télécharge la vidéo et utilise FILE_UPLOAD.
 */
export async function publishVideo(
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ publishId: string; videoId?: string }> {
  const basePayload = {
    post_info: { title: caption.slice(0, 150) },
    privacy_level: "PUBLIC_TO_EVERYONE",
  };

  try {
    const initRes = await axios
      .post<{
        data?: { publish_id: string; upload_url?: string };
        error?: { code: string; message: string };
      }>(
        `${API_BASE}/v2/post/publish/inbox/video/init/`,
        {
          ...basePayload,
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
      throw new TikTokApiError(initRes.error.message ?? initRes.error.code);
    }
    return { publishId: initRes.data?.publish_id ?? "" };
  } catch (err) {
    const isUnverified =
      axios.isAxiosError(err) &&
      err.response?.data?.error?.code === "url_ownership_unverified";
    if (!isUnverified) handleError(err);

    const videoBuffer = await axios
      .get(videoUrl, { responseType: "arraybuffer", timeout: 120_000 })
      .then((r) => Buffer.from(r.data));
    const size = videoBuffer.length;
    const chunkSize = Math.min(size, 5 * 1024 * 1024);
    const totalChunks = Math.ceil(size / chunkSize);

    const initUpload = await axios
      .post<{
        data?: { publish_id: string; upload_url: string };
        error?: { code: string; message: string };
      }>(
        `${API_BASE}/v2/post/publish/inbox/video/init/`,
        {
          ...basePayload,
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
      .then((r) => r.data);

    if (initUpload.error?.code && initUpload.error.code !== "ok") {
      throw new TikTokApiError(initUpload.error.message ?? initUpload.error.code);
    }
    const uploadUrl = initUpload.data?.upload_url;
    const publishId = initUpload.data?.publish_id ?? "";
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
    return { publishId };
  }
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
