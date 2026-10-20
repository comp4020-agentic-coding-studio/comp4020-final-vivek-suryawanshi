import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Call = "fast" | "slow";

export interface Round {
  id: number;
  delivery: Call | null;
  prediction: Call | null;
  bowlerId: string | null;
  predictorId: string | null;
  createdAt: string;
}

export interface HistoryRound extends Round {
  bowlerName: string | null;
  predictorName: string | null;
}

function rowToRound(row: Record<string, unknown>): Round {
  return {
    id: row.id as number,
    delivery: (row.delivery as Call | null) ?? null,
    prediction: (row.prediction as Call | null) ?? null,
    bowlerId: (row.bowler_id as string | null) ?? null,
    predictorId: (row.predictor_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToHistoryRound(row: Record<string, unknown>): HistoryRound {
  return {
    ...rowToRound(row),
    bowlerName: (row.bowler_name as string | null) ?? null,
    predictorName: (row.predictor_name as string | null) ?? null,
  };
}

// SQLite has no `ADD COLUMN IF NOT EXISTS`, and a redeploy runs this against
// the live volume's existing rows, so each column is added only if a prior
// version of the schema doesn't already have it.
function ensureColumn(db: DatabaseSync, table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensureColumn(db, "rounds", "bowler_id", "TEXT");
  ensureColumn(db, "rounds", "predictor_id", "TEXT");
  return db;
}

export function getPlayerName(db: DatabaseSync, id: string): string | null {
  const row = db.prepare(`SELECT name FROM players WHERE id = ?`).get(id) as
    | { name: string | null }
    | undefined;
  return row?.name ?? null;
}

// True the first time this id gets a name — the caller logs "joined" only then.
export function setPlayerName(db: DatabaseSync, id: string, name: string): boolean {
  const existing = db.prepare(`SELECT name FROM players WHERE id = ?`).get(id) as
    | { name: string | null }
    | undefined;
  const isNew = existing === undefined || existing.name === null;
  db.prepare(
    `INSERT INTO players (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  ).run(id, name);
  return isNew;
}

// Whether a delivery is sitting unmatched. Callers never learn its value
// from this — the row isn't read, just whether one exists.
export function hasPendingDelivery(db: DatabaseSync): boolean {
  const row = db
    .prepare(`SELECT 1 FROM rounds WHERE delivery IS NOT NULL AND prediction IS NULL LIMIT 1`)
    .get();
  return row !== undefined;
}

// Who bowled the pending round, for the "no predicting your own delivery"
// check — selects only id/bowler_id, never delivery, so this can't leak the
// hidden value even by accident.
export function getOpenDeliveryBowler(
  db: DatabaseSync,
): { id: number; bowlerId: string | null } | null {
  const row = db
    .prepare(
      `SELECT id, bowler_id FROM rounds WHERE delivery IS NOT NULL AND prediction IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as { id: number; bowler_id: string | null } | undefined;
  if (!row) return null;
  return { id: row.id, bowlerId: row.bowler_id };
}

// Only rounds with both calls made: a pending delivery, by construction, can
// never appear here, so there's no field to blank out or forget to blank out.
// Names come from a left join so rounds predating identity (or bowled by a
// player who never set a name) still show up, as "Anonymous".
export function getHistory(db: DatabaseSync, limit: number): HistoryRound[] {
  const rows = db
    .prepare(
      `SELECT rounds.*, bowler.name AS bowler_name, predictor.name AS predictor_name
       FROM rounds
       LEFT JOIN players AS bowler ON bowler.id = rounds.bowler_id
       LEFT JOIN players AS predictor ON predictor.id = rounds.predictor_id
       WHERE rounds.delivery IS NOT NULL AND rounds.prediction IS NOT NULL
       ORDER BY rounds.id DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToHistoryRound);
}

// First click wins (ADR 0001): while a round is open, any other delivery is
// rejected rather than starting a second one or replacing the waiting call —
// otherwise the batter could end up predicting against a delivery that
// changed after they'd already seen it was pending.
export function recordDelivery(db: DatabaseSync, delivery: Call, bowlerId: string): Round | null {
  if (hasPendingDelivery(db)) return null;

  db.prepare(`INSERT INTO rounds (delivery, bowler_id) VALUES (?, ?)`).run(delivery, bowlerId);
  const row = db.prepare(`SELECT * FROM rounds ORDER BY id DESC LIMIT 1`).get() as Record<
    string,
    unknown
  >;
  return rowToRound(row);
}

export function recordPrediction(
  db: DatabaseSync,
  prediction: Call,
  predictorId: string,
): Round | null {
  const open = db
    .prepare(
      `SELECT * FROM rounds WHERE delivery IS NOT NULL AND prediction IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as Record<string, unknown> | undefined;
  if (!open) return null;

  db.prepare(`UPDATE rounds SET prediction = ?, predictor_id = ? WHERE id = ?`).run(
    prediction,
    predictorId,
    open.id as number,
  );
  const row = db.prepare(`SELECT * FROM rounds WHERE id = ?`).get(open.id as number) as Record<
    string,
    unknown
  >;
  return rowToRound(row);
}
