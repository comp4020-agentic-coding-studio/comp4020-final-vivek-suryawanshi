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

export function logOpened(objectId: string, name: string | null, id: string): void {
  line(`opened ${objectId}: ${displayName(name)} (${shortId(id)})`);
}

export function logObservationAdded(name: string | null, id: string, objectId: string): void {
  line(`added observation on ${objectId}: ${displayName(name)} (${shortId(id)})`);
}

export function logObservationEdited(name: string | null, id: string, objectId: string): void {
  line(`edited observation on ${objectId}: ${displayName(name)} (${shortId(id)})`);
}

export function logObservationDeleted(name: string | null, id: string, objectId: string): void {
  line(`deleted observation on ${objectId}: ${displayName(name)} (${shortId(id)})`);
}

export function logRejected(
  name: string | null,
  id: string,
  objectId: string,
  action: "edit" | "delete",
): void {
  line(`rejected: ${action} on ${objectId} by non-author — ${displayName(name)} (${shortId(id)})`);
}
