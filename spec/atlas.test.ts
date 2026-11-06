import { expect, inject, it } from "vitest";

// Exercises the Discovery Atlas end to end: observations persist in SQLite,
// and a second browser sees a new observation pushed over an already-open
// SSE stream within a second — the same real-time path Final Over's game
// used, now carrying Atlas events instead.
const baseUrl = inject("baseUrl");
const OBJECT_ID = "saturn";

async function newCookie(): Promise<string> {
  const res = await fetch(new URL("/", baseUrl));
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("expected / to set an identity cookie");
  return setCookie.split(";")[0];
}

function post(path: string, body: unknown, cookie: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

function get(path: string, cookie: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), { headers: { Cookie: cookie } });
}

async function waitForEvent(
  stream: ReadableStreamDefaultReader<Uint8Array>,
): Promise<{ event: string; data: unknown }> {
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await stream.read();
    if (done) throw new Error("stream closed before an event arrived");
    buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(/event: (.+)\ndata: (.+)\n\n/);
    if (match) return { event: match[1], data: JSON.parse(match[2]) };
  }
}

it("persists an observation so a later GET sees it", async () => {
  const cookie = await newCookie();
  const text = `Persisted observation ${Date.now()}`;

  const posted = await post(`/api/objects/${OBJECT_ID}/observations`, { text }, cookie);
  expect(posted.status).toBe(201);

  const fetched = await get(`/api/objects/${OBJECT_ID}/observations`, cookie);
  const body = await fetched.json();
  expect(body.observations.some((o: { text: string }) => o.text === text)).toBe(true);
});

it("pushes a new observation to a second, already-connected browser within a second", async () => {
  const author = await newCookie();
  const viewer = await newCookie();

  const res = await fetch(new URL("/api/stream", baseUrl), { headers: { Cookie: viewer } });
  const reader = res.body!.getReader();

  const text = `Live observation ${Date.now()}`;
  const posted = await post(`/api/objects/${OBJECT_ID}/observations`, { text }, author);
  expect(posted.status).toBe(201);

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 1000));
  const { event, data } = (await Promise.race([waitForEvent(reader), timeout])) as {
    event: string;
    data: { observation: { text: string; mine: boolean; objectId: string } };
  };

  expect(event).toBe("observation-added");
  expect(data.observation.text).toBe(text);
  expect(data.observation.objectId).toBe(OBJECT_ID);
  // The viewer didn't write this one.
  expect(data.observation.mine).toBe(false);

  await reader.cancel();
});

it("rejects an observation that's empty or too long", async () => {
  const cookie = await newCookie();

  const empty = await post(`/api/objects/${OBJECT_ID}/observations`, { text: "" }, cookie);
  expect(empty.status).toBe(400);

  const tooLong = await post(`/api/objects/${OBJECT_ID}/observations`, { text: "x".repeat(281) }, cookie);
  expect(tooLong.status).toBe(400);
});

// Safety: observation text is never interpreted as markup. The server
// stores and returns it byte-for-byte (no HTML-encoding of its own needed),
// because the client only ever assigns it via textContent, never
// innerHTML/insertAdjacentHTML.
it("stores and returns a <script>/onerror payload as literal text, unescaped on the wire", async () => {
  const cookie = await newCookie();
  const payload = `<script>alert(1)</script><img src=x onerror="alert(1)">`;

  const posted = await post(`/api/objects/${OBJECT_ID}/observations`, { text: payload }, cookie);
  expect(posted.status).toBe(201);
  const postedBody = await posted.json();
  expect(postedBody.observation.text).toBe(payload);

  const fetched = await get(`/api/objects/${OBJECT_ID}/observations`, cookie);
  const body = await fetched.json();
  const stored = body.observations.find((o: { text: string }) => o.text === payload);
  expect(stored).toBeTruthy();
});
