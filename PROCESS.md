# Process overview

## Where this started

I didn't ship anything for Crit 8, so this crit is where the project really starts. My repo only had the course placeholder deployed, which I did by hand with `flyctl deploy -a` on the first day to check the deploy path worked.

My first idea was "Into the Dark", a shared map of the real universe where people send probes that take real time to arrive. I liked it, but I realised I wanted to make a game, and I kept coming back to one question: what is more fun because another real person is there? That led me to Final Over. The core of it is reading another person. The bowler picks fast or slow, the batter has to guess, and the fun is in the patterns and the bluffing. Cricket also means something to me, and hand cricket showed me you don't need physics for this kind of contest to be fun.

## How I worked with the agent

I split the work. Claude Code writes the code, and I direct it, review what it does and correct it. I also used Claude in a separate chat to plan the game, check my thinking against the brief, and help me draft the README and the decision record, which I then edited. I wanted my own judgement in the documents, not just the agent's.

For the first slice I didn't let it build straight away. I gave it a small scope (one browser bowls, one predicts, both see the result live) and asked for its plan first. It then asked me questions, and two of my answers shaped the app:

- It asked whether the predicting browser should see the delivery before predicting. I said no, and that the server should never send the value at all until the prediction locks. Hiding it on the page wouldn't be real secrecy. This became the main promise in my README.
- It asked whether to rewrite README.md and the old ADR. I said no and told it not to touch README, PROCESS.md, CLAUDE.md, docs/ or reflections/, because I write those. I still need to put that rule into CLAUDE.md so it's part of the harness and not just something I said once.

The slice is in [`d24f622`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/d24f622).

## Corrections

Before committing, I found an ADR in docs/ that an earlier agent session had written for Into the Dark. It described polling and a probe map, which no longer matched the app. I took it out of the commit and out of the repo instead of shipping a document that was wrong and wasn't mine.

After deploying, I tested with two browser windows side by side. Real-time worked, but when I reloaded the page it went back to "Waiting for a delivery". The rounds were saved in the database, but the page never showed them, so to a visitor it looked like nothing persisted. I asked Claude Code to load the recent rounds when the page opens. Because that was a new way for data to reach the browser, I also asked for a test that a pending delivery's value is never in what a page loads. That's [`0d3b8ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/0d3b8ac). Then I redeployed and checked the rounds were still listed.

When I wrote the README, I checked every claim under "checked" against the actual test names in spec/game.test.ts and took out the ones that weren't really tested.

## The stack

The app is plain Node (`node:http`), SQLite through Node's built-in `node:sqlite`, server-sent events for live updates, and `marked` to render the README at /readme/.

- I used `node:sqlite` instead of `better-sqlite3` because `better-sqlite3` failed to build on my Windows laptop in crit 7 (no Python or C++ build tools). The built-in module needs no compiling, so the app and tests run the same on my laptop and on Fly. The cost is that `node:sqlite` is still marked experimental.
- I used server-sent events instead of WebSockets because only the server needs to push. Players send their actions as normal requests.
- No framework means routing is written by hand, which is fine for a handful of routes.
- The database lives on the Fly volume at /data, which is what keeps rounds through redeploys.

## The decision for this crit

The question I chose is what happens when two people act at once. Right now the first click wins: once a delivery is in, nobody can change it until the round ends. The reasons and costs are in [docs/adr/0001-first-click-wins.md](docs/adr/0001-first-click-wins.md).

All of this crit's work so far: [`15bc4af...0d3b8ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/compare/15bc4af...0d3b8ac).