type Client = {
  send: (data: string) => void;
  memberId?: string;
};

const g = globalThis as unknown as { __chevraClients?: Set<Client> };

if (!g.__chevraClients) {
  g.__chevraClients = new Set();
}

const clients = g.__chevraClients;

export function onlineMemberIds() {
  return [...new Set([...clients].map((client) => client.memberId).filter(Boolean))] as string[];
}

function emitPresence() {
  const payload = `data: ${JSON.stringify({ type: "presence", ids: onlineMemberIds() })}\n\n`;
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}

function connectionsFor(memberId?: string) {
  if (!memberId) return 0;
  let count = 0;
  for (const client of clients) if (client.memberId === memberId) count += 1;
  return count;
}

export function subscribe(
  client: Client,
  hooks?: { onFirst?: () => void; onLast?: () => void }
) {
  const first = Boolean(client.memberId) && connectionsFor(client.memberId) === 0;
  clients.add(client);
  if (first) hooks?.onFirst?.();
  emitPresence();
  return () => {
    clients.delete(client);
    const last = Boolean(client.memberId) && connectionsFor(client.memberId) === 0;
    if (last) hooks?.onLast?.();
    emitPresence();
  };
}

export function emitUpdate(revision: number) {
  const payload = `data: ${JSON.stringify({ type: "update", revision })}\n\n`;
  for (const client of clients) {
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function emitToMembers(memberIds: Iterable<string>, event: Record<string, unknown>) {
  const targets = new Set(memberIds);
  if (!targets.size) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    if (!client.memberId || !targets.has(client.memberId)) continue;
    try {
      client.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}
