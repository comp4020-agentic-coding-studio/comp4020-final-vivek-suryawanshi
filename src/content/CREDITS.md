# Third-party assets

Textures used to render Saturn, Earth, and the sky background in the 3D
scene. All are licensed for inclusion in a public repository; attribution
is given here per each licence's terms.

## Solar System Scope textures

- **Source:** https://www.solarsystemscope.com/textures/
- **Creator/provider:** Solar System Scope (INOVE s.r.o.)
- **Licence:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) ("Distributed under Attribution 4.0 International license: You may use, adapt, and share these textures for any purpose, even commercially.")
- **Underlying data:** per the source page, these textures are based on NASA
  elevation and imagery data (including NASA's Blue Marble and Black
  Marble night-lights composites), tuned against true-colour photography
  from the Messenger, Viking, and Cassini spacecraft.
- **Attribution:** Textures by [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), based on NASA imagery.

Each texture ships as two files: a higher-resolution one used in normal
graphics mode, and a smaller, more compressed `_lg` ("low graphics")
variant used when that setting is on — both downloaded from the same
8k source and resized here, never fetched at runtime.

| File (in `src/public/cosmos/assets/`) | Original source file | Used for |
| --- | --- | --- |
| `earth_daymap.jpg` / `earth_daymap_lg.jpg` | `8k_earth_daymap.jpg` | Earth's sunlit surface — continents, oceans |
| `earth_night.jpg` / `earth_night_lg.jpg` | `8k_earth_nightmap.jpg` | Earth's night side — city lights, blended in only on the dark hemisphere |
| `earth_clouds.jpg` | `8k_earth_clouds.jpg` | Earth's cloud layer (alpha-blended shell); no separate low-graphics variant — the cloud layer is skipped entirely in low-graphics mode |
| `saturn_bands.jpg` / `saturn_bands_lg.jpg` | `8k_saturn.jpg` | Saturn's banded atmosphere |
| `saturn_ring_alpha.png` / `saturn_ring_alpha_lg.png` | `8k_saturn_ring_alpha.png` | Saturn's ring colour/transparency profile |
| `milkyway.jpg` / `milkyway_lg.jpg` | `8k_stars_milky_way.jpg` | Distant sky background (camera-centred skybox) |

### Modifications

Each file was downsampled and re-compressed from the original 8k source —
8k itself is far more than this scene needs and would cost multiple
megabytes per texture; resizing down keeps real added detail (visible dust
lanes in the Milky Way, individually-readable city-light clusters on
Earth's night side) while keeping the total payload modest for
integrated-graphics and mobile devices (normal-mode files total
≈ 780 KB; low-graphics files total ≈ 140 KB):

- `earth_daymap.jpg`: 2048×1024, JPEG quality 85. `earth_daymap_lg.jpg`:
  1024×512, quality 78.
- `earth_night.jpg`: 2048×1024, JPEG quality 78 (a mostly-dark image with
  small bright highlights compresses well at a lower quality setting
  without visible loss). `earth_night_lg.jpg`: 1024×512, quality 70.
- `earth_clouds.jpg`: 1600×800, JPEG quality 72 (a mostly-flat
  alpha/luminance map, so more compressible without visible loss). No
  `_lg` variant — this texture simply isn't loaded in low-graphics mode.
- `saturn_bands.jpg`: 2048×1024, JPEG quality 85. `saturn_bands_lg.jpg`:
  1024×512, quality 78.
- `saturn_ring_alpha.png`: 2048×128 (the source image is a 1D radial
  profile repeated vertically, so height carries no extra detail), PNG.
  `saturn_ring_alpha_lg.png`: 1024×64.
- `milkyway.jpg`: 2048×1024, JPEG quality 82. `milkyway_lg.jpg`: 1200×600,
  quality 70.

CC BY 4.0 permits adaptation (resizing, re-encoding) provided the licence
and attribution are retained, which this file does.
