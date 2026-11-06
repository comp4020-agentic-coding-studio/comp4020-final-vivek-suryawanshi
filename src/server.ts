import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, sep } from "node:path";
import {
  openDb,
  getPlayerName,
  setPlayerName,
  getObservations,
  addObservation,
  getObservation,
  updateObservation,
  deleteObservation,
} from "./db.ts";
import { Hub } from "./hub.ts";
import { renderReadme } from "./readme.ts";
import {
  logJoined,
  logOpened,
  logObservationAdded,
  logObservationEdited,
  logObservationDeleted,
  logRejected,
} from "./log.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const port = Number(process.env.PORT ?? 8080);
const dbPath = process.env.DB_PATH ?? "/data/cosmos.db";

const db = openDb(dbPath);
const hub = new Hub();

const indexHtml = readFileSync(join(__dirname, "public", "index.html"), "utf8");
const styleCss = readFileSync(join(__dirname, "public", "style.css"), "utf8");
const objectsJson = readFileSync(join(__dirname, "content", "objects.json"), "utf8");
const readmeHtml = renderReadme(readFileSync(join(repoRoot, "README.md"), "utf8"));
const readmePage = `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>COSMOS — README</title>
  </head>
  <body>
    ${readmeHtml}
  </body>
</html>
`;

