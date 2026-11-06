// Device-local preference, not server state: each browser remembers its own
// choice, and a toggle takes effect by reloading the page rather than trying
// to tear down and rebuild a live WebGL context in place.
const KEY = "cosmos:lowGraphics";

export function isLowGraphics() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLowGraphics(value) {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // private browsing / storage blocked: the toggle just won't persist
  }
}
