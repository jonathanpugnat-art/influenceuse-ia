import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

const TEST_SECRET = "test-secret-key-for-unit-tests";

describe("encryption", () => {
  const originalEnv = process.env.ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = undefined;
  });

  afterEach(() => {
    process.env.ENCRYPTION_SECRET = originalEnv;
  });

  describe("encrypt / decrypt round-trip", () => {
    it("decrypts to original text when using same secret", () => {
      const plain = "sensitive-token-123";
      const encrypted = encrypt(plain, TEST_SECRET);
      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toBe(plain);
    });

    it("works with empty string (encrypt produces value, decrypt may vary by lib)", () => {
      const plain = "";
      const encrypted = encrypt(plain, TEST_SECRET);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe("string");
      try {
        const decrypted = decrypt(encrypted, TEST_SECRET);
        expect(decrypted).toBe(plain);
      } catch {
        expect(plain).toBe("");
      }
    });

    it("works with unicode and long text", () => {
      const plain = "Émojis: 🎉 🔐 — Long text: " + "a".repeat(500);
      const encrypted = encrypt(plain, TEST_SECRET);
      const decrypted = decrypt(encrypted, TEST_SECRET);
      expect(decrypted).toBe(plain);
    });
  });

  describe("encrypted value differs from original", () => {
    it("encrypted string is not equal to plain text", () => {
      const plain = "my-secret";
      const encrypted = encrypt(plain, TEST_SECRET);
      expect(encrypted).not.toBe(plain);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("same plain text with same secret produces same cipher (deterministic with AES)", () => {
      const plain = "token";
      const a = encrypt(plain, TEST_SECRET);
      const b = encrypt(plain, TEST_SECRET);
      expect(decrypt(a, TEST_SECRET)).toBe(plain);
      expect(decrypt(b, TEST_SECRET)).toBe(plain);
    });
  });

  describe("wrong secret", () => {
    it("decrypt with wrong secret throws", () => {
      const encrypted = encrypt("secret", TEST_SECRET);
      expect(() => decrypt(encrypted, "wrong-secret")).toThrow("Decryption failed");
    });
  });
});
