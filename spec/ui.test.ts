import { JSDOM } from "jsdom";
import { expect, inject, it } from "vitest";
import { OBJECTS } from "../src/public/cosmos/distances.js";

// Keyboard/phone-width behaviour itself needs a real browser (see the
// Discovery Atlas's manual verification pass) — JSDOM doesn't run WebGL or
// focus management the way a browser does. What's checked here is the
// scaffolding that makes that behaviour possible: a real <dialog> (native
// focus trap + Escape-to-close) and a list that will hold one real <button>
// per object (Tab-reachable, Enter-activatable without custom key handling).
const baseUrl = inject("baseUrl");

it("lists exactly the 7 objects from the brief", () => {
  const ids = OBJECTS.map((o) => o.id).sort();
  expect(ids).toEqual(
    ["andromeda", "betelgeuse", "earth", "gaia-bh1", "great-wall", "quipu", "saturn"].sort(),
  );
});

it("serves a page with a native <dialog> panel and a keyboard-reachable object list container", async () => {
  const res = await fetch(new URL("/", baseUrl));
  const html = await res.text();
  const { document } = new JSDOM(html).window;

  const dialog = document.getElementById("object-panel");
  expect(dialog?.tagName.toLowerCase()).toBe("dialog");
  expect(dialog?.getAttribute("aria-labelledby")).toBe("panel-name");

  expect(document.getElementById("panel-close")?.tagName.toLowerCase()).toBe("button");
  expect(document.getElementById("object-list-wrap")?.tagName.toLowerCase()).toBe("nav");
  expect(document.getElementById("object-list")).toBeTruthy();
});
