# Kolumna product film: design

A slow, dim, tilted close-up of the product that plays on a loop, in place of the
dashboard panels on the landing page. Companion to `DESIGN.md` (the landing page system).

Status: **design only, nothing built yet.** Written 2026-11-16.

## What we are copying, and what we are not

**Reference:** the right half of Linear's welcome screen (`linear.app/<workspace>/welcome`),
studied from five screenshots supplied by the user. The page itself needs a signed-in
Linear account, so its markup was **not** inspected: whether Linear plays a video file or
animates live elements is unknown. Every number below is read off the screenshots or is a
starting value to tune by eye.

**What makes it work** (taken from the screenshots):

1. **It shows almost nothing.** One frame holds four or five words: "Linear", "Inbox",
   "My issues", "Pulse". Another holds one row: "UI Refresh". Text is drawn about three
   times larger than it is in the real app.
2. **It is nearly dark.** Text sits at roughly 15 to 25 percent white on near-black. Icons
   keep a hint of their colour (a green, a yellow, a teal) at low strength. Nothing is
   bright enough to compete with the form beside it.
3. **It is tilted.** The interface lies on a plane leaning back and turned a few degrees,
   so baselines slope by about 8 to 12 degrees. It reads as an object in a room, not a
   screenshot.
4. **Only the middle is sharp.** A band across the centre is in focus. Rows above and
   below soften, then smear. The far edges dissolve into the background.
5. **It never stops and never hurries.** The camera glides and pushes in slightly. The
   three screenshots show three different places in the app at three slightly different
   angles, so it moves between a few shots.
6. **It asks nothing of you.** There is nothing to read, click or understand. It is
   atmosphere that happens to be the product.

**What we do not copy:** Linear's interface, words, icons or logo. Every element in our
film is Kolumna's own screen.

## Why it replaces the dashboards

The current hero panel (`components/landing/ProductTabs.tsx`: five tabs over miniature app
screens) tries to explain the whole product in a 1200 px box. Small text, many widgets, a
lot to parse, and it looks like every other SaaS landing page. The film says one thing
instead: this is a real, calm, well-made tool. The explaining is left to the sections
below it, which already do that job.

## Where it goes

- **Primary:** the landing page hero, in the slot `ProductTabs` fills now
  (`components/landing/Hero.tsx`). Full frame width (1280 px), 16:9, inside the existing
  hairline frame. No tabs, no window chrome, no caption.
- **Later, same component:** the right half of the login, signup and invite pages, which
  is exactly where Linear uses it. Not part of the first build.

## Technique: live elements, not a video file

Build it from real HTML with CSS 3D transforms, and animate the camera. Do not record an
MP4.

| | Live elements (chosen) | Recorded video |
|---|---|---|
| Sharpness | Crisp on every screen, text is real text | Soft on high-density screens unless the file is large |
| Weight | A few kilobytes of markup | Roughly 1 to 4 MB per loop |
| Upkeep | Changes when the product's look changes | Re-record after every change |
| Depth of field | Approximated with blur bands (see below) | Could be true depth of field |
| Risk | Blur and 3D cost GPU time on weak laptops | None at play time |

The one thing live elements cannot do exactly is real depth of field, where blur depends
on distance from the lens. A tilt-shift approximation is close enough at this brightness.
If it is not, the fallback is to record this same scene to video; the design does not
change.

## The stage

