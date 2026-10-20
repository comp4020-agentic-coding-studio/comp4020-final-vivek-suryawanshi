import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb,
  hasPendingDelivery,
  getHistory,
  getOpenDeliveryBowler,
  getPlayerName,
  setPlayerName,
  recordDelivery,
  recordPrediction,
  type Call,
} from "./db.ts";
import { Hub } from "./hub.ts";
import { renderReadme } from "./readme.ts";
import { logJoined, logDelivered, logPredicted, logRejectedOwnDelivery, logRevealed } from "./log.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DB_PATH ?? "/data/final-over.db";

const db = openDb(dbPath);
const hub = new Hub();

const indexHtml = readFileSync(join(__dirname, "public", "index.html"), "utf8");
const clientJs = readFileSync(join(__dirname, "public", "client.js"), "utf8");
const styleCss = readFileSync(join(__dirname, "public", "style.css"), "utf8");
const readmeHtml = renderReadme(readFileSync(join(repoRoot, "README.md"), "utf8"));
const readmePage = `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Final Over — README</title>
  </head>
  <body>
    ${readmeHtml}
  </body>
</html>
`;

function isCall(value: unknown): value is Call {
  return value === "fast" || value === "slow";
}

const HISTORY_LIMIT = 10;
const ID_COOKIE = "fo_id";
const MAX_NAME_LENGTH = 40;

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

// Every request gets a stable anonymous id — set here if the browser didn't
// already send one — so ownership (who bowled this delivery) and naming can
// both be keyed off it. A HttpOnly cookie, so a page script can't read or
// forge another visitor's id.
function identify(req: IncomingMessage, res: ServerResponse): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[ID_COOKIE];
  if (existing) return existing;

  const id = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 365;
  res.setHeader("Set-Cookie", `${ID_COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
  return id;
}

// A pending delivery is secret until a prediction is locked in — otherwise a
// browser that receives this on load, or over the live stream, could just
// read the answer off it. getHistory() only ever returns rounds where both
// calls are already in, so there's no delivery value here to withhold: a
// pending round simply isn't a row this query can return.
interface ClientRound {
  id: number;
  delivery: Call;
  prediction: Call;
  bowlerName: string;
  predictorName: string;
  result: "hit" | "miss";
}

interface ClientState {
  pending: boolean;
  history: ClientRound[];
}

function buildState(): ClientState {
  const history = getHistory(db, HISTORY_LIMIT).map((round) => ({
    id: round.id,
    delivery: round.delivery as Call,
    prediction: round.prediction as Call,
    bowlerName: round.bowlerName ?? "Anonymous",
    predictorName: round.predictorName ?? "Anonymous",
    result: (round.delivery === round.prediction ? "hit" : "miss") as "hit" | "miss",
  }));
  return { pending: hasPendingDelivery(db), history };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  send(res, status, "application/json", JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const visitorId = identify(req, res);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      send(res, 200, "text/html; charset=utf-8", indexHtml);
      return;
    }

    if (req.method === "GET" && url.pathname === "/client.js") {
      send(res, 200, "text/javascript; charset=utf-8", clientJs);
      return;
    }

    if (req.method === "GET" && url.pathname === "/style.css") {
      send(res, 200, "text/css; charset=utf-8", styleCss);
      return;
    }

    if (req.method === "GET" && url.pathname === "/readme/") {
      send(res, 200, "text/html; charset=utf-8", readmePage);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, buildState());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      sendJson(res, 200, { name: getPlayerName(db, visitorId) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/me") {
      const body = (await readJson(req)) as { name?: unknown };
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > MAX_NAME_LENGTH) {
        sendJson(res, 400, {
          error: `name must be between 1 and ${MAX_NAME_LENGTH} characters`,
        });
        return;
      }
      const isNew = setPlayerName(db, visitorId, name);
      if (isNew) logJoined(name, visitorId);
      sendJson(res, 200, { name });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: state\ndata: ${JSON.stringify(buildState())}\n\n`);
      hub.add(res);
      req.on("close", () => hub.remove(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/deliver") {
      const body = (await readJson(req)) as { delivery?: unknown };
      if (!isCall(body.delivery)) {
        sendJson(res, 400, { error: "delivery must be 'fast' or 'slow'" });
        return;
      }
      const delivered = recordDelivery(db, body.delivery, visitorId);
      if (!delivered) {
        sendJson(res, 409, { error: "a delivery is already pending" });
        return;
      }
      logDelivered(getPlayerName(db, visitorId), visitorId);
      const state = buildState();
      hub.broadcast("state", state);
      sendJson(res, 200, state);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/predict") {
      const body = (await readJson(req)) as { prediction?: unknown };
      if (!isCall(body.prediction)) {
        sendJson(res, 400, { error: "prediction must be 'fast' or 'slow'" });
        return;
      }

      const open = getOpenDeliveryBowler(db);
      if (open && open.bowlerId === visitorId) {
        logRejectedOwnDelivery(getPlayerName(db, visitorId), visitorId);
        sendJson(res, 403, { error: "you can't predict your own delivery" });
        return;
      }

      const updated = recordPrediction(db, body.prediction, visitorId);
      if (!updated) {
        sendJson(res, 409, { error: "no open delivery to predict against" });
        return;
      }
      logPredicted(getPlayerName(db, visitorId), visitorId);
      if (updated.bowlerId) {
        logRevealed(
          getPlayerName(db, updated.bowlerId),
          updated.bowlerId,
          getPlayerName(db, visitorId),
          visitorId,
          updated.delivery as Call,
          updated.prediction as Call,
          updated.delivery === updated.prediction ? "hit" : "miss",
        );
      }
      const state = buildState();
      hub.broadcast("state", state);
      sendJson(res, 200, state);
      return;
    }

    send(res, 404, "text/plain", "not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "internal error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Final Over listening on 0.0.0.0:${port}, db at ${dbPath}`);
});
