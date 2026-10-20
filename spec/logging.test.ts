import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  logJoined,
  logDelivered,
  logPredicted,
  logRejectedOwnDelivery,
  logRevealed,
} from "../src/log.ts";

// Unit-level, not against the running app: the one thing that must never
// happen — a pending delivery's value reaching stdout — can't be checked
// reliably against a possibly-remote CI container's console, so this calls
// the logging functions directly and inspects exactly what they print.
let lines: string[] = [];

beforeEach(() => {
  lines = [];
  vi.spyOn(console, "log").mockImplementation((msg: string) => {
    lines.push(msg);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("logs a delivery without ever printing the delivery value", () => {
  logDelivered("Alice", "abcd1234-xxxx");

  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/delivered/i);
  expect(lines[0]).toMatch(/\(value hidden\)/i);
  expect(lines[0]).toContain("Alice");
  expect(lines[0]).not.toMatch(/fast/i);
  expect(lines[0]).not.toMatch(/slow/i);
});

it("logs a join with name and short id", () => {
  logJoined("Bob", "deadbeef-yyyy");
  expect(lines[0]).toMatch(/joined/i);
  expect(lines[0]).toContain("Bob");
  expect(lines[0]).toContain("deadbeef");
  expect(lines[0]).not.toContain("deadbeef-yyyy");
});

it("logs a prediction with name and short id", () => {
  logPredicted("Carol", "11112222-zzzz");
  expect(lines[0]).toMatch(/predicted/i);
  expect(lines[0]).toContain("Carol");
});

it("logs a rejected own-delivery prediction", () => {
  logRejectedOwnDelivery("Dave", "33334444-wwww");
  expect(lines[0]).toMatch(/rejected/i);
  expect(lines[0]).toMatch(/own delivery/i);
  expect(lines[0]).toContain("Dave");
});

it("logs a reveal with both calls and the result, once both are public", () => {
  logRevealed("Alice", "abcd1234-xxxx", "Bob", "deadbeef-yyyy", "fast", "slow", "miss");
  expect(lines[0]).toMatch(/revealed/i);
  expect(lines[0]).toContain("fast");
  expect(lines[0]).toContain("slow");
  expect(lines[0]).toMatch(/miss/i);
  expect(lines[0]).toContain("Alice");
  expect(lines[0]).toContain("Bob");
});

it("falls back to Anonymous for a player with no name on file", () => {
  logDelivered(null, "abcd1234-xxxx");
  expect(lines[0]).toContain("Anonymous");
});
