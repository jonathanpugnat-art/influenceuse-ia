import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The service reads TIKTOK_CLIENT_KEY / SECRET at import time — set them
// before importing so exchangeCode() doesn't complain.
process.env.TIKTOK_CLIENT_KEY = "test-client-key";
process.env.TIKTOK_CLIENT_SECRET = "test-client-secret";

vi.mock("axios", () => {
  const mock = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    isAxiosError: (err: unknown): boolean =>
      Boolean(err && typeof err === "object" && "isAxiosError" in err),
  };
  return { default: mock, __esModule: true };
});

import axios from "axios";
import * as tiktok from "../tiktok.service";

const mockedAxios = axios as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  isAxiosError: (err: unknown) => boolean;
};

const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";

function makeAxiosError(status: number, code: string, message = "") {
  return {
    isAxiosError: true,
    response: { status, data: { error: { code, message } } },
    message,
  };
}

describe("tiktok.service — Direct Post V1", () => {
  const originalAudit = process.env.TIKTOK_AUDIT_APPROVED;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAudit === undefined) {
      delete process.env.TIKTOK_AUDIT_APPROVED;
    } else {
      process.env.TIKTOK_AUDIT_APPROVED = originalAudit;
    }
  });

  describe("queryCreatorInfo", () => {
    it("returns privacy_level_options from the API", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            privacy_level_options: ["SELF_ONLY", "MUTUAL_FOLLOW_FRIENDS"],
            max_video_post_duration_sec: 180,
            comment_disabled: false,
            duet_disabled: false,
            stitch_disabled: false,
            creator_username: "aura",
          },
        },
      });
      const info = await tiktok.queryCreatorInfo("token");
      expect(mockedAxios.post).toHaveBeenCalledWith(
        CREATOR_INFO_URL,
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token",
          }),
        })
      );
      expect(info.privacyLevelOptions).toEqual([
        "SELF_ONLY",
        "MUTUAL_FOLLOW_FRIENDS",
      ]);
      expect(info.maxVideoPostDurationSec).toBe(180);
      expect(info.creatorUsername).toBe("aura");
    });

    it("falls back to [SELF_ONLY] when the API omits options", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { data: {} } });
      const info = await tiktok.queryCreatorInfo("token");
      expect(info.privacyLevelOptions).toEqual(["SELF_ONLY"]);
    });
  });

  describe("publishVideo — Direct Post + is_aigc", () => {
    it("uses PULL_FROM_URL with is_aigc=true and clamps to SELF_ONLY while unaudited", async () => {
      delete process.env.TIKTOK_AUDIT_APPROVED;

      // creator_info returns only SELF_ONLY
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { privacy_level_options: ["SELF_ONLY"] } },
      });
      // /video/init returns publish_id
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { publish_id: "pub_abc123" } },
      });

      const result = await tiktok.publishVideo(
        "token",
        "https://cdn.example.com/reel.mp4",
        "Hello ✨",
        // Requester asked for PUBLIC_TO_EVERYONE — must be clamped to SELF_ONLY.
        { privacyLevel: "PUBLIC_TO_EVERYONE" }
      );

      expect(result.publishId).toBe("pub_abc123");
      expect(result.privacyLevel).toBe("SELF_ONLY");
      expect(result.source).toBe("PULL_FROM_URL");

      const initCall = mockedAxios.post.mock.calls[1];
      expect(initCall[0]).toBe(INIT_URL);
      expect(initCall[1]).toMatchObject({
        post_info: expect.objectContaining({
          privacy_level: "SELF_ONLY",
          is_aigc: true,
        }),
        source_info: {
          source: "PULL_FROM_URL",
          video_url: "https://cdn.example.com/reel.mp4",
        },
      });
    });

    it("keeps the requested privacy_level when audit is approved AND creator_info allows it", async () => {
      process.env.TIKTOK_AUDIT_APPROVED = "true";
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            data: {
              privacy_level_options: [
                "SELF_ONLY",
                "PUBLIC_TO_EVERYONE",
                "MUTUAL_FOLLOW_FRIENDS",
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          data: { data: { publish_id: "pub_public" } },
        });

      const result = await tiktok.publishVideo(
        "token",
        "https://cdn.example.com/reel.mp4",
        "Public please",
        { privacyLevel: "PUBLIC_TO_EVERYONE" }
      );

      expect(result.privacyLevel).toBe("PUBLIC_TO_EVERYONE");
      const initCall = mockedAxios.post.mock.calls[1];
      expect(initCall[1].post_info.privacy_level).toBe("PUBLIC_TO_EVERYONE");
      expect(initCall[1].post_info.is_aigc).toBe(true);
    });

    it("maps spam_risk_too_many_posts to a French visible failure and never retries", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { data: { privacy_level_options: ["SELF_ONLY"] } },
        })
        .mockResolvedValueOnce({
          data: {
            error: {
              code: "spam_risk_too_many_posts",
              message: "spam risk",
            },
          },
        });

      await expect(
        tiktok.publishVideo(
          "token",
          "https://cdn.example.com/reel.mp4",
          "caption"
        )
      ).rejects.toMatchObject({
        code: "spam_risk_too_many_posts",
      });
    });

    it("falls back to FILE_UPLOAD when url_ownership_unverified is returned", async () => {
      // creator_info
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { privacy_level_options: ["SELF_ONLY"] } },
      });
      // PULL_FROM_URL init throws unverified
      mockedAxios.post.mockRejectedValueOnce(
        makeAxiosError(400, "url_ownership_unverified", "unverified")
      );
      // Download the video buffer
      mockedAxios.get.mockResolvedValueOnce({ data: Buffer.from("x".repeat(1024)) });
      // FILE_UPLOAD init
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            publish_id: "pub_upload",
            upload_url: "https://upload.example.com/put",
          },
        },
      });
      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      const result = await tiktok.publishVideo(
        "token",
        "https://cdn.example.com/reel.mp4",
        "caption"
      );

      expect(result.source).toBe("FILE_UPLOAD");
      expect(result.publishId).toBe("pub_upload");
      expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAuthUrl", () => {
    it("includes video.publish + user.info.basic scopes only", () => {
      const url = tiktok.getAuthUrl(
        "https://app.example.com/api/auth/tiktok",
        "state123"
      );
      expect(url).toContain("scope=user.info.basic%2Cvideo.publish");
      expect(url).not.toContain("video.upload");
      expect(url).toContain("state=state123");
    });
  });
});
