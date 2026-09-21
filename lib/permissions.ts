import type { Member, Role } from "./types";

export function isAdmin(user?: Member | null) {
  return user?.role === "admin";
}

export function isLeader(user?: Member | null) {
  return user?.role === "leader" || user?.role === "admin";
}

export function can(user: Member | null | undefined, action: Action) {
  if (!user) return false;
  const map: Record<Action, Role[]> = {
    manageMembers: ["admin"],
    assignRoles: ["admin"],
    createEvent: ["admin"],
    editEvent: ["admin"],
    sendInvites: ["admin"],
    triggerIvr: ["admin"],
    uploadBackground: ["admin"],
    viewRsvps: ["admin", "leader"],
    uploadSummary: ["admin", "leader"],
    postAnnouncement: ["admin", "leader"],
    rsvp: ["admin", "leader", "member"],
    uploadMedia: ["admin", "leader", "member"],
    chat: ["admin", "leader", "member"],
  };
  return map[action].includes(user.role);
}

export type Action =
  | "manageMembers"
  | "assignRoles"
  | "createEvent"
  | "editEvent"
  | "sendInvites"
  | "triggerIvr"
  | "uploadBackground"
  | "viewRsvps"
  | "uploadSummary"
  | "postAnnouncement"
  | "rsvp"
  | "uploadMedia"
  | "chat";
