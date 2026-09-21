import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createSeed } from "./seed";
import { emitUpdate } from "./realtime";
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

export async function readState(): Promise<AppState> {
  if (g.__chevraCache) return g.__chevraCache;
  try {
    const raw = await readFile(FILE, "utf8");
    g.__chevraCache = JSON.parse(raw) as AppState;
    return g.__chevraCache;
  } catch {
    const seeded = createSeed();
    g.__chevraCache = seeded;
    await persist(seeded);
    return seeded;
  }
}

export async function updateState(
  mutator: (state: AppState) => void
): Promise<AppState> {
  const run = (g.__chevraWrite ?? Promise.resolve()).then(async () => {
    const current = structuredClone(await readState());
    mutator(current);
    current.revision += 1;
    g.__chevraCache = current;
    await persist(current);
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
  return {
    members: state.members,
    gatherings: state.gatherings,
    channels: state.channels,
    messages: state.messages,
    settings: state.settings,
    emailLog: state.emailLog,
    ivrLog: state.ivrLog,
    revision: state.revision,
    me,
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
