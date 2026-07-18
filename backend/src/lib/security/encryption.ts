import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const PAYLOAD_VERSION = "v1";

function getMasterKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_MASTER_KEY?.trim();

  if (!rawKey) {
    throw new Error("ENCRYPTION_MASTER_KEY is required for encryption");
  }

  if (!/^[a-fA-F0-9]+$/.test(rawKey)) {
    throw new Error("ENCRYPTION_MASTER_KEY must be hex encoded");
  }

  const key = Buffer.from(rawKey, "hex");

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error("ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex chars)");
  }

  return key;
}

function getKeyId(): string {
  return process.env.ENCRYPTION_KEY_ID?.trim() || "default";
}

export function encryptText(value: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    getKeyId(),
    iv.toString("hex"),
    authTag.toString("hex"),
    ciphertext.toString("hex"),
  ].join(":");
}

export function decryptText(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 5 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error("Invalid encrypted payload format");
  }

  const [, , ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(ivHex, "hex"),
    { authTagLength: AUTH_TAG_LENGTH_BYTES },
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedPayload(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${PAYLOAD_VERSION}:`);
}
