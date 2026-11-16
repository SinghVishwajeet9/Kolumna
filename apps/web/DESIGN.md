# Kolumna landing page: design system

Written 2026-11-11, before the revamp. Every landing component follows this file; if the
code and this file disagree, fix one of them.

## The one sentence

> **Let AI agents work on your board, safely: approvals, budgets and a full audit trail.**

Every section exists to prove a part of that sentence. Nothing on the page describes
implementation details (ranks, tables, queries); it describes what a team gets.

## Direction

**Calm, structured, product-led.** The layout and rhythm are modelled on medusajs.com
(measured 2026-11-11, see below). The brand, words and visuals are Kolumna's own.

- **The product is the colour.** The page itself is neutral greys. Colour appears only
  inside product screens (real Kolumna components) and in one accent: the mint
  `#5af7b3`, used for tiny signals (active tab, status dots, the "AI" badge), never for
  big areas or headings.
- **One exception: the hero backdrop** (`HeroBackdrop.tsx`, 2026-11-11). A soft, grainy
  white crescent glowing out of black (`public/hero-glow.webp`, 1536×1024, 160 KB; the user
  supplied it and confirmed it's free to use). It's dark already and its light sits right
  of centre, so the headline reads with only a light left-side darkening and a fade into
  the page at the bottom. Monochrome on purpose: it keeps the page calm and leaves colour
  to the product screens. (Tried and dropped: a CSS green glow, then a painted meadow
  image.)
- **And one for the closing CTA** (`CtaPeaks` in `Sections.tsx`, 2026-11-11): two glowing
  peaks at the edges (`public/cta-peaks.webp`, 2000×979, free to use per the user), with the
  heading in the dark middle. The glow is toned down to 70%, with a light dark wash behind
  the text; top and bottom fade into the page. On phones a full-width crop would cut both
  peaks off, so there the whole picture sits small along the bottom, in its own box so its
  edges fade (its black is a shade darker than the page's).
- **No pixel decoration.** The halftone bands, pixel crowd, dithering, rainbow word lists,
  gooey buttons, custom scrollbar, smooth-scroll library and the intro animation are gone
  from the landing page. The pixel font survives only inside the logo mark.
- **Dark theme.** The app is dark, so the site is too; same tokens below. (Medusa is light.
  Their structure works the same in dark, and flipping later is a token change.)

## Reference measurements (medusajs.com at 1440 px wide)

| Thing | Value |
|---|---|
| Content container | 1280 px max, centred, 32 px inner padding |
| Frame | 1 px vertical lines at the container edges, page-long; full-width 1 px horizontal lines between sections |
| Hero | left-aligned, 160 px top padding; H1 64/74, weight 500, −1.6 px tracking, ¾ width; one 16/24 grey sentence; two 32 px buttons |
| Section header | two equal halves: H2 40/46 (−0.64 px) left, 24/30 grey text right; 64 px top/bottom |
| Product panel | 8 px radius, subtle fill, real UI inside |
| Feature grid | cells split by 1 px lines; visual on top, title 16/24 weight 500, body 14/22 grey, "link ▸" 13 px |
| Feature card visual | tall product scene (~430 px on their site) filling the cell with an ~8 px inset; text below with generous padding |
| Spacer strip | an empty 64 px row between sections, framed by lines |
| Quote / statement | 40/44, weight 500, centred-ish |
| Closing CTA | centred, H2 56/62 (−1.25 px) |
| Buttons | 32 px tall, 13 px weight 500, 6/12 px padding, 6 px radius |
| Body text | 16/24; small 14/22 |

## Tokens (dark)

| Token | Value | Use |
|---|---|---|
| `--l-bg` | `#0b0b0c` | page |
| `--l-panel` | `#121214` | product panels, card visuals |
| `--l-line` | `rgba(255,255,255,0.08)` | every hairline: frame, dividers, cell borders |
| `--l-line-strong` | `rgba(255,255,255,0.14)` | secondary button border, hover |
| `--l-fg` | `#f4f4f5` | headings, primary text |
| `--l-muted` | `#a1a1aa` | body text, supporting lines |
| `--l-faint` | `#71717a` | captions, eyebrows, footnotes |
| `--l-accent` | `#5af7b3` | signals only (see Direction) |

Font: **Satoshi** (already loaded), weight 500 for headings, 400 for text. Real code
snippets use the system monospace.

## Type scale

| Role | Size / line | Tracking | Weight | Colour |
|---|---|---|---|---|
| Hero H1 | clamp(40px → 64px) / 1.12 | −0.025em | 500 | fg |
| Section H2 | clamp(30px → 40px) / 1.15 | −0.016em | 500 | fg |
| Section aside | clamp(18px → 22px) / 1.4 | 0 | 400 | muted |
| CTA H2 | clamp(36px → 56px) / 1.1 | −0.022em | 500 | fg |
| Statement | clamp(28px → 40px) / 1.15 | −0.016em | 500 | fg |
| Card title | 16 / 24 | 0 | 500 | fg |
| Body | 16 / 24 | 0 | 400 | muted |
| Small | 14 / 22 | 0 | 400 | muted |
| Eyebrow | 13 / 20 | 0 | 500 | faint |

## Layout primitives (components/landing/Frame.tsx)

- **`Frame`**: the 1280 px column with the two vertical hairlines. Wraps the whole page
  below the nav, so the lines run unbroken.
- **`Rule`**: a full-width horizontal hairline (it bleeds past the frame to the
  viewport edges).
- **`Spacer`**: an empty 64 px strip between sections, bounded by `Rule`s.
- **`SectionHeader`**: H2 left half, aside right half, 64 px vertical padding; stacks on
  mobile.
- **`Cells`**: an n-column grid whose cells are divided by hairlines (no gaps, no
  shadows).
- **`Cell` + stage** (`Stages.tsx`): the visual fills the cell with an 8 px inset, 300 px
  tall on phones and 320 px from md up; short title and text sit below it. Each stage is
  a small product scene (agent card, autonomy options, confidence gate, daily spend chart,
  approval history, burndown) built from the app's components and tokens.

Padding: 32 px inside the frame on desktop, 20 px on mobile. Corners: 8 px for panels
and visuals, 6 px for buttons. No drop shadows except on the product panel's window.

## Buttons

- **Primary:** `#fafafa` background, `#09090b` text.
- **Secondary:** transparent, 1 px `--l-line-strong` border, fg text.
- Both are 32 px tall (36 px in the hero and CTA), 13–14 px weight 500, 6 px radius. No
  gooey effect.

## Motion

- Section H2s use `RevealText`: letters fade in left to right from a soft blur, tinted
  mint → sky → lavender while arriving, settling to white. Once per heading.
- Product-panel tabs advance on their own: a 2 px white line fills under the active tab
  over 6 s, then the next tab opens. It keeps running on hover (the user wants it that
  way) and pauses only while the panel is off screen. Clicking a tab jumps there and
  restarts the line. Screens cross-fade (150 ms). Nothing else moves. `prefers-reduced-motion`
  turns all of it off.

## Page structure

1. **Nav** (sticky, 64 px, blurred dark background, bottom hairline): logo · How it
   works · Features · Security … Sign in · **Start free**.
2. **Hero:** eyebrow "For teams that work with AI agents"; H1 "Let AI agents work on your
   board, safely."; one sentence: "Approvals, budgets and a full audit trail for Claude
   Code, Cursor and any MCP agent."; Start free / See how it works.
3. **Product panel with 5 tabs:** Board · Agents · Approvals · Budgets · Audit trail.
   Each tab: title + one line; below, the matching screen built from real components.
4. **Works with** strip: the agents Kolumna connects to, as plain wordmarks in hairline
   cells (no third-party logos).
5. **Agents as teammates:** header + 3 cells: own identity · autonomy you set · confidence
   gates.
6. **How it works:** header + 3 cells: Plan it · Delegate it · Approve it (ConsoleShots).
7. **Spend and trust:** header + 3 cells: budgets · track record · blended burndown.
8. **Audit trail:** split section: text left, hash-chained log visual right.
9. **Statement:** "Agents do the work. People stay accountable." No invented
   testimonials: there are no customers yet.
10. **CTA:** "Put your agents to work, safely." Free during beta.
11. **Footer:** link columns + small print, hairline above.

## Honesty rules for copy

- Only claim what's built and tested.
- The audit trail is **tamper-evident** (any edit breaks the hash chain and shows), not
  "tamper-proof": the external anchor (G8) isn't built.
- Agents' cost is mostly **self-reported**; say "spend agents report".
- "Free during beta", not "free forever": Vercel Hobby is non-commercial, and pricing isn't
  decided.
- No customer logos, quotes or numbers until they exist.

## Related

- `DESIGN-FILM.md`: the slow, tilted product film planned for the hero in place of the product tabs.
