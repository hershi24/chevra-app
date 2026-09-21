type Client = {
  send: (data: string) => void;
};

const g = globalThis as unknown as { __chevraClients?: Set<Client> };

if (!g.__chevraClients) {
  g.__chevraClients = new Set();
}

const clients = g.__chevraClients;

export function subscribe(client: Client) {
  clients.add(client);
  return () => {
    clients.delete(client);
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
