# Process overview

## How the direction changed

I didn't ship a prototype for Crit 8. My first working version was Final Over, a cricket prediction game. Then my plans grew: animated characters, different bowling styles, batting timing and dramatic cameras. On my Intel UHD laptop with 8 GB RAM, that worried me, although I never benchmarked a finished game to prove it couldn't run.

I switched to COSMOS in [`009dd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/009dd7c). Space connects with my physics background and gave the project an educational purpose: students explore, question explanations and share observations. [ADR 0003](docs/adr/0003-switch-to-cosmos.md) explains the options and costs. Keeping to seven destinations gave me more control over scope, but 3D still needed care with performance.

## What the cricket version taught me

Final Over taught me that a page can look right while the rule behind it is missing. I required the server to withhold the delivery until the prediction locked, instead of sending the answer and hiding it on the page. When first click wins turned out to exist only in the interface, I had the server reject a second delivery and added a test ([`f7ca6ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/f7ca6ec)).

For identity I chose a browser cookie instead of accounts. During that work I rejected the agent's `ADD COLUMN IF NOT EXISTS`, which SQLite doesn't support, and asked it to check existing columns first. I also kept the delivery value out of logs until the reveal ([`b3c1e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/b3c1e1d)). This made me check where data could leave the server. COSMOS applies that lesson to ownership: the server rejects another browser's edit or delete, and observation responses omit author names and identities.

## Why I kept the stack

I kept Node's HTTP server, SQLite and server-sent events. `better-sqlite3` wouldn't build on my Windows laptop without extra build tools, and Node's built-in SQLite avoided that. Its database calls are synchronous, but the app is for a small group sharing short notes.

SSE fits because the live updates travel from server to browsers; adding and editing notes use ordinary HTTP requests. WebSockets would add a two-way connection I don't need. Notes are stored on Fly's persistent volume, keeping storage simple but making the volume setup essential.

The frontend uses Three.js and plain JavaScript modules without a bundler. That avoids another build step, but routing, state and module boundaries still need maintaining.

## Deciding what was worth building

Sloan's [home-cooked app essay](https://www.robinsloan.com/notes/home-cooked-app/) helped me aim at a particular group rather than a general platform. Satyal's [Small Web essay](https://neustadt.fr/essays/the-small-web/) supports building a site around a personal interest. Neither proves educational value. My position is that curiosity should lead to looking more closely, and another person's note should give you something new to consider.

That shaped the Discovery Atlas: notes belong to destinations, appear for anyone viewing the same place within about a second, and stay after people leave. I left out live explorer markers, a separate black hole investigation and narration; the README explains why.

## Directing the agents

I used Claude Code for most of the implementation and Claude separately for planning and review. However, repeated visual changes still didn't produce the immersive space experience I wanted. Features were being added, but I remained unhappy with the overall result. Technical progress was not enough for me to accept the presentation.

I cannot confidently say whether my instructions were too open or Claude Code misunderstood them. Words such as “realistic” left many decisions unspecified: lighting, camera position, object scale and how the interface should sit around the scene. I could recognise the mismatch more easily than describe every change needed.

In ChatGPT, I discussed that mismatch and developed clearer visual expectations. Codex then made two broader frontend passes ([`c4e7b34`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/c4e7b34), [`8610bc1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/8610bc1)). I accepted them because the composition, navigation and destination presentation were closer to what I needed, while the shared Atlas remained functional. This was not a controlled comparison: Codex also inherited the earlier code, assets and clarified requirements.

Larger changes were harder to inspect. I compared the supplied files, checked the backend remained unchanged, ran tests and committed the changes myself. I deferred documentation and stopped feature additions after accepting the result.

[`83e081e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/83e081e) recorded the boundaries in CLAUDE.md, with AGENTS.md pointing there. Some rules were previously conversational. Recording them later does not prove they governed every earlier change; the commits and tests remain the evidence.

## Corrections that shaped COSMOS

Before the first COSMOS build, I corrected three parts of the plan: keyboard users needed destination buttons, observation text needed `textContent`, and notes should show only “you” or “an explorer” ([`009dd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/009dd7c)). The current [UI checks](spec/ui.test.ts) verify navigation and dialog structure. The [rendering](spec/atlas-render.test.ts) and [ownership](spec/identity.test.ts) tests check literal text, including a `<script>` payload, ownership enforcement and private author attribution.

A blank preview was a positioning bug: the copied model retained its distant scene position, outside the preview camera's view ([`c75454d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/c75454d)).

For science, I requested sources and “TODO: verify” instead of guesses. I caught that the Andromeda prediction came from a 2012 study and requested Sawala et al. (2025), which estimated about a 50% chance of collision or merger within the next 10 billion years ([`593bd26`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/593bd26)). Licensed textures followed, with attribution recorded ([`0ee6809`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/0ee6809)).

I also challenged the visual plans. I wanted both planets' lighting to agree with one Sun, so I requested a single Sun light ([`d0d363a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/d0d363a)). Saturn was only 1.3 times Earth's diameter in the plan; I required approximately 9.4. That correction, night lights and framing changes are in [`af47614`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/af47614). Desktop `showModal()` would block interaction with the scene while reading, so the fullscreen layout uses a non-modal desktop panel ([`0ad5f3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/0ad5f3d)).

## Reliability and acceptance

Codex's redesign ([`c4e7b34`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/c4e7b34)) strengthened the Atlas. A late destination response must not overwrite another destination, and a note arriving through both snapshot and SSE must not appear twice. [spec/atlas-state.test.ts](spec/atlas-state.test.ts) protects these cases, drafts and failed submissions.

I accepted the journey, size comparison and Space view in [`8610bc1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/8610bc1), then stopped adding features. Journey tests cover interrupted arrivals, pause and completion; comparison tests preserve diameter ratios while zooming.

The suite has 34 tests across 11 files. CI builds and starts the deployment image, then runs `pnpm check`, with HTTP tests pointed at that container. Tests cover separate cookie identities, live delivery within a second and observations surviving a database-process restart.

## What the evidence doesn't show

I used the main 3D version on my laptop and phone while building it. That shows it runs and fits both screens; it isn't a measured frame rate or a user study. I haven't evaluated COSMOS with other students. I have stronger evidence that the interactions work than that they help people learn, and the README keeps that distinction.

Implementation and documentation through `b45c658`: [`15bc4af...b45c658`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/compare/15bc4af...b45c658).