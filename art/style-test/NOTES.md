# Style test notes: the three starters

Battle-front idles for Sagelet, Blitzr and Forkling, drawn as text grids in `packages/art/sprites/` and rendered by `packages/art/src/build.mjs`. Four critique-and-fix passes; the contact sheet after each is in `passes/`.

**Verdict up front:** the pipeline reaches solid game-jam quality, not shippable indie quality. The designs and silhouettes hold up. The pixel-level finish and the animation do not yet. I would not ship any of the three without a human pixel artist's pass.

## What was checked, and what was not

- Every colour is an Endesga 32 index by construction: the grid format cannot express anything else. I could not reach lospec.com from this sandbox (the proxy returned 403 and the fetch tool was refused by robots.txt), so the palette is the list from the brief, unverified against Lospec.
- Each frame is 64×64 with a transparent background, and all three stand on a common baseline at y = 58.
- I looked at the PNGs at 4× and 8× and at the contact sheet on every pass. I could not watch the GIFs or `preview.html` play: I have no way to view animation here. The motion was judged from the frame sheets only, so timing and feel are unconfirmed.
- GIF delays are stored in hundredths of a second, so Blitzr's GIF plays at 80 ms per frame. The sheet and `preview.html` use the authored 75 ms.
- The build prints an orphan-pixel report. What remains is deliberate (eye glints, spark centres, toe pixels) or small and listed under weaknesses below.
- Sizes run over the "about 40×40" target once crests are counted: Sagelet 44×47 including the thought bubble and dots (body alone 34×33), Blitzr 44×47, Forkling 38×41.

## Design decisions

### Sagelet (Reasoning)
- One round egg for hood and robe, so the read is a single circle. The face opening sits left of centre, which is what turns it three-quarters toward the viewer's left.
- Owl cues: big round lenses, a widow's-peak facial disc and two small hood tufts. Without the tufts it read as a penguin chick in pass 1.
- The spectacle frames are the `{` and `}` themselves: a navy stem on the outer side of each lens with a cusp poking into the hood.
- The crest is a literal thought bubble: two trailing bubbles and a cloud, rising up and back.
- Monk cues: a rope belt with a knot, a cream hem, a mantle line where the hood drapes.
- Robe ramp is cyan, blue, deep blue, navy (`2ce8f5 0099db 124e89 262b44`), so shadows shift toward navy. The outline is navy on the lit side and near-black on the shaded side.
- Idle: 1 px stretch on frames 1–2 and squash on 4–5, the crest follows a frame late, and the three dots orbit 20° per frame so the loop closes after 120°. Far dots are drawn before the body, so they pass behind it.

### Blitzr (Speed)
- The whole figure is a chevron pointing left: head thrust ahead of the feet, quills and tail trailing up and right.
- The hedgehog half is carried by three lightning-bolt quills and a bolt tail. The fox half is the wedge head, tall ears and cream muzzle.
- The hoodie is the red accent (`e43b44`, shade `a22633`, deep `733e39`) with yellow drawstrings, a pocket and the hood bunched behind the neck.
- Fur ramp is yellow-orange, orange, rust. The far leg is all rust so the two legs separate.
- Idle at 75 ms: a bounce on the toes (a leg row is dropped or duplicated), the head leads by a pixel, quills and tail lag a frame, and single-frame sparks flicker on four of the six frames.

### Forkling (Open)
- Three rounded cubes, each smaller than the one below, each drawn with a top, front and side plane. The stack steps right as it rises, which is the three-quarter view.
- Lit planes are `63c74d`, cast shadows and form shade `3e8948`, side planes `265c42`. A short yellow bevel highlight on each top-front edge gives the glossy toy look. Pass 2 tried a darker front plane; it had more form but lost the bright green that identifies the type next to the other two.
- The fork tail is the git-fork glyph in magenta: one trunk, two prongs, ring nodes. The same glyph is on the middle block's chest.
- Face on the top block only: dot eyes, a small smile, pink blush.
- Idle: a wave travels up the stack. The low block stretches and squashes, the middle block peaks one frame later and the top block one frame after that. The tail's prongs lengthen and shorten.

## Honest self-critique

### What is close to shippable
- **Silhouettes.** The black-fill row passes: circle with a bubble trail, spiky chevron, stepped tower with a Y. They are distinct at 1×.
- **Palette discipline and colour identity.** The three sit together as a set and each owns its type colour.
- **Sagelet's face.** It has appeal and reads at 1×. It is the strongest single element in the test.
- **Forkling's material.** The glossy blocks read cleanly and the concept survives at 1×.

