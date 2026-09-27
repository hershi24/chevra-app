import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import webpush from "web-push";
import { canSeeChannel } from "./channels";
import type { AppState, Message } from "./types";

const DIR = path.join(process.cwd(), "data");
const KEY_FILE = path.join(DIR, "vapid.json");
const SUB_FILE = path.join(DIR, "push-subscriptions.json");
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:invite@bazman.homes";

export type PushSubscriptionRecord = {
  memberId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const g = globalThis as unknown as {
  __chevraVapid?: { publicKey: string; privateKey: string };
  __chevraPushWrite?: Promise<void>;
};

export function loadVapidKeys() {
  if (g.__chevraVapid) return g.__chevraVapid;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (publicKey && privateKey) {
    g.__chevraVapid = { publicKey, privateKey };
    return g.__chevraVapid;
  }
  mkdirSync(DIR, { recursive: true });
  if (existsSync(KEY_FILE)) {
    g.__chevraVapid = JSON.parse(readFileSync(KEY_FILE, "utf8")) as {
      publicKey: string;
      privateKey: string;
    };
    return g.__chevraVapid;
  }
  const generated = webpush.generateVAPIDKeys();
  try {
    writeFileSync(KEY_FILE, JSON.stringify(generated), { encoding: "utf8", flag: "wx" });
    g.__chevraVapid = generated;
  } catch {
    g.__chevraVapid = JSON.parse(readFileSync(KEY_FILE, "utf8")) as {
      publicKey: string;
      privateKey: string;
    };
  }
  return g.__chevraVapid;
}

function readSubscriptions(): PushSubscriptionRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(SUB_FILE, "utf8")) as PushSubscriptionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSubscriptions(mutator: (rows: PushSubscriptionRecord[]) => PushSubscriptionRecord[]) {
  const run = (g.__chevraPushWrite ?? Promise.resolve()).then(async () => {
    mkdirSync(DIR, { recursive: true });
    const next = mutator(readSubscriptions());
    writeFileSync(SUB_FILE, JSON.stringify(next), "utf8");
  });
  g.__chevraPushWrite = run.then(
    () => undefined,
    () => undefined
  );
  await run;
}

export async function savePushSubscription(record: PushSubscriptionRecord) {
  await writeSubscriptions((rows) => {
    const rest = rows.filter((row) => row.endpoint !== record.endpoint);
    return [...rest, record];
  });
}

export async function removePushSubscription(memberId: string, endpoint: string) {
  await writeSubscriptions((rows) => rows.filter((row) => row.endpoint !== endpoint || row.memberId !== memberId));
}

function notificationBody(message: Message) {
  const text =
    message.text.trim() ||
    message.poll?.question ||
    (message.voiceUrl ? "הודעה קולית" : message.attachments.length ? "קובץ מצורף" : "הודעה חדשה");
  return text.slice(0, 180);
}

export async function notifyChatPush(state: AppState, message: Message) {
  try {
    const channel = state.channels.find((item) => item.id === message.channelId);
    if (!channel) return;
    const keys = loadVapidKeys();
    webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
    const author = state.members.find((member) => member.id === message.authorId);
    const payload = JSON.stringify({
      title: author?.displayName || "הודעה חדשה",
      body: notificationBody(message),
      url: `/chat/${message.channelId}`,
      messageId: message.id,
    });
    const targets = readSubscriptions().filter((row) => {
      if (row.memberId === message.authorId) return false;
      const member = state.members.find((item) => item.id === row.memberId);
      return Boolean(member && canSeeChannel(member, channel));
    });
    const dead: string[] = [];
    await Promise.all(
      targets.map(async (row) => {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, payload, {
            TTL: 60 * 60 * 12,
            urgency: "high",
            timeout: 8000,
          });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(row.endpoint);
          else console.error("push failed", status ?? error);
        }
      })
    );
    if (dead.length) {
      await writeSubscriptions((rows) => rows.filter((row) => !dead.includes(row.endpoint)));
    }
  } catch (error) {
    console.error("push notify failed", error);
  }
}
