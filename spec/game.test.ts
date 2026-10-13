import { expect, inject, it } from "vitest";

// Exercises the one real-time slice end to end: a delivery is picked, a
// prediction is locked in, and the result reaches an already-open SSE stream
// — the same path two separate browsers would take — without polling.
const baseUrl = inject("baseUrl");

async function waitForEvent(stream: ReadableStreamDefaultReader<Uint8Array>): Promise<unknown> {
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await stream.read();
    if (done) throw new Error("stream closed before an event arrived");
    buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(/data: (.+)\n\n/);
    if (match) return JSON.parse(match[1]);
  }
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("keeps the delivery secret until a prediction is locked in, then shows it in history", async () => {
  const before = await fetch(new URL("/api/state", baseUrl)).then((r) => r.json());

  const res = await fetch(new URL("/api/stream", baseUrl));
  const reader = res.body!.getReader();

  // The initial push on connect.
  await waitForEvent(reader);

  const delivered = await post("/api/deliver", { delivery: "fast" }).then((r) => r.json());
  expect(delivered.pending).toBe(true);
  expect(delivered.history).toEqual(before.history);

  const afterDeliver = (await waitForEvent(reader)) as {
    pending: boolean;
    history: unknown[];
  };
  expect(afterDeliver.pending).toBe(true);
  expect(afterDeliver.history).toEqual(before.history);

  const predicted = await post("/api/predict", { prediction: "fast" }).then((r) => r.json());
  expect(predicted.pending).toBe(false);
  expect(predicted.history[0]).toMatchObject({ delivery: "fast", prediction: "fast", result: "hit" });

  const afterPredict = (await waitForEvent(reader)) as {
    pending: boolean;
    history: { delivery: string; prediction: string; result: string }[];
  };
  expect(afterPredict.pending).toBe(false);
  expect(afterPredict.history[0]).toMatchObject({
    delivery: "fast",
    prediction: "fast",
    result: "hit",
  });

  await reader.cancel();
});

it("never sends a pending delivery's value in the state a page loads", async () => {
  const before = await fetch(new URL("/api/state", baseUrl)).then((r) => r.json());

  const delivered = await post("/api/deliver", { delivery: "slow" }).then((r) => r.json());

  // The whole response, from every route that can report this round, has
  // exactly two top-level fields: no "delivery", "currentDelivery" or similar
  // ever exists on the wire for a pending round, so there's nothing to
  // accidentally serialise.
  expect(Object.keys(delivered).sort()).toEqual(["history", "pending"]);
  expect(delivered.pending).toBe(true);
  // A pending round isn't a finished one, so it cannot appear in history —
  // the list is exactly what it was before this delivery.
  expect(delivered.history).toEqual(before.history);

  const state = await fetch(new URL("/api/state", baseUrl)).then((r) => r.json());
  expect(Object.keys(state).sort()).toEqual(["history", "pending"]);
  expect(state.pending).toBe(true);
  expect(state.history).toEqual(before.history);

  // Clean up the pending round so later tests start from a known state.
  await post("/api/predict", { prediction: "slow" });
});

it("reports a miss when the prediction doesn't match the delivery", async () => {
  await post("/api/deliver", { delivery: "slow" });

  const res = await post("/api/predict", { prediction: "fast" });
  const state = await res.json();
  expect(state.history[0]).toMatchObject({ delivery: "slow", prediction: "fast", result: "miss" });
});

it("rejects a prediction with no open delivery", async () => {
  // Drain any open round from a previous test by delivering+predicting once,
  // then try to predict again with nothing open.
  await post("/api/deliver", { delivery: "fast" });
  await post("/api/predict", { prediction: "fast" });

  const res = await post("/api/predict", { prediction: "slow" });
  expect(res.status).toBe(409);
});

it("lists at most the 10 most recent finished rounds, newest first", async () => {
  for (let i = 0; i < 12; i++) {
    await post("/api/deliver", { delivery: "fast" });
    await post("/api/predict", { prediction: i % 2 === 0 ? "fast" : "slow" });
  }

  const res = await fetch(new URL("/api/state", baseUrl));
  const state = await res.json();

  expect(state.history.length).toBe(10);
  expect(state.history[0].id).toBeGreaterThan(state.history[9].id);
});
