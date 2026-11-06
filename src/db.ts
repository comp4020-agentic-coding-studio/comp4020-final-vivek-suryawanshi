import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Observation {
  id: number;
  objectId: string;
  authorId: string;
  text: string;
  createdAt: string;
  updatedAt: string | null;
}

function rowToObservation(row: Record<string, unknown>): Observation {
  return {
    id: row.id as number,
    objectId: row.object_id as string,
    authorId: row.author_id as string,
    text: row.text as string,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);
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

export function getObservations(db: DatabaseSync, objectId: string): Observation[] {
  const rows = db
    .prepare(`SELECT * FROM observations WHERE object_id = ? ORDER BY id ASC`)
    .all(objectId) as Record<string, unknown>[];
  return rows.map(rowToObservation);
}

export function addObservation(
  db: DatabaseSync,
  objectId: string,
  authorId: string,
  text: string,
): Observation {
  db.prepare(`INSERT INTO observations (object_id, author_id, text) VALUES (?, ?, ?)`).run(
    objectId,
    authorId,
    text,
  );
  const row = db.prepare(`SELECT * FROM observations ORDER BY id DESC LIMIT 1`).get() as Record<
    string,
    unknown
  >;
  return rowToObservation(row);
}

export function getObservation(db: DatabaseSync, id: number): Observation | null {
  const row = db.prepare(`SELECT * FROM observations WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToObservation(row) : null;
}

// Caller checks ownership before calling this — update/delete here never
// take an authorId to compare against, so the 403 decision can't accidentally
// move into the data layer and be forgotten by a future caller.
export function updateObservation(db: DatabaseSync, id: number, text: string): Observation | null {
  const existing = getObservation(db, id);
  if (!existing) return null;
  db.prepare(`UPDATE observations SET text = ?, updated_at = datetime('now') WHERE id = ?`).run(
    text,
    id,
  );
  return getObservation(db, id);
}

export function deleteObservation(db: DatabaseSync, id: number): boolean {
  const result = db.prepare(`DELETE FROM observations WHERE id = ?`).run(id);
  return result.changes > 0;
}
