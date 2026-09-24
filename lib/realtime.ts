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

export function subscribe(client: Client) {
  clients.add(client);
  emitPresence();
  return () => {
    clients.delete(client);
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
