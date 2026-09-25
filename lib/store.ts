import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createSeed } from "./seed";
import { emitUpdate } from "./realtime";
import { isSupabaseEnabled } from "./supabase";
import { canSeeChannel } from "./channels";
import {
  bootstrapChatIfEmpty,
  loadChatFromSupabase,
  loadMembersFromSupabase,
  syncChatDiff,
  upsertMembers,
} from "./supabase-chat";
import { ensureMemberSecrets, publicMember } from "./password";
import { loadGatheringsFromSupabase, loadTokensFromSupabase, syncGatheringsDiff } from "./supabase-gatherings";
import type { AppState, Member, PublicState } from "./types";

const FILE = process.env.VERCEL
  ? path.join("/tmp", "meine-chevra-store.json")
  : path.join(process.cwd(), "data", "store.json");

const g = globalThis as unknown as {
  __chevraCache?: AppState;
  __chevraWrite?: Promise<void>;
};

async function persist(state: AppState) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
}

async function loadJson(): Promise<AppState> {
  if (g.__chevraCache) return g.__chevraCache;
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as AppState;
    if (ensureMemberSecrets(parsed.members)) await persist(parsed);
    g.__chevraCache = parsed;
    return g.__chevraCache;
  } catch {
    const seeded = createSeed();
    g.__chevraCache = seeded;
    await persist(seeded);
    return seeded;
  }
}

export async function readState(): Promise<AppState> {
  const json = await loadJson();
  if (!json.gallery) json.gallery = [];
  if (ensureMemberSecrets(json.members)) await persist(json);
  if (!isSupabaseEnabled()) return json;

  const state = structuredClone(json);
  try {
    await bootstrapChatIfEmpty(state);
    const [chat, members] = await Promise.all([
      loadChatFromSupabase(),
      loadMembersFromSupabase(),
    ]);
    if (members?.length) {
      const local = new Map(state.members.map((member) => [member.id, member]));
      state.members = members.map((member) => {
        const previous = local.get(member.id);
        return {
          ...member,
          passwordHash: member.passwordHash || previous?.passwordHash,
          mustChangePassword: member.passwordHash
            ? member.mustChangePassword
            : (previous?.mustChangePassword ?? true),
        };
      });
      ensureMemberSecrets(state.members);
    } else if (state.members.length) {
      await upsertMembers(state.members);
    }
    if (chat) {
      state.channels = chat.channels;
      state.messages = chat.messages;
    }
    if (!state.gallery) state.gallery = [];
    const cloud = await loadGatheringsFromSupabase();
    if (cloud) {
      state.gallery = cloud.gallery;
      if (cloud.gatherings.length) {
        state.gatherings = cloud.gatherings;
      } else {
        const seedIds = new Set(["g-next", "g-past-1", "g-past-2", "g-past-3"]);
        const custom = state.gatherings.filter((event) => !seedIds.has(event.id));
        state.gatherings = custom;
        if (custom.length) {
          await syncGatheringsDiff({ ...state, gatherings: [] }, state);
        }
      }
      const cloudTokens = await loadTokensFromSupabase();
      if (cloudTokens) {
        const known = new Set(cloudTokens.map((row) => row.token));
        const live = new Set(state.gatherings.map((event) => event.id));
        const extras = state.tokens.filter((row) => live.has(row.eventId) && !known.has(row.token));
        state.tokens = [...cloudTokens, ...extras];
        if (extras.length) {
          await syncGatheringsDiff({ ...state, tokens: cloudTokens }, state);
        }
      }
    }
  } catch (error) {
    console.error("Supabase chat read failed", error);
  }
  return state;
}

export async function persistQuietly(
  mutator: (state: AppState) => boolean
): Promise<void> {
  const run = (g.__chevraWrite ?? Promise.resolve()).then(async () => {
    const current = structuredClone(await readState());
    const before = structuredClone(current);
    if (!mutator(current)) return;
    g.__chevraCache = current;
    await persist(current);
    if (isSupabaseEnabled()) {
      try {
        await syncChatDiff(before, current);
        await syncGatheringsDiff(before, current);
      } catch (error) {
        console.error("Supabase chat write failed", error);
      }
    }
  });
  g.__chevraWrite = run.then(
    () => undefined,
    () => undefined
  );
  await run;
}

export async function updateState(
  mutator: (state: AppState) => void
): Promise<AppState> {
  const run = (g.__chevraWrite ?? Promise.resolve()).then(async () => {
    const current = structuredClone(await readState());
    const before = structuredClone(current);
    mutator(current);
    current.revision += 1;
    g.__chevraCache = current;
    await persist(current);
    if (isSupabaseEnabled()) {
      try {
        await syncChatDiff(before, current);
        await syncGatheringsDiff(before, current);
      } catch (error) {
        console.error("Supabase chat write failed", error);
        throw new Error("השמירה בענן נכשלה. נסו שוב.");
      }
    }
    emitUpdate(current.revision);
    return current;
  });
  g.__chevraWrite = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function toPublicState(state: AppState, me: Member): PublicState {
  const channels = state.channels.filter((channel) => canSeeChannel(me, channel));
  const visible = new Set(channels.map((channel) => channel.id));
  return {
    members: state.members.map(publicMember),
    gatherings: state.gatherings,
    gallery: state.gallery ?? [],
    channels,
    messages: state.messages.filter((message) => visible.has(message.channelId)),
    settings: state.settings,
    emailLog: state.emailLog,
    ivrLog: state.ivrLog,
    revision: state.revision,
    me: publicMember(me),
  };
}

export function upcomingGathering(state: AppState) {
  const now = Date.now();
  return (
    state.gatherings
      .filter((gth) => gth.status === "upcoming" && new Date(gth.startsAt).getTime() >= now - 3 * 3600_000)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ?? null
  );
}

export function pastGatherings(state: AppState) {
  return state.gatherings
    .filter((gth) => gth.status === "past" || new Date(gth.startsAt).getTime() < Date.now() - 3 * 3600_000)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
}
