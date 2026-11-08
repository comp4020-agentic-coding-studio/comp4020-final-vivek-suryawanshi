# 0003: Switch from Final Over to COSMOS

Status: accepted. Recorded: 2026-11-08.

## Context

Final Over started as a multiplayer cricket prediction game. One person chose a fast or slow delivery, another person predicted it, and everyone saw the result after the prediction was submitted.

However, I wanted it to become more than two choices and a result on the screen. I wanted a short cricket match with six balls per side, batting timing, different bowling styles, and spectators who could predict deliveries while waiting to play.

I also wanted a stylised 3D presentation inspired by the dramatic action in Inazuma Eleven: animated characters, colourful stadiums, bowling run-ups, batting impacts, camera movements and special effects.

The bowling itself would have needed more variety. I wanted fast bowlers, off-spinners and leg-spinners, with deliveries such as yorkers, slower balls, swing, googlies and carrom balls. These choices would need to affect the ball's movement and the batter's response, rather than just having different names.

That was a much larger project than the working fast/slow prediction game.

## Hardware and scope

My laptop has an Intel Core i5-10210U processor, Intel UHD integrated graphics and 8 GB RAM, with no dedicated graphics card.

I was concerned about building and testing the version I wanted on this machine. The game would need character animation, ball movement, batting timing, camera work and multiplayer behaviour to work together. It would also need to remain responsive while two people played.

I had not benchmarked a completed version of that game. The concern was whether I could develop, test and finish it reliably with the hardware and time available. Keeping only the simple prediction interface would reduce the scope, but it would also leave out much of the experience I wanted.

## Options I considered

1. **Continue Final Over.** Keep developing the cricket game, either accepting a simpler presentation or taking on the work needed for the larger 3D version.
2. **Switch to COSMOS.** Build a shared educational space explorer, keeping the existing technical approach but changing the experience and shared state.

## Decision

I switched to COSMOS. The implementation change is in commit [`009dd7c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-vivek-suryawanshi/commit/009dd7c).

I wanted students to explore unfamiliar objects, understand what they were seeing and share what they noticed. This gave the project an educational direction that connected with my interest in physics.

Space also gives a natural progression in scale. Moving from a planet to a star, then to a galaxy and a large cosmic structure, raises different questions: how large is it, how far away is it, and how do scientists know it exists? Gaia BH1 shows how something invisible can be inferred from its effect on a visible star, and the proposed Great Wall shows that a scientific claim can still be uncertain. That gave COSMOS something to explain beyond presenting impressive objects.

COSMOS still uses 3D graphics, so switching did not remove the performance problem. It gave me more control over the scope. I could focus on a limited set of destinations, simplify their models, keep textures small and provide a low-graphics mode. The experience did not depend on synchronising a cricket ball, character animations and a precisely timed batting action.

I chose free exploration without scores, rankings or compulsory missions. Visitors can spend time at one destination and move on when they want.

The Discovery Atlas gives the multi-user part a purpose. Someone else's observation can give a visitor another detail or question to consider. Shared notes remain available when people return.

I kept Node, SQLite, server-sent events and browser-based identity. The earlier work therefore remained useful even though the cricket experience changed.

## What this costs

- The cricket interface, round logic and game-specific checks no longer serve the final experience.
- Most of COSMOS can be explored alone. The shared part is the Atlas, so being there at the same time matters less than it did in Final Over, where two people played against each other.
- COSMOS still needs performance checks on my laptop and phones.
- Scientific content needs sources and clear labels for evidence, illustrations and uncertain claims.
- The switch creates documentation work: the README, agent rules and tests must describe COSMOS consistently.
- Working interactions and attractive graphics do not establish educational value. Curiosity, clarity and the usefulness of shared observations still need human judgement.

## How this affects the earlier decisions

ADR 0001 records Final Over's first-click-wins rule. It remains part of the project's history, but it does not govern COSMOS.

ADR 0002's browser-based identity approach remains relevant. The server-side restriction now protects observation ownership: only the author's browser can edit or delete a note. The earlier rule against predicting your own delivery belongs to Final Over.