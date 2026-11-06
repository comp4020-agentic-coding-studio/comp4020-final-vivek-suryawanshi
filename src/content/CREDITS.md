# Third-party assets

Textures used to render Saturn and Earth in the 3D scene. All are licensed
for inclusion in a public repository; attribution is given here per each
licence's terms.

## Solar System Scope textures

- **Source:** https://www.solarsystemscope.com/textures/
- **Creator/provider:** Solar System Scope (INOVE s.r.o.)
- **Licence:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) ("Distributed under Attribution 4.0 International license: You may use, adapt, and share these textures for any purpose, even commercially.")
- **Underlying data:** per the source page, these textures are based on NASA
  elevation and imagery data (including NASA's Blue Marble), tuned against
  true-colour photography from the Messenger, Viking, and Cassini
  spacecraft.
- **Attribution:** Textures by [Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), based on NASA imagery.

Files used in this repository (downloaded from the source above, then
resized and re-compressed — see "Modifications" below):

| File (in `src/public/cosmos/assets/`) | Original source file | Used for |
| --- | --- | --- |
| `saturn_bands.jpg` | `2k_saturn.jpg` | Saturn's banded atmosphere |
| `saturn_ring_alpha.png` | `2k_saturn_ring_alpha.png` | Saturn's ring colour/transparency profile |
| `earth_daymap.jpg` | `2k_earth_daymap.jpg` | Earth's surface |
| `earth_clouds.jpg` | `2k_earth_clouds.jpg` | Earth's cloud layer (alpha-blended shell) |

### Modifications

Each file was downsampled and re-compressed from the original 2k source to
keep the total texture payload small for integrated-graphics and mobile
devices (combined total ≈ 210 KB for all four files):

- `saturn_bands.jpg`: resized 2048×1024 → 1024×512, re-encoded as JPEG
  quality 82.
- `saturn_ring_alpha.png`: resized 2048×125 → 1024×64 (the source image is a
  1D radial profile repeated vertically, so height carries no extra detail),
  re-encoded as PNG.
- `earth_daymap.jpg`: resized 2048×1024 → 1024×512, re-encoded as JPEG
  quality 82.
- `earth_clouds.jpg`: resized 2048×1024 → 1024×512, re-encoded as JPEG
  quality 70 (a mostly-flat alpha/luminance map, so more compressible
  without visible loss).

CC BY 4.0 permits adaptation (resizing, re-encoding) provided the licence
and attribution are retained, which this file does.
