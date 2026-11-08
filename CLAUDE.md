# Rules for agents working on COSMOS

These rules come from what my README says good means for this app. CLAUDE.md is the main source of rules. AGENTS.md points here so Claude Code and Codex follow the same instructions.

## What you must not touch

- Don't create or edit README.md, PROCESS.md, CLAUDE.md, AGENTS.md, anything in docs/ or anything in reflections/ unless I specifically ask. I review and maintain those files myself.
- Don't commit, push or deploy. I review every change and commit it myself.
- Don't change identity, observation ownership, SSE or persistence unless I ask directly.
- The features are finished. Don't add more unless I ask.

## Promises the app must keep

- Only the author's browser can edit or delete an observation. The server checks ownership and returns 403 to anyone else. Hiding a button is not enough.
- Observation responses and SSE events must not expose an author's name or identity. The browser receives only `mine: true` or `false` for ownership. Names appear only in server logs.
- Show observation text as plain text using `textContent`, never as HTML. This includes text received over SSE.
- Observations must contain 1–280 characters after trimming, checked on the server.
- A new observation must appear in other open sessions viewing that destination within about a second, without reloading.
- Store observations in SQLite on the `/data` volume. They must survive restarts and redeploys. Database changes must preserve existing data.
- Switching destinations must not show notes from a previous destination. Live updates must not create duplicate notes.
- Failed submissions must keep the visitor's text and explain what went wrong.

## Science and honesty

- Don't invent facts, numbers or links. Open the sources used to support scientific claims. This applies to information panels, journey captions and size comparisons.
- If a claim cannot be verified, tell me and mark it `TODO: verify` in your report. Don't publish it as a confirmed fact.
- Keep the evidence labels honest: observed, reconstructed, simulated, or proposed, not confirmed.
- The Hercules–Corona Borealis Great Wall must always be described as proposed, not confirmed.
- Gaia BH1's black hole stays invisible. Only its companion star is drawn.
- Identify Quipu, the Great Wall and Andromeda as illustrative models. Don't present generated points as measured survey coordinates.
- Explain when sizes or distances are compressed.
- Size comparisons must preserve the diameter ratio at every zoom level. State when a value is an estimate.

## Assets

- Only use assets whose licences allow redistribution in a public repository.
- Record their sources, licences, attribution and modifications in src/content/CREDITS.md.
- Keep the visible texture attribution in the README.
- Keep textures small. Normal-mode textures should stay under about 1 MB in total.

## Who the app has to work for

- It must work smoothly on my laptop: Intel UHD integrated graphics and 8 GB RAM. It must also work on phones.
- Don't add shadow maps or heavy post-processing. Keep low-graphics mode and the software fallback working.
- Destination navigation, panel tabs, journey controls and size comparisons must work with a keyboard.
- Escape must close dialogs and exit Space view. Closing an interface must return focus to an appropriate control.
- Respect reduced-motion preferences. Sound stays off until the visitor enables it.
- The journey must remain optional. Visitors can pause, skip or leave it. It must not advance while the page is hidden.

## How we work

- Before a big change, show me the plan and wait for approval.
- Make one reviewable change at a time, then stop so I can review and commit it.
- Run `pnpm check`, which includes type checking and tests, before reporting completion.
- Tell me what passed, what failed and what you couldn't check. Don't say something looks right if you only read the code.
- Add a meaningful test in spec/ for each new mechanically testable promise.
- Visual quality, clarity and enjoyment also need human judgement. Passing tests does not establish those things.
- When I correct a mistake, protect the correction with a test where possible. If a rule needs changing, propose the wording for me to review.