import type { AppState, Channel, Member } from "./types";

export function isGeneralChannel(channel: Channel) {
  return channel.id === "c-general" || channel.name === "כללי";
}

export function isRoshChevra(user?: Member | null) {
  return user?.role === "leader";
}

export function isGuideChannel(channel: Channel, members: Member[] = []) {
  if (channel.description === "ראש החברה") return true;
  if (channel.type !== "dm" || channel.memberIds.length !== 2) return false;
  const pair = channel.memberIds.map((id) => members.find((member) => member.id === id));
  return pair.some((member) => member?.role === "leader") && pair.some((member) => member && member.role !== "leader");
}

export function canSeeChannel(user: Member, channel: Channel) {
  if (!channel.memberIds.includes(user.id)) return false;
  if (isRoshChevra(user) && isGeneralChannel(channel)) return false;
  return true;
}

export function guideChatTitle(channel: Channel, me: Member, members: Member[]) {
  if (isRoshChevra(me)) {
    const other = members.find((member) => channel.memberIds.includes(member.id) && member.id !== me.id);
    return other?.displayName ?? channel.name;
  }
  return "ראש החברה";
}

export function ensureGuideChannels(state: AppState): boolean {
  let changed = false;
  const leaders = state.members.filter((member) => member.role === "leader");
  const others = state.members.filter((member) => member.role !== "leader");

  for (const channel of state.channels) {
    if (!isGeneralChannel(channel)) continue;
    if (channel.type !== "group") {
      channel.type = "group";
      changed = true;
    }
    const allowed = new Set(others.map((member) => member.id));
    const kept = channel.memberIds.filter((id) => allowed.has(id));
    const missing = others.map((member) => member.id).filter((id) => !kept.includes(id));
    const next = [...kept, ...missing];
    if (next.length !== channel.memberIds.length || next.some((id, index) => channel.memberIds[index] !== id)) {
      channel.memberIds = next;
      changed = true;
    }
  }

  for (const leader of leaders) {
    for (const member of others) {
      const existing = state.channels.find(
        (channel) =>
          channel.type === "dm" &&
          channel.memberIds.length === 2 &&
          channel.memberIds.includes(leader.id) &&
          channel.memberIds.includes(member.id)
      );
      if (existing) {
        if (existing.description !== "ראש החברה") {
          existing.description = "ראש החברה";
          changed = true;
        }
        continue;
      }
      state.channels.push({
        id: `c-guide-${leader.id}-${member.id}`,
        name: `${member.displayName} וראש החברה`,
        type: "dm",
        description: "ראש החברה",
        memberIds: [leader.id, member.id],
      });
      changed = true;
    }
  }

  return changed;
}
