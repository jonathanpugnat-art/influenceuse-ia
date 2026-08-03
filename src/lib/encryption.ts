import CryptoJS from "crypto-js";

function getSecret(override?: string): string {
  const secret = override ?? process.env.ENCRYPTION_SECRET;
  if (!secret || String(secret).trim() === "") {
    throw new Error(
      "ENCRYPTION_SECRET is not set. Set it in your environment (e.g. .env) with a long random secret."
    );
  }
  return secret;
}

/**
 * Encrypt a string with AES using ENCRYPTION_SECRET.
 */
export function encrypt(text: string, secret?: string): string {
  const key = getSecret(secret);
  return CryptoJS.AES.encrypt(text, key).toString();
}

/**
 * Decrypt an AES-encrypted string.
 */
export function decrypt(encrypted: string, secret?: string): string {
  const key = getSecret(secret);
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    // CryptoJS may return "" OR throw "Malformed UTF-8 data" depending on
    // runtime / version when the key is wrong — normalize both to one error.
    const decoded = bytes.toString(CryptoJS.enc.Utf8);
    if (!decoded) {
      throw new Error("Decryption failed: invalid key or corrupted data");
    }
    return decoded;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.startsWith("Decryption failed")
    ) {
      throw err;
    }
    throw new Error("Decryption failed: invalid key or corrupted data");
  }
}
