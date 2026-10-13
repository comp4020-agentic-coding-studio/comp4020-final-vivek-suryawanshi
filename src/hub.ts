import type { ServerResponse } from "node:http";

// Every connected browser gets every update pushed to it as it happens; no
// polling, no per-client state beyond the open response stream.
export class Hub {
  #clients = new Set<ServerResponse>();

  add(res: ServerResponse): void {
    this.#clients.add(res);
  }

  remove(res: ServerResponse): void {
    this.#clients.delete(res);
  }

  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.#clients) {
      client.write(payload);
    }
  }
}
