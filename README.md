# COSMOS

COSMOS is a shared space exploration website for students who are curious about the universe. You can visit seven destinations, from Earth and Saturn to galaxies and large cosmic structures. You can explore freely, take an optional journey, compare sizes, and share observations in the Discovery Atlas.

## What good means here

For me, good means making someone curious enough to look more closely, while helping them understand what they are looking at. A realistic appearance can attract attention, but it can also make an illustration look more certain than the science behind it. COSMOS should make space interesting without hiding that difference.

The information panels distinguish observed evidence, reconstructions, simulations and proposed findings. Gaia BH1 shows its visible companion star rather than an invented glowing black hole. The Hercules–Corona Borealis Great Wall is labelled as proposed, not confirmed. Distances and sizes are compressed for exploration, while the comparison view keeps both objects on the same diameter scale.

Robin Sloan's *An app can be a home-cooked meal* [1] helped me think about making something useful for a small group. His example concerns a family; my audience is students exploring a subject together. I want another person's observation to give someone a reason to look again. Parimal Satyal's *Rediscovering the Small Web* [2] supports making personal websites around particular interests. For COSMOS, that means keeping the experience focused on curiosity, without scores, rankings or pressure to complete everything. Neither essay proves that COSMOS achieves this; people using it have to judge that.

## Exploring together

Enter a name to begin. Your browser receives an anonymous identity cookie. Shared observations appear as "you" or "an explorer"; names are not displayed to other visitors. Only the author's browser can edit or delete its notes. Clearing cookies loses that ownership. The server logs who added, edited or deleted a note, with a short id.

If two people have the same destination open, a note from one appears for the other within about a second, without reloading, so you can react to what someone else just noticed. Notes are stored in SQLite on the Fly volume so they survive restarts and redeploys. The optional journey can be paused or skipped. Sound starts only when enabled, and Space view hides the controls.

## What I chose to leave out

Live explorer markers would show where people are, but the Atlas gives them something to contribute. I kept collaboration centred on observations. A separate black hole investigation would need a convincing model and explanation of what its results mean; the current destination explains the evidence instead. Narration would set a reading pace, so I kept text and optional ambience. These choices keep the project manageable and leave visitors in control.

## What is checked and what needs judgement

The 34 tests in `spec/` cover ownership, private attribution, observation limits, literal rendering of observation text, delivery of a new note to a second browser within a second, persistence across database processes, destination-switching races, drafts, journey timing and comparison ratios. They also check that the app responds and publishes this README.

Tests cannot establish whether the universe feels convincing, explanations are understandable, or someone else's note changes what a visitor notices. Those need human judgement. I checked it in Chrome on my laptop (Intel integrated graphics) and on my phone. That shows it runs and fits both screens; it doesn't show that people learn more or enjoy it.

## Credits and references

Earth, Saturn, ring and Milky Way textures are by [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE s.r.o.), based on NASA imagery, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). They were resized and recompressed. Scientific sources are linked in each destination's panel.

[1] Robin Sloan. [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/), 2020.

[2] Parimal Satyal. [Rediscovering the Small Web](https://neustadt.fr/essays/the-small-web/), 2020.