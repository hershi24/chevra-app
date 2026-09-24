import { NextResponse } from "next/server";
import type { ActionBody } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { canSeeChannel, ensureGuideChannels } from "@/lib/channels";
import { DEFAULT_PASSWORD, hashPassword, verifyPassword } from "@/lib/password";
import { can, canDeleteMedia, canDeleteMessage } from "@/lib/permissions";
import { updateState, toPublicState } from "@/lib/store";
import type { AppState, Channel, Gathering, Member, Message, Role } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as ActionBody;

  try {
    const state = await updateState((s) => {
      applyAction(s, me, body);
      ensureGuideChannels(s);
    });
    const fresh = state.members.find((m) => m.id === me.id)!;
    return NextResponse.json(toPublicState(state, fresh));
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה";
    const status = message === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function applyAction(s: AppState, me: Member, body: ActionBody) {
  switch (body.type) {
    case "rsvp": {
      if (!can(me, "rsvp")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      event.rsvps[me.id] = body.status;
      return;
    }
    case "createEvent": {
      if (!can(me, "createEvent")) throw new Error("forbidden");
      const rsvps: Gathering["rsvps"] = {};
      for (const member of s.members) rsvps[member.id] = "pending";
      const event: Gathering = {
        id: crypto.randomUUID(),
        title: body.title?.trim() ?? "",
        startsAt: body.startsAt,
        location: body.location?.trim() ?? "",
        hostId: body.hostId,
        kibudId: body.kibudId,
        lecturerId: body.lecturerId,
        topic: body.topic,
        notes: body.notes,
        status: "upcoming",
        rsvps,
        media: [],
      };
      s.gatherings.unshift(event);
      for (const member of s.members) {
        s.tokens.push({
          token: `tok-${member.id}-${event.id}`,
          eventId: event.id,
          memberId: member.id,
        });
      }
      return;
    }
    case "updateEvent": {
      if (!can(me, "editEvent")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      Object.assign(event, body.patch);
      return;
    }
    case "cancelEvent": {
      if (!can(me, "editEvent")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      event.status = "cancelled";
      return;
    }
    case "deleteGathering": {
      if (!can(me, "editEvent")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      if (!s.gallery) s.gallery = [];
      for (const item of event.media) {
        if (!s.gallery.some((media) => media.id === item.id)) s.gallery.push(item);
      }
      s.gatherings = s.gatherings.filter((item) => item.id !== event.id);
      s.tokens = s.tokens.filter((token) => token.eventId !== event.id);
      s.emailLog = s.emailLog.filter((entry) => entry.eventId !== event.id);
      s.ivrLog = s.ivrLog.filter((entry) => entry.eventId !== event.id);
      return;
    }
    case "uploadMedia": {
      if (!can(me, "uploadMedia")) throw new Error("forbidden");
      const media = { ...body.media, uploadedBy: me.id, createdAt: new Date().toISOString() };
      if (!body.eventId) {
        if (!s.gallery) s.gallery = [];
        s.gallery.push(media);
        return;
      }
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      event.media.push(media);
      return;
    }
    case "deleteMedia": {
      if (!can(me, "uploadMedia")) throw new Error("forbidden");
      if (!s.gallery) s.gallery = [];
      const loose = s.gallery.find((item) => item.id === body.mediaId);
      if (loose && (!body.eventId || !s.gatherings.some((event) => event.media.some((item) => item.id === body.mediaId)))) {
        if (!canDeleteMedia(me, loose)) throw new Error("forbidden");
        s.gallery = s.gallery.filter((item) => item.id !== loose.id);
        return;
      }
      const event = s.gatherings.find((g) => g.id === body.eventId) ?? s.gatherings.find((g) => g.media.some((item) => item.id === body.mediaId));
      const media = event?.media.find((item) => item.id === body.mediaId);
      if (!event || !media) throw new Error("המדיה לא נמצאה");
      if (!canDeleteMedia(me, media)) throw new Error("forbidden");
      event.media = event.media.filter((item) => item.id !== media.id);
      s.gallery = s.gallery.filter((item) => item.id !== media.id);
      return;
    }
    case "saveSummary": {
      if (!can(me, "uploadSummary")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      if (body.summary !== undefined) event.summary = body.summary;
      if (body.audioUrl !== undefined) event.audioUrl = body.audioUrl;
      return;
    }
    case "sendMessage": {
      if (!can(me, "chat")) throw new Error("forbidden");
      const channel = s.channels.find((c) => c.id === body.channelId);
      if (!channel) throw new Error("הערוץ לא נמצא");
      if (!canSeeChannel(me, channel)) throw new Error("forbidden");
      if (channel.type === "announcements" && !can(me, "postAnnouncement")) {
        throw new Error("רק מנהל או ראש החברה יכולים לכתוב בהודעות רשמיות");
      }
      const message: Message = {
        id: crypto.randomUUID(),
        channelId: body.channelId,
        authorId: me.id,
        text: body.text.trim(),
        createdAt: new Date().toISOString(),
        quote: body.quote,
        reactions: {},
        attachments: body.attachments ?? [],
        voiceUrl: body.voiceUrl,
        mentions: body.mentions ?? [],
      };
      s.messages.push(message);
      return;
    }
    case "deleteMessage": {
      if (!can(me, "chat")) throw new Error("forbidden");
      const message = s.messages.find((m) => m.id === body.messageId);
      if (!message) throw new Error("ההודעה לא נמצאה");
      const channel = s.channels.find((c) => c.id === message.channelId);
      if (!channel || !canSeeChannel(me, channel)) throw new Error("forbidden");
      if (!canDeleteMessage(me, message)) throw new Error("forbidden");
      s.messages = s.messages.filter((m) => m.id !== message.id);
      return;
    }
    case "react": {
      if (!can(me, "chat")) throw new Error("forbidden");
      const message = s.messages.find((m) => m.id === body.messageId);
      if (!message) throw new Error("ההודעה לא נמצאה");
      const channel = s.channels.find((c) => c.id === message.channelId);
      if (!channel || !canSeeChannel(me, channel)) throw new Error("forbidden");
      const list = message.reactions[body.emoji] ?? [];
      message.reactions[body.emoji] = list.includes(me.id)
        ? list.filter((id) => id !== me.id)
        : [...list, me.id];
      if (message.reactions[body.emoji].length === 0) {
        delete message.reactions[body.emoji];
      }
      return;
    }
    case "createDm": {
      if (!can(me, "chat")) throw new Error("forbidden");
      const other = s.members.find((m) => m.id === body.memberId);
      if (!other) throw new Error("החבר לא נמצא");
      const existing = s.channels.find(
        (c) =>
          c.type === "dm" &&
          c.memberIds.includes(me.id) &&
          c.memberIds.includes(other.id) &&
          c.memberIds.length === 2
      );
      if (existing) return;
      const channel: Channel = {
        id: crypto.randomUUID(),
        name: `${me.displayName} ו${other.displayName}`,
        type: "dm",
        memberIds: [me.id, other.id],
      };
      s.channels.push(channel);
      return;
    }
    case "addMember": {
      if (!can(me, "manageMembers")) throw new Error("forbidden");
      if (s.members.some((m) => m.username === body.username.trim())) {
        throw new Error("שם המשתמש כבר קיים");
      }
      const member: Member = {
        id: crypto.randomUUID(),
        username: body.username.trim(),
        displayName: body.displayName.trim(),
        role: body.role ?? "member",
        phone: body.phone?.trim() || "",
        email: body.email?.trim() || `${body.username.trim()}@chevra.local`,
        avatarColor: ["#0F766E", "#B45309", "#1D4ED8", "#7C3AED"][s.members.length % 4],
        initials: initialsFrom(body.displayName),
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        mustChangePassword: true,
      };
      s.members.push(member);
      for (const channel of s.channels) {
        if (channel.type !== "dm") channel.memberIds.push(member.id);
      }
      for (const event of s.gatherings) {
        if (event.status === "upcoming") event.rsvps[member.id] = "pending";
      }
      return;
    }
    case "updateMember": {
      if (!can(me, "manageMembers")) throw new Error("forbidden");
      const member = s.members.find((m) => m.id === body.memberId);
      if (!member) throw new Error("החבר לא נמצא");
      const username = body.patch.username?.trim();
      if (username && username !== member.username) {
        if (s.members.some((item) => item.id !== member.id && item.username === username)) {
          throw new Error("שם המשתמש כבר קיים");
        }
        member.username = username;
      }
      if (body.patch.displayName !== undefined) {
        const displayName = body.patch.displayName.trim();
        if (!displayName) throw new Error("נא למלא שם מלא");
        member.displayName = displayName;
        member.initials = initialsFrom(displayName);
      }
      if (body.patch.phone !== undefined) member.phone = body.patch.phone.trim();
      if (body.patch.email !== undefined) member.email = body.patch.email.trim();
      if (body.patch.role !== undefined) {
        applyRole(s, me, member, body.patch.role);
      }
      return;
    }
    case "removeMember": {
      if (!can(me, "manageMembers")) throw new Error("forbidden");
      const member = s.members.find((m) => m.id === body.memberId);
      if (!member) throw new Error("החבר לא נמצא");
      if (member.id === me.id) throw new Error("לא ניתן להסיר את עצמכם");
      if (member.role === "admin" && s.members.filter((item) => item.role === "admin").length <= 1) {
        throw new Error("חייב להישאר מנהל אחד לפחות");
      }
      s.members = s.members.filter((item) => item.id !== member.id);
      s.channels = s.channels.filter(
        (channel) => !(channel.type === "dm" && channel.memberIds.includes(member.id))
      );
      for (const channel of s.channels) {
        channel.memberIds = channel.memberIds.filter((id) => id !== member.id);
      }
      const channelIds = new Set(s.channels.map((channel) => channel.id));
      s.messages = s.messages.filter((message) => channelIds.has(message.channelId));
      s.tokens = s.tokens.filter((token) => token.memberId !== member.id);
      for (const event of s.gatherings) {
        delete event.rsvps[member.id];
      }
      return;
    }
    case "changePassword": {
      const member = s.members.find((item) => item.id === me.id);
      if (!member) throw new Error("החבר לא נמצא");
      if (!verifyPassword(body.currentPassword, member.passwordHash)) {
        throw new Error("הסיסמה הנוכחית לא נכונה");
      }
      const next = body.newPassword.trim();
      if (next.length < 4) throw new Error("הסיסמה החדשה צריכה לפחות 4 תווים");
      member.passwordHash = hashPassword(next);
      member.mustChangePassword = next === DEFAULT_PASSWORD;
      return;
    }
    case "resetMemberPassword": {
      if (!can(me, "manageMembers")) throw new Error("forbidden");
      const member = s.members.find((item) => item.id === body.memberId);
      if (!member) throw new Error("החבר לא נמצא");
      member.passwordHash = hashPassword(DEFAULT_PASSWORD);
      member.mustChangePassword = true;
      return;
    }
    case "setRole": {
      if (!can(me, "assignRoles")) throw new Error("forbidden");
      const member = s.members.find((m) => m.id === body.memberId);
      if (!member) throw new Error("החבר לא נמצא");
      applyRole(s, me, member, body.role);
      return;
    }
    case "setBackground": {
      if (!can(me, "uploadBackground")) throw new Error("forbidden");
      s.settings.backgroundImageId = body.backgroundImageId;
      return;
    }
    case "addBackground": {
      if (!can(me, "uploadBackground")) throw new Error("forbidden");
      s.settings.backgrounds.push({
        id: crypto.randomUUID(),
        url: body.url,
        label: body.label || "חברה קודמת",
        fromGatheringId: body.fromGatheringId,
      });
      return;
    }
    default:
      throw new Error("פעולה לא מוכרת");
  }
}

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
  return name.trim().slice(0, 2) || "?";
}

function applyRole(state: AppState, me: Member, member: Member, role: Role) {
  if (member.id === me.id && role !== "admin") {
    throw new Error("לא ניתן להסיר מעצמכם הרשאת מנהל");
  }
  if (
    member.role === "admin" &&
    role !== "admin" &&
    state.members.filter((item) => item.role === "admin").length <= 1
  ) {
    throw new Error("חייב להישאר מנהל אחד לפחות");
  }
  member.role = role;
}
