import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Call = "fast" | "slow";

export interface Round {
  id: number;
  delivery: Call | null;
  prediction: Call | null;
  createdAt: string;
}

function rowToRound(row: Record<string, unknown>): Round {
  return {
    id: row.id as number,
    delivery: (row.delivery as Call | null) ?? null,
    prediction: (row.prediction as Call | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery TEXT,
      prediction TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

// The open round is the latest one still missing either call; a finished
// round (both calls made) stays as history and the next delivery starts a
// fresh row.
export function getOpenOrLatestRound(db: DatabaseSync): Round | null {
  const row = db
    .prepare(
      `SELECT * FROM rounds
       WHERE delivery IS NULL OR prediction IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;
  if (row) return rowToRound(row);

  const latest = db.prepare(`SELECT * FROM rounds ORDER BY id DESC LIMIT 1`).get() as
    | Record<string, unknown>
    | undefined;
  return latest ? rowToRound(latest) : null;
}

export function recordDelivery(db: DatabaseSync, delivery: Call): Round {
  // A delivery always starts a new round, even if the previous one never
  // got a prediction.
  db.prepare(`INSERT INTO rounds (delivery) VALUES (?)`).run(delivery);
  const row = db.prepare(`SELECT * FROM rounds ORDER BY id DESC LIMIT 1`).get() as Record<
    string,
    unknown
  >;
  return rowToRound(row);
}

export function recordPrediction(db: DatabaseSync, prediction: Call): Round | null {
  const open = db
    .prepare(
      `SELECT * FROM rounds WHERE delivery IS NOT NULL AND prediction IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;
  if (!open) return null;

  db.prepare(`UPDATE rounds SET prediction = ? WHERE id = ?`).run(prediction, open.id as number);
  const row = db.prepare(`SELECT * FROM rounds WHERE id = ?`).get(open.id as number) as Record<
    string,
    unknown
  >;
  return rowToRound(row);
}
