import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { openDb, getHistory } from "../src/db.ts";

// A redeploy runs openDb() against the live Fly volume, which already has
// rounds from before bowler_id/predictor_id existed. This builds a database
// file by hand with exactly the pre-crit-10 schema, then checks openDb()
// upgrades it in place without losing — or choking on — what's already there.
let dir: string;
let dbPath: string;
let opened: DatabaseSync[] = [];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "final-over-migration-"));
  dbPath = join(dir, "final-over.db");
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

it("opens an old-schema database, adds the missing columns, and keeps old rounds as Anonymous", () => {
  const legacy = new DatabaseSync(dbPath);
  opened.push(legacy);
  legacy.exec(`
    CREATE TABLE rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery TEXT,
      prediction TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  legacy.prepare(`INSERT INTO rounds (delivery, prediction) VALUES ('fast', 'fast')`).run();
  legacy.close();

  const db = openDb(dbPath);
  opened.push(db);

  const columns = db.prepare(`PRAGMA table_info(rounds)`).all() as { name: string }[];
  const names = columns.map((c) => c.name);
  expect(names).toContain("bowler_id");
  expect(names).toContain("predictor_id");

  const history = getHistory(db, 10);
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    delivery: "fast",
    prediction: "fast",
    bowlerName: null,
    predictorName: null,
  });
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
