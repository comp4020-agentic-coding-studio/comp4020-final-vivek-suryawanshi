import { beforeEach, expect, inject, it } from "vitest";

// Crit 10: a person can't predict a delivery they bowled. Ownership is keyed
// by the anonymous cookie each browser gets, so this simulates two different
// browsers by capturing two different Set-Cookie values and replaying each as
// a Cookie header — same pattern a real browser follows automatically.
const baseUrl = inject("baseUrl");

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

// Drain any stray pending delivery before every test, same approach as
// game.test.ts, so each test starts from a known state even if an earlier
// one in this file failed partway through and left a round open.
beforeEach(async () => {
  const cookie = await newCookie();
  for (;;) {
    const res = await post("/api/predict", { prediction: "slow" }, cookie);
    if (res.status === 409) break;
  }
});

it("rejects the bowler's own prediction with 403 and a clear message", async () => {
  const bowler = await newCookie();

  const delivered = await post("/api/deliver", { delivery: "fast" }, bowler);
  expect(delivered.status).toBe(200);

  const res = await post("/api/predict", { prediction: "fast" }, bowler);
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/own delivery/i);

  // The round is still open for someone else — clean it up.
  const other = await newCookie();
  await post("/api/predict", { prediction: "fast" }, other);
});

it("lets someone other than the bowler predict the same delivery", async () => {
  const bowler = await newCookie();
  const other = await newCookie();

  const delivered = await post("/api/deliver", { delivery: "slow" }, bowler);
  expect(delivered.status).toBe(200);

  const res = await post("/api/predict", { prediction: "slow" }, other);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.history[0]).toMatchObject({ delivery: "slow", prediction: "slow", result: "hit" });
});

it("still rejects a prediction with no open delivery (own or otherwise)", async () => {
  const cookie = await newCookie();
  const res = await post("/api/predict", { prediction: "fast" }, cookie);
  expect(res.status).toBe(409);
});