### What still looks amateur
- **Animation is the weakest part.** Every frame is the same drawn parts slid by a pixel or two, plus one duplicated or dropped row. There are no redrawn in-betweens, no arcs, no overlap inside a part. Blitzr's quills translate rigidly instead of bending. Forkling's blocks slide instead of tilting. Shippable idles redraw parts per frame.
- **Sagelet's `{ }` spectacles do not read as braces** below about 4×. They read as round glasses.
- **Sagelet's orbiting dots read as stray specks** on any single frame. With three dots 120° apart, one is always hidden behind the body.
- **Sagelet's shaded side is one flat block** of deep blue with a straight vertical edge beside the face.
- **Blitzr's head is a flat side profile** with two eyes pasted on, not a turned head. The far eye merges with its brow. Shading on the head is close to none.
- **Blitzr's rocket sticker is unreadable.** It is seven pixels of white and red. "Rocket-sticker quills" cannot be delivered at this size on a quill this narrow; it needs a bigger quill or to move to the evolution art.
- **Blitzr's anatomy is stiff.** The arm is a tube, the legs are thin and the hoodie is nearly flat red. The hedgehog read is weak; it is mostly a fox.
- **Blitzr is all warm.** Orange, red and yellow sit close in value, so the hoodie and fur blur together at 1×.
- **Forkling's top and front planes are the same green.** The planes are separated only by a short highlight and a cast shadow, so the blocks read as rounded lozenges more than cubes.
- **Forkling is the most generic design.** Take away the tail and it is a stack of slimes.
- **Small defects left in:** a few stray single pixels on Blitzr's cuff and hem, a 1 px outline step where Sagelet's tufts meet the crown, and Sagelet's squash frame widens the bridge of the spectacles by a pixel.

## What a human pixel artist would change
1. Redraw the idles frame by frame: bend the quills, tilt the blocks, let the robe hem and belt swing, add a blink on a longer alt-idle.
2. Rebuild Blitzr's head as a true three-quarter form, with a muzzle that comes toward the viewer, and give the hoodie folds and a second shade.
3. Break up Blitzr's warm mass, most likely with a darker or cooler hoodie, and add back quills through the hoodie so the hedgehog reads.
4. Make Sagelet's braces the dominant shape of the spectacles (thicker, perhaps gold) and rethink the dots, for example a tighter cluster that reads as "…".
5. Give Forkling a real value step between top and front planes, and vary the three blocks (size, tilt, a seam or a port) so it reads as modular parts.
6. Do a manual anti-aliasing and cluster clean-up pass on every curve. Mine are clean on the big forms and rough on the small ones.
7. Check all three in the real battle scene at 320×180 against a background. I only saw them on flat swatches.

## Effort estimate for the full slice

These are estimates from one style test, not measurements.

**This test:** one agent session produced 18 frames, but only about 20 small drawn parts. Every frame is a recomposition of those.

**Slice scope:** 17 species × about 30 battle frames is roughly 510 frames, plus 400–650 tiles.

| Route | Battle sprites | Tiles | Expected quality |
|---|---|---|---|
| This pipeline, agent only | 2–3 sessions per species, so 35–50 sessions, each needing a human look | 30–50 sessions at 10–20 tiles each | Game-jam. Windup, attack, hurt and faint need new poses, which is where this method was weakest. |
| Agent drafts, human artist finishes | Drafts as above, plus about 1 day per species of repaint and animation | 10–15 days of repaint | Shippable if the artist owns the animation. |
| Human pixel artist from scratch | 1.5–3 days per species, so 25–50 working days | 15–30 days at 20–40 tiles a day | Shippable. Roughly 2–4 months for one artist. |

My recommendation is the middle route, or the third if budget allows. The text-grid pipeline is useful for exploring designs, locking silhouettes and palette, and producing placeholder art the engine can ship with today. It should not be the final art.

## Files
- `<starter>-idle-sheet.png`, `<starter>-idle-sheet@4x.png`, `<starter>-idle.gif` for sagelet, blitzr, forkling
- `contact-sheet.png`: 1×, 2×, 4× on `#181425` and `#ead4aa`, then a black-silhouette row (1×, 2×, and a mid-cycle frame at 2×)
- `preview.html`: self-contained, animated at 1×, 3×, 6×
- `passes/pass-1-contact-sheet.png` through `pass-4-contact-sheet.png` (pass 4 is final)

Rebuild with `pnpm --filter @latentia/art build`. `packages/art/tools/` holds two drafting aids that are not part of the build: one printed a shaded ellipse used as a reference for Sagelet's first outline, the other printed the orbit positions.
