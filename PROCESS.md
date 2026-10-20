# Process overview

## Where this started

I didn't ship anything for Crit 8, so the project really started at Crit 9. My first idea was "Into the Dark", a shared map of the real universe where people send probes that take real time to arrive. I realised I wanted to make a game, and I kept asking what is more fun because another real person is there. That led to Final Over. The bowler picks fast or slow, the batter has to guess, and the fun is in reading patterns and bluffing.

## How I work with the agent

Claude Code writes the code. I direct it, review what it does and correct it. I also use Claude in a separate chat to plan, check my thinking against the brief, and help me draft the README, decision records and this file, which I then edit. I don't let Claude Code touch README, PROCESS.md, CLAUDE.md, docs/ or reflections/. I still need to put that rule into CLAUDE.md so it's part of the harness and not just something I tell it each session.

For each piece of work I give it a small scope and ask for its plan before it writes code. I check the plan, correct it if needed, then approve edits one at a time instead of using auto mode.

## Crit 9: making it real-time

The first slice ([`d24f622`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/d24f622)) let one browser bowl and another predict, with the result pushed to both. When Claude Code asked whether the predicting browser should see the delivery first, I said the server should never send the value at all until the prediction locks, because hiding it on the page isn't real secrecy. That became the main promise in my README.

Testing with two windows, I found a reload showed nothing even though rounds were saved, so I asked for history on page load, plus a test that a pending value is never in what a page loads ([`0d3b8ac`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/0d3b8ac)).

My decision for Crit 9 was first click wins (ADR 0001). When the ship preflight failed against the live app, Claude Code offered to change the app, but I thought the cause was a delivery I'd left pending while testing. That was right, and it fixed the tests instead. While checking, it turned out the server didn't actually enforce first click wins; only the page made it look that way. So I had the server reject a second delivery and added a test ([`f7ca6ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/f7ca6ec)).

## Crit 10: telling people apart

Crit 10 needed the app to tell people apart, enforce a rule on the server, and log who did what. I chose an anonymous browser id in a cookie plus a name, and the rule that you can't predict your own delivery. The reasons and costs are in [docs/adr/0002-who-counts-as-a-person.md](docs/adr/0002-who-counts-as-a-person.md). The work is in [`b3c1e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/b3c1e1d).

Two corrections shaped it:

- Claude Code's plan added the new database columns with `ADD COLUMN IF NOT EXISTS`. SQLite doesn't support that, and my live database already had rounds in it, so the deploy could have crashed the app. I had it check which columns exist first, and asked for a test that starts from the old schema with a real round and checks it still shows up.
- Before it started, I realised that if the log said who bowled *what*, anyone watching my terminal at the crit would see the delivery before the prediction. So I told it to log deliveries without the value and only log the value at the reveal. It made the delivery log function take no value at all, and added a test that a delivery line never contains "fast" or "slow".

I rehearsed the crit with my laptop and my phone as two people while tailing `flyctl logs`. The logs showed both people joining with names and ids, the hidden delivery, the rejected own-prediction, and the reveal.

## The stack

The app is plain Node (`node:http`), SQLite through Node's built-in `node:sqlite`, server-sent events for live updates, and `marked` to render the README at /readme/.

- I used `node:sqlite` because `better-sqlite3` wouldn't build on my Windows laptop (no Python or C++ build tools). The built-in module needs no compiling, so it runs the same locally and on Fly. The cost is that it's still marked experimental.
- Server-sent events are enough because only the server needs to push. Players send actions as normal requests.
- There's no framework, so routing is hand-written. That's fine for a handful of routes.
- The database is on the Fly volume at /data, which is what keeps rounds through redeploys.

All the work so far: [`15bc4af...b3c1e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/compare/15bc4af...b3c1e1d).