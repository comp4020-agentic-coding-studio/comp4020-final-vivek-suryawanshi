# 0002: A person is a browser with a name, and you can't predict your own delivery

Status: accepted (Crit 10). Date: 2026-10-21.

## Context

Up to Crit 9, Final Over couldn't tell people apart. Every browser showed both the bowler and the batter buttons, so one person could bowl and then predict their own delivery and always get it right. My README admitted this. For Crit 10 the app has to tell people apart, and decide what each person can see and change, with the server checking it.

I needed to decide two things: what counts as a person, and what a person is not allowed to do.

## What counts as a person

1. **An account with a password.** The strongest identity, but it means a sign-up screen, passwords to store and protect, and a slow start for someone who just wants to play one round.
2. **A name only.** Easy, but two people could type the same name, and anyone could type someone else's name to act as them.
3. **An anonymous browser id plus a name.** The server gives each browser a random id in a cookie the first time it visits, and the person types a name. The id is what the server trusts; the name is just what people see.

I chose option 3. It keeps joining fast, which matters for a game you play with classmates in a room, and the id means two people with the same name are still told apart. The logs show both, for example "Luffy (167895e7)".

## What a person can't do

You can't predict a delivery you bowled. When a prediction comes in, the server compares the predictor's id with the bowler's id for the waiting delivery. If they match, it rejects the prediction with a 403 and the page says "you can't predict your own delivery". Anyone else can predict. First click wins (ADR 0001) still applies on top of this.

I put this check on the server and not just on the page, because hiding a button is like hiding the delivery value: anyone can get around it by sending the request themselves.

## What this costs

- A person is really a browser. If someone opens an incognito window or clears their cookies, they become a new person and could predict their own delivery from there. Stopping that would need accounts, which I decided against.
- Names aren't checked. Two people can both be "Andy". The short id in the logs tells them apart, but on the page they look the same.
- Rounds from before this change have no ids, so they show as "Anonymous".

## Logging

Every action logs one line saying who did it, with name and short id. The "delivered" line deliberately leaves out the value, so that even someone reading the logs can't see the delivery before the prediction locks. The value is only logged at the reveal.

## When to revisit

If cheating with a second browser becomes a real problem in playtesting, or if I add the crowd and turn queue, I'll look at stronger identity and write a new record.