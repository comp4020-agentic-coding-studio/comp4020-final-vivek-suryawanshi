import { JSDOM } from "jsdom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAtlas } from "../src/public/cosmos/atlas.js";

// Confirms the client renders observation text as literal characters (via
// textContent) rather than interpreting it as markup, both for the initial
// fetch-on-open and for a live update pushed over SSE.
const dom = new JSDOM(
  "<!doctype html><ul id='list'></ul><form id='form'><textarea id='input'></textarea><span id='count'></span></form>",
);
const { document } = dom.window;
(globalThis as unknown as { document: Document }).document = document;

const listEl = document.getElementById("list") as HTMLUListElement;
const formEl = document.getElementById("form") as HTMLFormElement;
const textareaEl = document.getElementById("input") as HTMLTextAreaElement;
const charCountEl = document.getElementById("count") as HTMLSpanElement;

const payload = `<script>alert(1)</script><img src=x onerror="alert(1)">`;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ observations: [] }),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  listEl.replaceChildren();
});

it("renders a <script>/onerror observation pushed over SSE as literal text, never as markup", async () => {
  const atlas = createAtlas({ listEl, formEl, textareaEl, charCountEl });
  await atlas.open("earth");

  atlas.handleStreamEvent("observation-added", {
    observation: { id: 1, objectId: "earth", text: payload, createdAt: "now", updatedAt: null, mine: false },
  });

  const textNode = listEl.querySelector(".observation-text");
  expect(textNode).toBeTruthy();
  expect(textNode!.textContent).toBe(payload);
  // If this were ever assigned via innerHTML, a real <script> element would
  // appear here instead of escaped text — this asserts it doesn't.
  expect(textNode!.querySelector("script")).toBeNull();
  expect(textNode!.innerHTML).toContain("&lt;script&gt;");
});
