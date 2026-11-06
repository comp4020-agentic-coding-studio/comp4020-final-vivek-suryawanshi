import type { ServerResponse } from "node:http";

// Every connected browser gets every update pushed to it as it happens; no
// polling, no per-client state beyond the open response stream and the
// visitor id it connected with (needed so a broadcast can tailor a field
// like "mine" per recipient without a second round trip).
export class Hub {
  #clients = new Map<ServerResponse, string>();

  add(res: ServerResponse, visitorId: string): void {
    this.#clients.set(res, visitorId);
  }

  remove(res: ServerResponse): void {
    this.#clients.delete(res);
  }

  // `data` is either a fixed payload or a function of the recipient's
  // visitor id, for events (like a new observation) whose "mine" field
  // differs per browser.
  broadcast(event: string, data: unknown | ((visitorId: string) => unknown)): void {
    const build = typeof data === "function" ? (data as (visitorId: string) => unknown) : () => data;
    for (const [client, visitorId] of this.#clients) {
      client.write(`event: ${event}\ndata: ${JSON.stringify(build(visitorId))}\n\n`);
    }
  }
}
