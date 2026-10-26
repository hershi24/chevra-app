import type { Member } from "./types";

/** Israeli numbers as 05… so a Yemot caller and a member card match. */
export function normalizePhone(value: string) {
  let digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

export function memberByPhone(members: Member[], raw: string) {
  const phone = normalizePhone(raw);
  if (!phone) return undefined;
  return members.find((member) => normalizePhone(member.phone) === phone);
}
