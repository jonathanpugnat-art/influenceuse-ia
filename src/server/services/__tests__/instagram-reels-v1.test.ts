import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.INSTAGRAM_LOGIN_APP_ID = "test-ig-app";
process.env.INSTAGRAM_LOGIN_APP_SECRET = "test-ig-secret";

vi.mock("axios", () => {
  const mock = {
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: (err: unknown): boolean =>
      Boolean(err && typeof err === "object" && "isAxiosError" in err),
  };
  return { default: mock, __esModule: true };
});

import axios from "axios";
import * as instagram from "../instagram.service";

const mockedAxios = axios as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  isAxiosError: (err: unknown) => boolean;
};

const API_VERSION = "v21.0";
const IG_USER = "ig_user_123";

describe("instagram.service — Reels V1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("publishReel", () => {
    it("forces is_ai_generated=true and share_to_feed=true by default", async () => {
      // media container creation
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "container_1" } });
      // status poll → FINISHED
      mockedAxios.get.mockResolvedValueOnce({
        data: { status_code: "FINISHED" },
      });
      // media_publish
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "media_42" } });

      const result = await instagram.publishReel(
        "access-token",
        IG_USER,
        "https://cdn.example.com/reel.mp4",
        "hello world"
      );

      expect(result.mediaId).toBe("media_42");

      const createCall = mockedAxios.post.mock.calls[0];
      expect(createCall[0]).toBe(
        `https://graph.instagram.com/${API_VERSION}/${IG_USER}/media`
      );
      const createParams = createCall[2].params;
      expect(createParams.media_type).toBe("REELS");
      expect(createParams.is_ai_generated).toBe("true");
      expect(createParams.share_to_feed).toBe("true");
      expect(createParams.video_url).toBe("https://cdn.example.com/reel.mp4");
    });

    it("propagates share_to_feed=false when explicitly opted out", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "c1" } });
      mockedAxios.get.mockResolvedValueOnce({ data: { status_code: "FINISHED" } });
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "media_hidden" } });

      await instagram.publishReel(
        "access-token",
        IG_USER,
        "https://cdn.example.com/reel.mp4",
        "hidden reel",
        { shareToFeed: false }
      );

      const createParams = mockedAxios.post.mock.calls[0][2].params;
      expect(createParams.share_to_feed).toBe("false");
      // AI disclosure remains hardcoded true regardless of the opt-out.
      expect(createParams.is_ai_generated).toBe("true");
    });

    it("still supports the legacy string thumbnailUrl overload", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "c1" } });
      mockedAxios.get.mockResolvedValueOnce({ data: { status_code: "FINISHED" } });
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "media_thumb" } });

      await instagram.publishReel(
        "access-token",
        IG_USER,
        "https://cdn.example.com/reel.mp4",
        "with thumb",
        "https://cdn.example.com/cover.jpg"
      );

      const createParams = mockedAxios.post.mock.calls[0][2].params;
      expect(createParams.cover_url).toBe("https://cdn.example.com/cover.jpg");
      expect(createParams.is_ai_generated).toBe("true");
    });
  });

  describe("postComment", () => {
    it("posts a first comment via /{media-id}/comments", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { id: "comment_9" } });
      const result = await instagram.postComment(
        "access-token",
        "media_42",
        "  First! 🎉  "
      );
      expect(result.commentId).toBe("comment_9");
      const call = mockedAxios.post.mock.calls[0];
      expect(call[0]).toBe(
        `https://graph.instagram.com/${API_VERSION}/media_42/comments`
      );
      expect(call[2].params.message).toBe("First! 🎉");
    });

    it("rejects empty comments before hitting the API", async () => {
      await expect(
        instagram.postComment("access-token", "media_42", "   ")
      ).rejects.toThrow();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