const ID_COOKIE = "cosmos_id";
const MAX_NAME_LENGTH = 40;
const MAX_OBSERVATION_LENGTH = 280;

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
// already send one — so ownership (who wrote this observation) and naming
// can both be keyed off it. A HttpOnly cookie, so a page script can't read
// or forge another visitor's id.
function identify(req: IncomingMessage, res: ServerResponse): string {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[ID_COOKIE];
  if (existing) return existing;

  const id = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 365;
  res.setHeader("Set-Cookie", `${ID_COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
  return id;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function send(res: ServerResponse, status: number, contentType: string, body: string | Buffer): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  send(res, status, "application/json", JSON.stringify(data));
}

// Attribution on the wire is never a name — only whether the viewer wrote
// it. The client renders "you" or "an explorer" from this flag; who actually
// wrote it is resolved server-side for log lines only, never serialised.
// objectId rides along so a broadcast — sent to every connected client
// regardless of which panel they have open — lets each browser filter to the
// object it cares about.
interface ClientObservation {
  id: number;
  objectId: string;
  text: string;
  createdAt: string;
  updatedAt: string | null;
  mine: boolean;
}

function toClientObservation(
  observation: {
    id: number;
    objectId: string;
    text: string;
    createdAt: string;
    updatedAt: string | null;
    authorId: string;
  },
  viewerId: string,
): ClientObservation {
  return {
    id: observation.id,
    objectId: observation.objectId,
    text: observation.text,
    createdAt: observation.createdAt,
    updatedAt: observation.updatedAt,
    mine: observation.authorId === viewerId,
  };
}

// Static assets served from node_modules (three's ESM build and the
// OrbitControls addon) and from src/public/cosmos/ (our own client modules).
// No bundler: both are read straight off disk and served as-is.
const VENDOR_FILES: Record<string, string> = {
  "/vendor/three.module.js": join(repoRoot, "node_modules", "three", "build", "three.module.js"),
  "/vendor/OrbitControls.js": join(
    repoRoot,
    "node_modules",
    "three",
    "examples",
    "jsm",
    "controls",
    "OrbitControls.js",
  ),
};

const cosmosDir = join(__dirname, "public", "cosmos");
const cosmosAssetsDir = join(cosmosDir, "assets");

const ASSET_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// src/public/cosmos/*.js (our client modules) and src/public/cosmos/assets/*
// (texture images for Task 3) are both served straight off disk, with the
// same path-traversal guard; which directory a request resolves into decides
// whether it's read as UTF-8 JS or raw binary image bytes.
function serveCosmosFile(res: ServerResponse, pathname: string): boolean {
  if (!pathname.startsWith("/cosmos/")) return false;
  const rel = pathname.slice("/cosmos/".length);
  // Reject traversal and anything that isn't a plain relative path under
  // this dir — pathname is attacker-controlled, so no ".." segments.
  if (!rel || rel.includes("..")) {
    send(res, 404, "text/plain", "not found");
    return true;
  }

  if (rel.startsWith("assets/")) {
    const assetRel = rel.slice("assets/".length);
    const filePath = normalize(join(cosmosAssetsDir, assetRel));
    const ext = extname(filePath);
    const contentType = ASSET_CONTENT_TYPES[ext];
    if (!filePath.startsWith(cosmosAssetsDir) || !existsSync(filePath) || !contentType) {
      send(res, 404, "text/plain", "not found");
      return true;
    }
    send(res, 200, contentType, readFileSync(filePath));
    return true;
  }

  if (rel.includes(sep) || rel.includes("/")) {
    send(res, 404, "text/plain", "not found");
    return true;
  }
  const filePath = normalize(join(cosmosDir, rel));
  if (!filePath.startsWith(cosmosDir) || !existsSync(filePath) || extname(filePath) !== ".js") {
    send(res, 404, "text/plain", "not found");
    return true;
  }
  send(res, 200, "text/javascript; charset=utf-8", readFileSync(filePath, "utf8"));
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const visitorId = identify(req, res);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      send(res, 200, "text/html; charset=utf-8", indexHtml);
      return;
    }

    if (req.method === "GET" && url.pathname === "/style.css") {
      send(res, 200, "text/css; charset=utf-8", styleCss);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/objects") {
      send(res, 200, "application/json", objectsJson);
      return;
    }

    if (req.method === "GET" && url.pathname in VENDOR_FILES) {
      send(res, 200, "text/javascript; charset=utf-8", readFileSync(VENDOR_FILES[url.pathname], "utf8"));
      return;
    }

    if (req.method === "GET" && serveCosmosFile(res, url.pathname)) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/readme/") {
      send(res, 200, "text/html; charset=utf-8", readmePage);
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
      // A comment-only SSE line, just to flush the headers immediately —
      // otherwise Node holds them until the first real write, and a client
      // awaiting the response (or its headers) hangs until the next
      // broadcast happens to come along.
      res.write(": connected\n\n");
      hub.add(res, visitorId);
      req.on("close", () => hub.remove(res));
      return;
    }

    const observationsMatch = url.pathname.match(/^\/api\/objects\/([^/]+)\/observations\/?$/);
    if (observationsMatch) {
      const objectId = decodeURIComponent(observationsMatch[1]);

      if (req.method === "GET") {
        logOpened(objectId, getPlayerName(db, visitorId), visitorId);
        const observations = getObservations(db, objectId).map((o) => toClientObservation(o, visitorId));
        sendJson(res, 200, { observations });
        return;
      }

      if (req.method === "POST") {
        const body = (await readJson(req)) as { text?: unknown };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > MAX_OBSERVATION_LENGTH) {
          sendJson(res, 400, {
            error: `text must be between 1 and ${MAX_OBSERVATION_LENGTH} characters`,
          });
          return;
        }
        const created = addObservation(db, objectId, visitorId, text);
        logObservationAdded(getPlayerName(db, visitorId), visitorId, objectId);
        const payload = (viewerId: string) => ({ observation: toClientObservation(created, viewerId) });
        hub.broadcast("observation-added", payload);
        sendJson(res, 201, payload(visitorId));
        return;
      }
    }

    const observationMatch = url.pathname.match(/^\/api\/objects\/([^/]+)\/observations\/(\d+)\/?$/);
    if (observationMatch) {
      const objectId = decodeURIComponent(observationMatch[1]);
      const obsId = Number(observationMatch[2]);
      const existing = getObservation(db, obsId);

      if (!existing || existing.objectId !== objectId) {
        sendJson(res, 404, { error: "observation not found" });
        return;
      }

      if (req.method === "PATCH") {
        if (existing.authorId !== visitorId) {
          logRejected(getPlayerName(db, visitorId), visitorId, objectId, "edit");
          sendJson(res, 403, { error: "only the author can edit this observation" });
          return;
        }
        const body = (await readJson(req)) as { text?: unknown };
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > MAX_OBSERVATION_LENGTH) {
          sendJson(res, 400, {
            error: `text must be between 1 and ${MAX_OBSERVATION_LENGTH} characters`,
          });
          return;
        }
        const updated = updateObservation(db, obsId, text)!;
        logObservationEdited(getPlayerName(db, visitorId), visitorId, objectId);
        const payload = (viewerId: string) => ({ observation: toClientObservation(updated, viewerId) });
        hub.broadcast("observation-edited", payload);
        sendJson(res, 200, payload(visitorId));
        return;
      }

      if (req.method === "DELETE") {
        if (existing.authorId !== visitorId) {
          logRejected(getPlayerName(db, visitorId), visitorId, objectId, "delete");
          sendJson(res, 403, { error: "only the author can delete this observation" });
          return;
        }
        deleteObservation(db, obsId);
        logObservationDeleted(getPlayerName(db, visitorId), visitorId, objectId);
        hub.broadcast("observation-deleted", { objectId, id: obsId });
        sendJson(res, 200, { objectId, id: obsId });
        return;
      }
    }

    send(res, 404, "text/plain", "not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "internal error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`COSMOS listening on 0.0.0.0:${port}, db at ${dbPath}`);
});
