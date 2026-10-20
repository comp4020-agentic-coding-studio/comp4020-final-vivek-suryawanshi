# Crit 10 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was realising that logs are another place a secret can leak. In Crit 9 I learned that hiding the delivery on the page isn't enough if the browser receives it. This week I had to log who did what, and my first thought was a line like "Luffy bowled fast". Then I pictured narrating from my terminal at the crit while my pod watched, and that line would give the delivery away before anyone predicted. So the delivery is logged without its value, and the value only appears at the reveal. The same idea also made me check the agent's database plan more carefully, and I caught that it would have used SQL that SQLite doesn't support, on a live database that already had real rounds in it.

## What did this work change about who I want to be as a software developer?

I want to be a developer who thinks about every way data leaves the system, not just the obvious one. The page, the first load and now the logs were three different paths for the same secret. I also want to keep testing things the way real people will use them. Running two devices side by side while reading the logs showed me the app working as two different people, which a passing test alone couldn't show me.