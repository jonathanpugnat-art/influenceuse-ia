import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe("storage.service", () => {
  const origR2 = process.env.R2_ACCOUNT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (origR2 !== undefined) process.env.R2_ACCOUNT_ID = origR2;
  });

  it("uploadFile writes to public/uploads when R2_ACCOUNT_ID is not set", async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const { uploadFile } = await import("@/server/services/storage.service");
    const buffer = Buffer.from("test");
    const url = await uploadFile(buffer, "test.txt", "text/plain");
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writePath = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(writePath).toContain("public");
    expect(writePath).toContain("uploads");
    expect(url).toContain("/uploads/");
  });

  it("getPresignedUrl returns local URL when R2 not configured", async () => {
    const { getPresignedUrl } = await import("@/server/services/storage.service");
    const url = await getPresignedUrl("abc123/test.jpg", 3600);
    expect(url).toContain("/uploads/");
  });

  it("deleteFile does not throw when file does not exist (local fallback)", async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { deleteFile } = await import("@/server/services/storage.service");
    await expect(deleteFile("nonexistent/key")).resolves.not.toThrow();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
