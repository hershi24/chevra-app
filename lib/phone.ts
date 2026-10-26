import type { Member } from "./types";

/** Israeli numbers as 05… so a Yemot caller and a member card match. */
export function normalizePhone(value: string) {
  let digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  if (digits.length === 9 && (digits.startsWith("5") || digits.startsWith("7"))) digits = `0${digits}`;
  return digits;
}

/** Last 9 digits: 0501112233, 501112233 and 972501112233 all become the same key. */
export function phoneKey(value: string) {
  const phone = normalizePhone(value);
  if (phone.length >= 9) return phone.slice(-9);
  return phone;
}

export function memberHasPhone(member: Member) {
  return Boolean(normalizePhone(member.phone));
}

export function memberByPhone(members: Member[], raw: string) {
  const exact = normalizePhone(raw);
  const key = phoneKey(raw);
  if (!key) return undefined;
  const withPhone = members.filter((member) => phoneKey(member.phone));
  const sameKey = withPhone.filter((member) => phoneKey(member.phone) === key);
  if (sameKey.length === 1) return sameKey[0];
  if (exact) return sameKey.find((member) => normalizePhone(member.phone) === exact);
  return undefined;
}
