import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { openDb, addObservation, getObservations } from "../src/db.ts";

let dir: string;
let dbPath: string;
let opened: DatabaseSync[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cosmos-db-"));
  dbPath = join(dir, "cosmos.db");
  opened = [];
});

afterEach(() => {
  // SQLite keeps the file open until closed — Windows refuses to remove a
  // directory containing an open file, so every handle this test opened
  // (directly or via openDb) must be closed before cleanup.
  for (const db of opened) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

it("creates the players and observations tables on a fresh database", () => {
  const db = openDb(dbPath);
  opened.push(db);

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .all() as { name: string }[];
  const names = tables.map((t) => t.name);
  expect(names).toContain("players");
  expect(names).toContain("observations");

  const observation = addObservation(db, "earth", "visitor-1", "Hello COSMOS");
  expect(observation).toMatchObject({ objectId: "earth", authorId: "visitor-1", text: "Hello COSMOS" });
  expect(getObservations(db, "earth")).toHaveLength(1);
});

it("is idempotent — opening an already-migrated database twice doesn't fail", () => {
  const first = openDb(dbPath);
  opened.push(first);
  first.close();
  opened.pop();

  const second = openDb(dbPath);
  opened.push(second);
  expect(second).toBeTruthy();
});
