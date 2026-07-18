import { encryptText } from "./encryption";
import { normalizeCpf, normalizeEmail } from "./normalization";
import { generateSearchableHash } from "./searchableHash";

export type ProtectedUserPii = {
  emailEncrypted?: string | null;
  emailHash?: string | null;
  firstNameEncrypted?: string | null;
  lastNameEncrypted?: string | null;
  displayNameEncrypted?: string | null;
  phoneEncrypted?: string | null;
  cpfEncrypted?: string | null;
  cpfHash?: string | null;
};

export function protectEmail(email: string | null | undefined) {
  if (!email) {
    return {
      emailEncrypted: null,
      emailHash: null,
    };
  }

  const normalizedEmail = normalizeEmail(email);

  return {
    emailEncrypted: encryptText(normalizedEmail),
    emailHash: generateSearchableHash(normalizedEmail),
  };
}

export function protectCpf(cpf: string | null | undefined) {
  if (!cpf) {
    return {
      cpfEncrypted: null,
      cpfHash: null,
    };
  }

  const normalizedCpf = normalizeCpf(cpf);

  return {
    cpfEncrypted: encryptText(normalizedCpf),
    cpfHash: generateSearchableHash(normalizedCpf),
  };
}

export function protectNullableText(value: string | null | undefined) {
  return value ? encryptText(value.trim()) : null;
}
