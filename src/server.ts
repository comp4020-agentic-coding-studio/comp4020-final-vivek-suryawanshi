import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openDb,
  getOpenOrLatestRound,
  recordDelivery,
  recordPrediction,
  type Call,
  type Round,
} from "./db.ts";
import { Hub } from "./hub.ts";
import { renderReadme } from "./readme.ts";

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

// The delivery is secret until a prediction is locked in — otherwise a
// predicting browser that receives the live state could just read the
// answer off it. Once both calls are in, the round is revealed in full.
interface ClientRound {
  id: number;
  awaitingPrediction: boolean;
  delivery: Call | null;
  prediction: Call | null;
  result: "hit" | "miss" | null;
}

function toClientRound(round: Round | null): ClientRound | null {
  if (!round) return null;
  const revealed = round.prediction !== null;
  return {
    id: round.id,
    awaitingPrediction: round.delivery !== null && !revealed,
    delivery: revealed ? round.delivery : null,
    prediction: round.prediction,
    result:
      revealed && round.delivery !== null
        ? round.delivery === round.prediction
          ? "hit"
          : "miss"
        : null,
  };
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
      sendJson(res, 200, { round: toClientRound(getOpenOrLatestRound(db)) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const round = toClientRound(getOpenOrLatestRound(db));
      res.write(`event: state\ndata: ${JSON.stringify({ round })}\n\n`);
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
      const round = toClientRound(recordDelivery(db, body.delivery));
      hub.broadcast("state", { round });
      sendJson(res, 200, { round });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/predict") {
      const body = (await readJson(req)) as { prediction?: unknown };
      if (!isCall(body.prediction)) {
        sendJson(res, 400, { error: "prediction must be 'fast' or 'slow'" });
        return;
      }
      const updated = recordPrediction(db, body.prediction);
      if (!updated) {
        sendJson(res, 409, { error: "no open delivery to predict against" });
        return;
      }
      const round = toClientRound(updated);
      hub.broadcast("state", { round });
      sendJson(res, 200, { round });
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