```
┌──────────────────────────── frame, 1280 max ────────────────────────────┐
│  stage: 16:9, overflow hidden, background --l-bg (#0b0b0c)               │
│  ┌───────────── blur band, strong ─────────────┐   ← top 22%             │
│  │              blur band, light               │   ← next 14%            │
│  │                                             │                         │
│  │        focus band: sharp (middle 28%)       │   ← the subject         │
│  │                                             │                         │
│  │              blur band, light               │                         │
│  └───────────── blur band, strong ─────────────┘   ← bottom 22%          │
│  vignette: edges fade to the background                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

Layers, back to front:

1. **Stage.** `aspect-ratio: 16 / 9`, `overflow: hidden`, `perspective: 1600px`,
   background `--l-bg`. On phones: `4 / 5`.
2. **World.** One element holding the scene, `transform-style: preserve-3d`. The camera
   is this element's transform. Nothing else animates.
3. **Scene.** The interface for the current shot, laid out flat at its natural size, then
   scaled up by the world.
4. **Blur bands.** Four strips over the scene using `backdrop-filter: blur()`, each with a
   gradient mask so the bands melt into each other. Light bands 3 px, strong bands 10 px.
   Static: they never animate.
5. **Vignette.** A radial gradient from transparent at the centre to `--l-bg` at the
   edges, starting at about 45 percent of the radius. Plus the page's existing grain at
   low strength (`components/landing/grain.ts`), so the dark areas are not flat.

## The look

| Property | Value | Note |
|---|---|---|
| Scale | 3.0 to 3.4 | 14 px interface text appears at about 44 px |
| Tilt back (`rotateX`) | 34 to 42 degrees | |
| Turn (`rotateZ`) | 7 to 12 degrees, sign changes per shot | gives the sloped baselines |
| Yaw (`rotateY`) | 4 to 8 degrees | slight, adds the sense of a side view |
| Text | `rgba(255,255,255,0.22)` | body of the scene |
| Subject text | `rgba(255,255,255,0.5)` | the one row the shot is about |
| Panels | fill `rgba(255,255,255,0.025)`, border `rgba(255,255,255,0.05)` | barely there |
| Colour | each icon's own colour at 45 percent opacity | never more than three coloured things in a shot |
| Accent | one amber dot or one mint check per shot, at 70 percent | the only bright point |

Rules:

- **Five to seven elements per shot.** If it needs more to make sense, it is the wrong shot.
- **No small text.** Nothing under 13 px before scaling. Drop metadata lines entirely.
- **No numbers anyone needs to read.** Counts and percentages may appear as shapes
  (a bar, a pill), not as figures that invite checking.
- **The subject sits in the focus band** for the whole shot. The camera path is planned
  around that.

## The shots

Four shots, one idea each, in the order the product works. About 28 seconds, then it loops.

| # | Shot | What is on the plane | The subject (in focus) | The one accent |
|---|---|---|---|---|
| 1 | **The workspace** | The sidebar: workspace name, Boards, Agents, Approvals, Usage, Activity | "Agents" and "Approvals" | the amber dot beside Approvals |
| 2 | **An agent at work** | One board column: its title, three task cards | the card assigned to an agent, with its robot mark and a progress line | the mint robot mark |
| 3 | **A person decides** | One approval: the agent's name, the change it wants, a confidence bar, Approve and Reject | the Approve button and the confidence bar | the amber "waiting" dot |
| 4 | **It is on the record** | Four audit rows linked by a line, and "Chain verified" | the newest row and the seal | the mint seal |

Each shot is built from the app's real pieces where they survive the scale-up
(`ActorBadge`, the sidebar's nav rows, `ReviewItem`'s layout), simplified by hand where
they do not. A shot is a small component that renders flat; the camera is separate.

### The camera

Every shot is one continuous move, about 7 seconds, with no cuts inside it:

- **Push in:** scale rises by 5 to 7 percent over the shot.
- **Drift:** the plane slides 3 to 5 percent of the stage width, mostly along its own
  baseline, so text travels the way it reads.
- **Settle:** the turn eases by 1 to 2 degrees. Never a full rotation.
- **Easing:** `cubic-bezier(0.45, 0.05, 0.25, 1)`. It should feel like a dolly on rails:
  already moving when the shot arrives, still moving when it leaves.

Between shots: a cross-dissolve of 1.1 seconds through a slightly darker frame. The
outgoing shot keeps moving while it fades, so nothing ever sits still.

Starting values, to tune by eye:

| Shot | rotateX | rotateY | rotateZ | scale, start to end | drift |
|---|---|---|---|---|---|
| 1 | 38° | 6° | 9° | 3.0 → 3.18 | up and left |
| 2 | 36° | -5° | -8° | 3.1 → 3.3 | right |
| 3 | 40° | 5° | 11° | 3.2 → 3.4 | down and right |
| 4 | 35° | -6° | -10° | 3.0 → 3.2 | left |

## Motion and performance rules

- Animate **only** `transform` on the world and `opacity` on the shots. No layout, no
  filter values, no colour changes.
- One timeline for the whole loop (the Web Animations API or one set of CSS keyframes),
  so shots can never drift out of step.
- **Pause when it cannot be seen:** off-screen (IntersectionObserver) and when the tab is
  hidden.
- **Reduced motion:** show shot 3 as a still frame, same look, no movement.
- `will-change: transform` on the world only. Blur bands are static, so the browser can
  cache them.
- Budget: steady 60 frames a second on an integrated-graphics laptop. If the blur bands
  cost too much, drop to two bands before dropping quality anywhere else.
- No layout shift: the stage's size comes from `aspect-ratio`, so it holds its space
  before anything loads.

## Accessibility

- The whole film is `aria-hidden="true"` and cannot take focus. It carries no information
  the page does not also state in text.
- No sound, ever.
- Nothing flashes. The brightest change is a slow cross-dissolve.
- A pause control is not needed for a decorative loop that respects reduced motion, but
  the film must stop for those users. Check that in the browser.

## Responsive

| Width | Stage | Change |
|---|---|---|
| 1280 and up | 16:9 | as designed |
| 768 to 1279 | 16:9 | scale reduced in proportion to width |
| under 768 | 4:5 | the same four shots, framed tighter on the subject; drift halved |

## Honesty rules

The film shows product screens, so `DESIGN.md`'s copy rules apply to it:

- Only screens that exist. No invented features.
- Only the agent clients the Agents page supports.
- "Chain verified" may appear because the audit chain is real and checked.
- Sample names and numbers are placeholders and should look like it (a made-up workspace
  name, not a real customer).

## What gets removed

When the film ships, `components/landing/ProductTabs.tsx` leaves the hero. The sections
further down that use `ConsoleShots.tsx` and `Stages.tsx` stay as they are; they explain
features and are a separate decision.

## Files

| File | Holds |
|---|---|
| `components/landing/film/ProductFilm.tsx` | the stage, bands, vignette, timeline, pause rules |
| `components/landing/film/shots.tsx` | the four flat scenes |
| `components/landing/film/camera.ts` | the per-shot camera values from the table above |
| `app/globals.css` | nothing new, unless the timeline is done in CSS keyframes |

## Done means

1. A stranger shown the page for three seconds says it looks calm and expensive, not
   busy.
2. Paused on any frame, at most seven elements are visible and one is clearly the subject.
3. The hero heading stays the brightest thing on screen at every moment of the loop.
4. The loop point is invisible: you cannot tell where it restarts.
5. 60 frames a second on a mid-range laptop; nothing moves with reduced motion on; it
   pauses off-screen.
6. No sideways scroll and no layout shift at 375, 768 and 1440 px.

## Open questions for the user

1. **Hero only, or also the sign-in pages?** Linear uses it beside the sign-in form. Our
   auth pages currently use the centred image panel.
2. **Keep the five tabs anywhere?** This design removes them. They could move lower on the
   page instead.
3. **How dark?** The reference is very dark because it sits beside a form. As the main
   visual of a hero it may need to be a step brighter (text at 0.3, not 0.22). To be
   decided on screen.
