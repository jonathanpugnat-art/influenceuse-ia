import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  apiKey: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/server/db", () => ({ db: mockDb }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("api-key.service", () => {
  describe("hashApiKey", () => {
    it("produces deterministic 64-char hex hashes", async () => {
      const { hashApiKey } = await import("@/server/services/api-key.service");
      const a = hashApiKey("hello");
      const b = hashApiKey("hello");
      const c = hashApiKey("world");
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
      expect(a).not.toBe(c);
    });
  });

  describe("generateRawKey", () => {
    it("produces a key starting with iia_live_ and a unique prefix", async () => {
      const { generateRawKey } = await import("@/server/services/api-key.service");
      const k1 = generateRawKey();
      const k2 = generateRawKey();
      expect(k1.plain).toMatch(/^iia_live_/);
      expect(k1.prefix).toMatch(/^iia_live_/);
      expect(k1.plain).not.toBe(k2.plain);
      expect(k1.prefix).not.toBe(k2.prefix);
    });
  });

  describe("createApiKey", () => {
    it("hashes the key, stores prefix + scopes, returns plainKey", async () => {
      const { createApiKey } = await import("@/server/services/api-key.service");
      mockDb.apiKey.create.mockResolvedValue({
        id: "k1",
        prefix: "iia_live_aaaaaa",
        name: "test",
        scopes: ["READ"],
        createdAt: new Date(),
        expiresAt: null,
      });
      const result = await createApiKey({
        userId: "u1",
        name: "test",
        scopes: ["READ"],
      });
      expect(result.plainKey).toMatch(/^iia_live_/);
      expect(mockDb.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "u1",
            scopes: ["READ"],
            hashedKey: expect.any(String),
          }),
        })
      );
    });

    it("defaults to READ scope when an empty array is passed", async () => {
      const { createApiKey } = await import("@/server/services/api-key.service");
      mockDb.apiKey.create.mockResolvedValue({} as never);
      await createApiKey({ userId: "u1", name: "x", scopes: [] });
      expect(mockDb.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scopes: ["READ"] }),
        })
      );
    });
  });

  describe("validateAndConsume", () => {
    it("rejects missing or malformed tokens", async () => {
      const { validateAndConsume } = await import(
        "@/server/services/api-key.service"
      );
      await expect(validateAndConsume(null)).rejects.toThrow(/Missing/);
      await expect(validateAndConsume("Bearer xxx")).rejects.toThrow(/Missing/);
    });

    it("rejects an expired key", async () => {
      const { validateAndConsume } = await import(
        "@/server/services/api-key.service"
      );
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: "k1",
        userId: "u1",
        isActive: true,
        scopes: ["READ"],
        expiresAt: new Date(Date.now() - 1000),
        windowStartedAt: new Date(),
        requestsThisWindow: 0,
      });
      await expect(
        validateAndConsume("Bearer iia_live_abc.def")
      ).rejects.toThrow(/expired/);
    });

    it("rejects when over rate limit", async () => {
      const { validateAndConsume } = await import(
        "@/server/services/api-key.service"
      );
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: "k1",
        userId: "u1",
        isActive: true,
        scopes: ["READ"],
        expiresAt: null,
        windowStartedAt: new Date(),
        requestsThisWindow: 60,
      });
      await expect(
        validateAndConsume("Bearer iia_live_abc.def")
      ).rejects.toThrow(/Rate limit/);
    });

    it("returns userId+scopes and updates counters on success", async () => {
      const { validateAndConsume } = await import(
        "@/server/services/api-key.service"
      );
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: "k1",
        userId: "u1",
        isActive: true,
        scopes: ["READ", "WRITE"],
        expiresAt: null,
        windowStartedAt: new Date(),
        requestsThisWindow: 5,
      });
      mockDb.apiKey.update.mockResolvedValue({} as never);
      const out = await validateAndConsume("Bearer iia_live_abc.def");
      expect(out.userId).toBe("u1");
      expect(out.scopes).toContain("READ");
      expect(mockDb.apiKey.update).toHaveBeenCalled();
    });
  });
});
