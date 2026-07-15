import { afterEach, describe, expect, it } from "vitest";
import {
  decryptText,
  encryptText,
  isEncryptedPayload,
} from "../../../src/lib/security/encryption";
import {
  normalizeCpf,
  normalizeEmail,
  normalizeSearchableText,
} from "../../../src/lib/security/normalization";
import {
  protectCpf,
  protectEmail,
  protectNullableText,
} from "../../../src/lib/security/piiPayload";
import {
  compareSearchableHash,
  generateSearchableHash,
} from "../../../src/lib/security/searchableHash";

const VALID_MASTER_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

const originalEnv = {
  ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
  ENCRYPTION_KEY_ID: process.env.ENCRYPTION_KEY_ID,
  SEARCH_KEY: process.env.SEARCH_KEY,
};

function setValidSecurityEnv() {
  process.env.ENCRYPTION_MASTER_KEY = VALID_MASTER_KEY;
  process.env.ENCRYPTION_KEY_ID = "test-key";
  process.env.SEARCH_KEY = "test-search-key";
}

afterEach(() => {
  process.env.ENCRYPTION_MASTER_KEY = originalEnv.ENCRYPTION_MASTER_KEY;
  process.env.ENCRYPTION_KEY_ID = originalEnv.ENCRYPTION_KEY_ID;
  process.env.SEARCH_KEY = originalEnv.SEARCH_KEY;
});

describe("security helpers", () => {
  it("encrypts and decrypts text payloads", () => {
    setValidSecurityEnv();

    const encrypted = encryptText("secret value");

    expect(encrypted).toMatch(/^v1:test-key:/);
    expect(encrypted).not.toContain("secret value");
    expect(isEncryptedPayload(encrypted)).toBe(true);
    expect(decryptText(encrypted)).toBe("secret value");
  });

  it("uses default key id when ENCRYPTION_KEY_ID is empty", () => {
    setValidSecurityEnv();
    process.env.ENCRYPTION_KEY_ID = "";

    expect(encryptText("secret")).toMatch(/^v1:default:/);
  });

  it("rejects missing, malformed, and short encryption keys", () => {
    process.env.ENCRYPTION_MASTER_KEY = "";
    expect(() => encryptText("secret")).toThrow(
      "ENCRYPTION_MASTER_KEY is required",
    );

    process.env.ENCRYPTION_MASTER_KEY = "not-hex";
    expect(() => encryptText("secret")).toThrow(
      "ENCRYPTION_MASTER_KEY must be hex encoded",
    );

    process.env.ENCRYPTION_MASTER_KEY = "aabbcc";
    expect(() => encryptText("secret")).toThrow(
      "ENCRYPTION_MASTER_KEY must be 32 bytes",
    );
  });

  it("rejects invalid encrypted payloads", () => {
    setValidSecurityEnv();

    expect(() => decryptText("not-encrypted")).toThrow(
      "Invalid encrypted payload format",
    );
    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload(undefined)).toBe(false);
    expect(isEncryptedPayload("plain")).toBe(false);
  });

  it("normalizes email, CPF, and generic searchable text", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
    expect(normalizeCpf("123.456.789-01")).toBe("12345678901");
    expect(normalizeSearchableText("  PlEnO ")).toBe("pleno");
  });

  it("generates and compares searchable hashes", () => {
    setValidSecurityEnv();

    const hash = generateSearchableHash("user@example.com");

    expect(hash).toHaveLength(64);
    expect(compareSearchableHash("user@example.com", hash)).toBe(true);
    expect(compareSearchableHash("other@example.com", hash)).toBe(false);
    expect(compareSearchableHash("user@example.com", "abcd")).toBe(false);
  });

  it("requires SEARCH_KEY for searchable hashes", () => {
    process.env.SEARCH_KEY = "";

    expect(() => generateSearchableHash("value")).toThrow(
      "SEARCH_KEY is required",
    );
  });

  it("builds protected PII payloads and null payloads", () => {
    setValidSecurityEnv();

    const email = protectEmail(" USER@Example.COM ");
    const cpf = protectCpf("123.456.789-01");

    expect(email.emailEncrypted).toMatch(/^v1:test-key:/);
    expect(email.emailHash).toHaveLength(64);
    expect(cpf.cpfEncrypted).toMatch(/^v1:test-key:/);
    expect(cpf.cpfHash).toHaveLength(64);
    expect(decryptText(email.emailEncrypted!)).toBe("user@example.com");
    expect(decryptText(cpf.cpfEncrypted!)).toBe("12345678901");
    expect(decryptText(protectNullableText("  Hudson  ")!)).toBe("Hudson");
    expect(protectEmail(null)).toEqual({
      emailEncrypted: null,
      emailHash: null,
    });
    expect(protectEmail(undefined)).toEqual({
      emailEncrypted: null,
      emailHash: null,
    });
    expect(protectCpf(null)).toEqual({ cpfEncrypted: null, cpfHash: null });
    expect(protectCpf(undefined)).toEqual({
      cpfEncrypted: null,
      cpfHash: null,
    });
    expect(protectNullableText(null)).toBeNull();
    expect(protectNullableText(undefined)).toBeNull();
    expect(protectNullableText("")).toBeNull();
  });
});
