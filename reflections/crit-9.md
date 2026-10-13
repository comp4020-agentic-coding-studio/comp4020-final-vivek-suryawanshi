# Crit 9 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was realising that hiding something on the page is not the same as keeping it secret. When Claude Code asked whether the batter's browser should see the delivery before predicting, I first thought of it as a display question. Then I saw that if the browser receives the value at all, anyone can open dev tools and read it, and the whole game of reading the other person falls apart. So the rule became that the server never sends a pending delivery until the prediction locks. That one idea became the centre of my README, my tests and my decision record. The same thing happened with persistence: the rounds were saved, but a reload showed nothing, so to a visitor they didn't exist.

## What did this work change about who I want to be as a software developer?

I want to be a developer who checks what is actually true, not what looks true. This crit I said no to the agent twice, took out an ADR that no longer matched the app, and removed claims from my README that weren't really tested. Directing an agent made me see that my job is deciding what the app promises and making sure those promises hold, not just getting code that runs.