# Final Over

Final Over is a small multiplayer cricket prediction game. One person bowls and picks a fast or slow delivery. Someone else bats and predicts which one it was. When the prediction goes in, every open browser shows the result straight away, without refreshing.

This is the first real-time version, made for Crit 9. There's no batting animation or shot timing yet. Right now I'm only testing one thing: is picking a delivery and trying to read another person fun enough that people want another round?

## What good means here

For me, good means the game is easy to join but still makes you think about your next choice. A bowler can bowl fast a few times to set up a pattern and then switch to slow. The batter can look at the recent rounds and guess whether the pattern will keep going. The history gives both people something to read, but it can't hand you the answer.

That only works if the delivery is really secret. Hiding it on the page isn't enough if the browser has already been sent the answer, because anyone can open dev tools and look. So the server never sends a pending delivery's value to any browser until a prediction is locked. Other browsers only learn that a delivery is waiting.

A round also needs a clear ending. After the prediction, everyone should see the delivery, the prediction and whether it was a hit within about a second. "Hit" here means a correct prediction, not bat on ball.

## Playing together and coming back

Updates go out over server-sent events. When someone opens the page, the same connection sends the current state: whether a delivery is waiting, and the ten most recent finished rounds. Rounds are saved in SQLite on the Fly volume, so they survive restarts and redeploys. The page only shows ten to stay readable. Older rounds aren't deleted.

The game should get more interesting with more people around, because everyone sees the same history and can argue about what's coming next. Right now, though, the app doesn't give watchers anything to do.

## Who's who

When you first open the game, it asks for your name. The server also gives your browser a random id in a cookie. The id is what the server trusts, and the name is what everyone sees, so two people called Andy are still told apart. You can't predict a delivery you bowled yourself: the server checks your id against the bowler's and rejects it. The reasons and costs are in docs/adr/0002.

This identity is really a browser, not an account. Someone who opens an incognito window becomes a new person and could predict their own delivery from there. I chose fast joining over accounts, because this is a game you play with people in the same room.

## What I haven't built (yet)

There are no full six-ball innings, no spectator predictions and no batting animation. Those come after I've seen whether the basic contest works.

## What informed the design

Robin Sloan's essay *An app can be a home-cooked meal* [1] is about making software for one particular small group of people. That's why I'm aiming at a game my classmates can pick up and play together, not a general cricket game.

Parimal Satyal's *Rediscovering the Small Web* [2] is about personal, specific websites. I read it as saying a small project can be worth something because of one specific experience. Neither essay proves this game is fun, though. Only playtesting can show that.

## What's checked and what's judged 

Checked by tests in `spec/`: a delivery stays secret until a prediction is locked in, and a pending delivery's value is never in what a page loads; a wrong prediction is scored as a miss; a prediction is rejected when no delivery is waiting; a second delivery is rejected while one is already waiting, so the first click wins; you can't predict a delivery you bowled (the server returns an error); a delivery's log line never contains its value; old rounds from before names existed still load and show as "Anonymous"; and the page lists at most the ten most recent finished rounds, newest first. The course's two shipped checks also pass (the app answers at `/`, and this README is published at `/readme/`).

Judged by people: whether it's fun. At the crit I want to watch whether people understand the reveal, start reading each other's patterns, and want to play again.


## References

[1] Robin Sloan. [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/). February 2020.

[2] Parimal Satyal. [Rediscovering the Small Web](https://neustadt.fr/essays/the-small-web/). 25 May 2020.