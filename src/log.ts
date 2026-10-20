import type { Call } from "./db.ts";

// First 8 chars of a cookie id — enough to tell two people apart in a log
// line without printing the whole thing.
export function shortId(id: string): string {
  return id.slice(0, 8);
}

function displayName(name: string | null): string {
  return name ?? "Anonymous";
}

function line(text: string): void {
  console.log(`${new Date().toISOString()} ${text}`);
}

export function logJoined(name: string, id: string): void {
  line(`joined: ${name} (${shortId(id)})`);
}

// Never takes the delivery value — there's no parameter here to carry it,
// even by mistake.
export function logDelivered(name: string | null, id: string): void {
  line(`delivered (value hidden): ${displayName(name)} (${shortId(id)})`);
}

export function logPredicted(name: string | null, id: string): void {
  line(`predicted: ${displayName(name)} (${shortId(id)})`);
}

export function logRejectedOwnDelivery(name: string | null, id: string): void {
  line(`rejected: own delivery — ${displayName(name)} (${shortId(id)})`);
}

export function logRevealed(
  bowlerName: string | null,
  bowlerId: string,
  predictorName: string | null,
  predictorId: string,
  delivery: Call,
  prediction: Call,
  result: "hit" | "miss",
): void {
  line(
    `revealed: ${delivery} vs ${prediction}, ${result} — ` +
      `${displayName(bowlerName)} (${shortId(bowlerId)}) bowled, ` +
      `${displayName(predictorName)} (${shortId(predictorId)}) predicted`,
  );
}
