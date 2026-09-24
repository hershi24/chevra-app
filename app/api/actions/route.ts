import { NextResponse } from "next/server";
import type { ActionBody } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { canSeeChannel, ensureGuideChannels } from "@/lib/channels";
import { can, canDeleteMessage } from "@/lib/permissions";
import { updateState, toPublicState } from "@/lib/store";
import type { AppState, Channel, Gathering, Member, Message } from "@/lib/types";

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
        location: body.location.trim(),
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
    case "uploadMedia": {
      if (!can(me, "uploadMedia")) throw new Error("forbidden");
      const event = s.gatherings.find((g) => g.id === body.eventId);
      if (!event) throw new Error("החברה לא נמצאה");
      event.media.push({ ...body.media, uploadedBy: me.id, createdAt: new Date().toISOString() });
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
        email: body.email?.trim() || `${body.username}@chevra.local`,
        avatarColor: ["#0F766E", "#B45309", "#1D4ED8", "#7C3AED"][s.members.length % 4],
        initials: body.displayName.trim().slice(0, 2),
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
    case "setRole": {
      if (!can(me, "assignRoles")) throw new Error("forbidden");
      const member = s.members.find((m) => m.id === body.memberId);
      if (!member) throw new Error("החבר לא נמצא");
      if (member.id === me.id && body.role !== "admin") {
        throw new Error("לא ניתן להסיר מעצמך הרשאת מנהל");
      }
      member.role = body.role;
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
