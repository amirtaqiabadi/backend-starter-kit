import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { paymentConfig } from "@/server/payment/config";

const PREFIX = "enc:v1:";

/** Why: refund PANs must not sit in Postgres as 16 digits. */
export function encryptCardNumber(cardNumber: string, secret = paymentConfig().cardEncryptionKey): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(cardNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/** Why: list responses still need the PAN only long enough to mask it. */
export function decryptCardNumber(stored: string, secret = paymentConfig().cardEncryptionKey): string | null {
  if (!stored.startsWith(PREFIX)) {
    return null;
  }
  const [iv, tag, payload] = stored.slice(PREFIX.length).split(".");
  if (!iv || !tag || !payload) {
    return null;
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(payload, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function encryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}
