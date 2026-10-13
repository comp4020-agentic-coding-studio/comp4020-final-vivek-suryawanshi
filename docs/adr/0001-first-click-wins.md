# 0001: When two people act at once, the first click wins

Status: accepted (Crit 9). Date: 2026-10-14.

## Context

Final Over has one shared round at a time. Right now every browser shows both the bowler and the batter buttons, so in a room of four or five people, two of them can easily press Bowler at almost the same moment. The app needs a rule for what happens then.

My README says good means two things here: the delivery has to stay secret until a prediction is locked, and every round needs a clear ending. Whatever rule I pick shouldn't break either of those.

## Options I considered

1. **First click wins.** Once a delivery is in, any other Bowler click is rejected until the round ends. Same for the prediction.
2. **Last click wins.** A later Bowler click replaces the waiting delivery.
3. **Claim roles.** One person takes the bowler role and one takes the batter role. Everyone else watches.
4. **A turn queue.** People join a "play next" list and take turns.

## Decision

I chose first click wins.

Last click wins would let the delivery change after the batter has started thinking about it. Someone else could even swap it without the bowler knowing. The batter would be reading a delivery that no longer exists, which goes against the whole point of reading the other person. With first click wins, a delivery never changes once it's waiting, so the batter always predicts against a real, fixed choice.

Roles and a queue would both be fairer, but they need names or some way to tell people apart, and more screens to build. I didn't have time for that before this crit.

## What this costs

- One person can bowl and then predict their own delivery. Nothing stops it yet.
- In a busy room, whoever clicks fastest gets to play, not whoever was waiting longest.
- The person whose click loses gets no real explanation of why.

## When to revisit

When I add names for players. At that point, claiming roles or a queue becomes possible, and I'll write a new record if I switch.