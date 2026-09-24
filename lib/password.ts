import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { Member } from "./types";

export const DEFAULT_PASSWORD = "1234";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32, { N: 4096, r: 8, p: 1 }).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored?: string) {
  if (!stored) return password === DEFAULT_PASSWORD;
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 32, { N: 4096, r: 8, p: 1 });
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function ensureMemberSecrets(members: Member[]) {
  let changed = false;
  for (const member of members) {
    if (!member.passwordHash) {
      member.passwordHash = hashPassword(DEFAULT_PASSWORD);
      member.mustChangePassword = true;
      changed = true;
    } else if (member.mustChangePassword === undefined) {
      member.mustChangePassword = verifyPassword(DEFAULT_PASSWORD, member.passwordHash);
      changed = true;
    }
  }
  return changed;
}

export function publicMember(member: Member): Member {
  const copy = { ...member };
  delete copy.passwordHash;
  return copy;
}
