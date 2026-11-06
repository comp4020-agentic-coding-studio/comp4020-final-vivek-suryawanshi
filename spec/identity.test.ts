import { expect, inject, it } from "vitest";

// Ownership is keyed by the anonymous cookie each browser gets, so this
// simulates two different browsers by capturing two different Set-Cookie
// values and replaying each as a Cookie header — same pattern a real browser
// follows automatically.
const baseUrl = inject("baseUrl");
const OBJECT_ID = "earth";

async function newCookie(): Promise<string> {
  const res = await fetch(new URL("/", baseUrl));
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("expected / to set an identity cookie");
  return setCookie.split(";")[0];
}

function request(path: string, init: RequestInit, cookie: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    ...init,
    headers: { ...init.headers, Cookie: cookie },
  });
}

function post(path: string, body: unknown, cookie: string): Promise<Response> {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, cookie);
}

async function addObservation(cookie: string, text: string): Promise<{ id: number }> {
  const res = await post(`/api/objects/${OBJECT_ID}/observations`, { text }, cookie);
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.observation;
}

it("lets only the author edit their own observation", async () => {
  const author = await newCookie();
  const other = await newCookie();
  const observation = await addObservation(author, "Original text");

  const rejected = await request(
    `/api/objects/${OBJECT_ID}/observations/${observation.id}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Hijacked" }) },
    other,
  );
  expect(rejected.status).toBe(403);

  const allowed = await request(
    `/api/objects/${OBJECT_ID}/observations/${observation.id}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Edited by author" }) },
    author,
  );
  expect(allowed.status).toBe(200);
  const body = await allowed.json();
  expect(body.observation.text).toBe("Edited by author");
});

it("lets only the author delete their own observation", async () => {
  const author = await newCookie();
  const other = await newCookie();
  const observation = await addObservation(author, "To be deleted");

  const rejected = await request(
    `/api/objects/${OBJECT_ID}/observations/${observation.id}`,
    { method: "DELETE" },
    other,
  );
  expect(rejected.status).toBe(403);

  const stillThere = await request(`/api/objects/${OBJECT_ID}/observations`, { method: "GET" }, author);
  const stillThereBody = await stillThere.json();
  expect(stillThereBody.observations.some((o: { id: number }) => o.id === observation.id)).toBe(true);

  const allowed = await request(
    `/api/objects/${OBJECT_ID}/observations/${observation.id}`,
    { method: "DELETE" },
    author,
  );
  expect(allowed.status).toBe(200);

  const after = await request(`/api/objects/${OBJECT_ID}/observations`, { method: "GET" }, author);
  const afterBody = await after.json();
  expect(afterBody.observations.some((o: { id: number }) => o.id === observation.id)).toBe(false);
});

it("marks an observation as mine only for its author", async () => {
  const author = await newCookie();
  const other = await newCookie();
  const observation = await addObservation(author, "Whose is this?");

  const asAuthor = await request(`/api/objects/${OBJECT_ID}/observations`, { method: "GET" }, author);
  const asAuthorBody = await asAuthor.json();
  const mine = asAuthorBody.observations.find((o: { id: number }) => o.id === observation.id);
  expect(mine.mine).toBe(true);

  const asOther = await request(`/api/objects/${OBJECT_ID}/observations`, { method: "GET" }, other);
  const asOtherBody = await asOther.json();
  const theirs = asOtherBody.observations.find((o: { id: number }) => o.id === observation.id);
  expect(theirs.mine).toBe(false);

  // No author name (or id) is ever serialised to the client.
  expect(mine).not.toHaveProperty("authorName");
  expect(mine).not.toHaveProperty("authorId");
});
