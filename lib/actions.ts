import type { Gathering, Message, Role, RsvpStatus } from "./types";

export type ActionBody =
  | { type: "rsvp"; eventId: string; status: RsvpStatus }
  | {
      type: "createEvent";
      title?: string;
      startsAt: string;
      location: string;
      hostId: string;
      kibudId?: string;
      lecturerId?: string;
      topic?: string;
      notes?: string;
    }
  | { type: "updateEvent"; eventId: string; patch: Partial<Gathering> }
  | { type: "cancelEvent"; eventId: string }
  | { type: "uploadMedia"; eventId?: string; media: Gathering["media"][number] }
  | { type: "deleteMedia"; eventId?: string; mediaId: string }
  | { type: "saveSummary"; eventId: string; summary?: string; audioUrl?: string }
  | {
      type: "sendMessage";
      channelId: string;
      text: string;
      quote?: Message["quote"];
      mentions?: string[];
      attachments?: Message["attachments"];
      voiceUrl?: string;
    }
  | { type: "react"; messageId: string; emoji: string }
  | { type: "deleteMessage"; messageId: string }
  | { type: "createDm"; memberId: string }
  | {
      type: "addMember";
      username: string;
      displayName: string;
      phone?: string;
      email?: string;
      role?: Role;
    }
  | {
      type: "updateMember";
      memberId: string;
      patch: {
        username?: string;
        displayName?: string;
        phone?: string;
        email?: string;
        role?: Role;
      };
    }
  | { type: "removeMember"; memberId: string }
  | { type: "setRole"; memberId: string; role: Role }
  | { type: "changePassword"; currentPassword: string; newPassword: string }
  | { type: "resetMemberPassword"; memberId: string }
  | { type: "setBackground"; backgroundImageId: string | null }
  | { type: "addBackground"; url: string; label: string; fromGatheringId?: string };
