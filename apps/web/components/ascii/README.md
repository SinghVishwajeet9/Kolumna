# ASCII animals (vendored)

Source: https://github.com/DesignerStephen1/ascii-animals (commit 93f2b66), MIT licence,
see `LICENSE` in this folder. Copied in rather than installed because it isn't on npm.

Local changes:
- `renderer.ts`: the dark palette's background is the app's `--color-bg` (#0d0d0d) and the
  grid is a little fainter, so the canvas blends into the page.
- `animals/candidates.ts` (an empty comparison list for the original demo) was left out.

To add a creature of our own, write one file in `animals/` that exports an `Animal`
(see `flock.ts` for the interface and `animals/crabs.ts` for a compact example), then
add it to `animals/index.ts`.

Used by `components/AmbientBackground.tsx`.
