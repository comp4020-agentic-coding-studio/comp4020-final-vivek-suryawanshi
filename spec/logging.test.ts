import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  logJoined,
  logOpened,
  logObservationAdded,
  logObservationEdited,
  logObservationDeleted,
  logRejected,
} from "../src/log.ts";

// Unit-level, not against the running app: this calls the logging functions
// directly and inspects exactly what they print.
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

it("logs a join with name and short id", () => {
  logJoined("Bob", "deadbeef-yyyy");
  expect(lines[0]).toMatch(/joined/i);
  expect(lines[0]).toContain("Bob");
  expect(lines[0]).toContain("deadbeef");
  expect(lines[0]).not.toContain("deadbeef-yyyy");
});

it("logs an object being opened, with the object id, name and short id", () => {
  logOpened("betelgeuse", "Alice", "abcd1234-xxxx");
  expect(lines[0]).toMatch(/opened/i);
  expect(lines[0]).toContain("betelgeuse");
  expect(lines[0]).toContain("Alice");
  expect(lines[0]).toContain("abcd1234");
  expect(lines[0]).not.toContain("abcd1234-xxxx");
});

it("logs an observation being added", () => {
  logObservationAdded("Carol", "11112222-zzzz", "earth");
  expect(lines[0]).toMatch(/added/i);
  expect(lines[0]).toContain("earth");
  expect(lines[0]).toContain("Carol");
});

it("logs an observation being edited", () => {
  logObservationEdited("Dave", "33334444-wwww", "saturn");
  expect(lines[0]).toMatch(/edited/i);
  expect(lines[0]).toContain("saturn");
  expect(lines[0]).toContain("Dave");
});

it("logs an observation being deleted", () => {
  logObservationDeleted("Erin", "55556666-vvvv", "quipu");
  expect(lines[0]).toMatch(/deleted/i);
  expect(lines[0]).toContain("quipu");
  expect(lines[0]).toContain("Erin");
});

it("logs a rejected edit/delete attempt by a non-author", () => {
  logRejected("Frank", "77778888-uuuu", "andromeda", "delete");
  expect(lines[0]).toMatch(/rejected/i);
  expect(lines[0]).toContain("andromeda");
  expect(lines[0]).toContain("Frank");
});

it("falls back to Anonymous for a player with no name on file", () => {
  logOpened("earth", null, "abcd1234-xxxx");
  expect(lines[0]).toContain("Anonymous");
});
