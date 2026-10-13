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

it("keeps the delivery secret until a prediction is locked in", async () => {
  const res = await fetch(new URL("/api/stream", baseUrl));
  const reader = res.body!.getReader();

  // The initial push on connect.
  await waitForEvent(reader);

  const delivered = await fetch(new URL("/api/deliver", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivery: "fast" }),
  }).then((r) => r.json());
  expect(delivered.round.delivery).toBeNull();
  expect(delivered.round.awaitingPrediction).toBe(true);

  const afterDeliver = (await waitForEvent(reader)) as { round: { delivery: string | null } };
  expect(afterDeliver.round.delivery).toBeNull();

  const predicted = await fetch(new URL("/api/predict", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prediction: "fast" }),
  }).then((r) => r.json());
  expect(predicted.round.delivery).toBe("fast");
  expect(predicted.round.result).toBe("hit");

  const afterPredict = (await waitForEvent(reader)) as {
    round: { delivery: string; prediction: string; result: string };
  };
  expect(afterPredict.round.result).toBe("hit");
  expect(afterPredict.round.delivery).toBe("fast");
  expect(afterPredict.round.prediction).toBe("fast");

  await reader.cancel();
});

it("reports a miss when the prediction doesn't match the delivery", async () => {
  await fetch(new URL("/api/deliver", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivery: "slow" }),
  });

  const res = await fetch(new URL("/api/predict", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prediction: "fast" }),
  });
  const { round } = await res.json();
  expect(round.result).toBe("miss");
});

it("rejects a prediction with no open delivery", async () => {
  // Drain any open round from a previous test by delivering+predicting once,
  // then try to predict again with nothing open.
  await fetch(new URL("/api/deliver", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivery: "fast" }),
  });
  await fetch(new URL("/api/predict", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prediction: "fast" }),
  });

  const res = await fetch(new URL("/api/predict", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prediction: "slow" }),
  });
  expect(res.status).toBe(409);
});
