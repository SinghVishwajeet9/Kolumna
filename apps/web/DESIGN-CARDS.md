# Kolumna landing cards and graphs: design

How the feature cards ("Plan it. Delegate it. Approve it." and "Spend and trust") should
look and move. Companion to `DESIGN.md` and `DESIGN-FILM.md`.

Status: **built 2026-11-17** (`components/landing/Card.tsx`, `Scenes.tsx`). Differences
from the plan are under "As built" at the end.

## Reference

The agent cards on linear.app's home page (the row of small windows: Cursor, Linear,
ChatPRD). Measured in the browser on 2026-11-17:

| Part | Value |
|---|---|
| Card | 400 × 560 px, radius 12, background `#0f1011`, border `1px rgba(255,255,255,0.12)`, shadow `0 2px 32px rgba(0,0,0,0.25)` |
| Row of cards | 12 px gap; the whole row is masked: it fades to nothing over 400 px at the left and right and over 300 px at the bottom |
| Edge highlight | a second hairline (`rgba(255,255,255,0.06)`) that is visible only near the top-left corner, through a radial mask |
| Prompt bubble | background = the card's colour plus 4 percent white, radius 8, padding 10, text 13/20, ring `0 0 0 1px rgba(0,0,0,0.2)` |
| Reply text | 13/20, secondary colour at 90 percent |
| Chips | fill `rgba(255,255,255,0.07)`, border `rgba(255,255,255,0.08)` |

**Not measured:** the motion. The stylesheet has no keyframes for these cards, so their
animation is driven by script, and the cards were not on screen while inspecting. The
motion below is designed from what the cards visibly do (text arrives in steps, a
"Thinking" line turns into "Worked for 12 sec", rows appear one by one), not copied.

## Why ours look worse today

1. **Three different card styles in one row.** A board column, a code block and an
   approval card, each with its own padding, border and height.
2. **Boxes inside boxes.** A panel, then a card, then an inner card. Linear has one
   surface per card.
3. **Everything is equally loud.** Nothing fades, so the eye has no place to rest.
4. **Nothing happens.** The graphs animate once on scroll; the step cards are still.
5. **Chart furniture.** Dropdowns, legends, axis labels, a tooltip and a cursor in a
   300 px box is a lot. It reads as a screenshot of a dashboard, which is what we moved
   away from in the hero.

## The card

One component for every card in both sections.

```
┌──────────────────────────────────────────┐  radius 12, #0f1011
│ ● Claude Code   [chip]              ─ ⤢ ✕ │  header, 44 px: mark, name, faint window dots
│                                          │
│   ┌──────────────────────────────────┐   │  body: one idea, drawn with at most
│   │  the request, as a bubble        │   │  three kinds of element:
│   └──────────────────────────────────┘   │    a bubble (what was asked)
│   Worked for 12 sec ▸                    │    a status line (what is happening)
│   The result, in one or two lines.       │    a short list or one small graph
│   ┌ row ─────────────────────────────┐   │
│   └ row ─────────────────────────────┘   │
│                                          │
│   (bottom 30% fades out)                 │
└──────────────────────────────────────────┘
  Title
  One sentence.
```

- **Surface:** `#0f1011`, `1px rgba(255,255,255,0.12)`, radius 12, shadow
  `0 2px 32px rgba(0,0,0,0.25)`, plus the top-left edge highlight.
- **Size:** all three cards in a row share one height (420 px desktop, 360 px phones).
- **One surface.** No panel behind the card and no card inside the card. Rows inside are
  separated by hairlines or by a 4 percent white fill, never by another border and
  radius.
- **Type:** 13/20 inside the card. Primary `#f7f8f8`, secondary `#8a8f98`. No text under
  12 px.
- **Colour:** neutral, as everywhere else. One accent per card (a mint mark, an amber
  dot), carried by an icon or dot.
- **Fade:** the bottom 30 percent of the card's content fades into the card, so a list
  can run on without ending in a hard edge.
- **Title and sentence** sit under the card, as now.

## Section 1: Plan it. Delegate it. Approve it.

Each card is one short scene that plays when it scrolls into view, then rests.

| Card | Header | Scene |
|---|---|---|
| **1. Plan the work** | board mark, "Product Roadmap" | A bubble: "Ship onboarding emails". Status: "Added to To Do". Then three task rows arrive one by one, the last with a progress line. |
| **2. Bring your agents** | robot mark, "Claude Code", chip "acts with approval" | A bubble holding the one-line connect command. Status: "Connecting…" turns into "Connected over MCP". Then two rows: the tasks it picked up. |
| **3. Approve what matters** | amber dot, "Approvals", chip "1 waiting" | A bubble: the agent's change and its reason. Status: "Below its confidence threshold". Then Approve and Reject. This card stays interactive: Approve turns the status into "Approved and logged". |

## Section 2: Spend and trust (the graphs)

Same card, same header, one small graph each. The graph is the scene.

| Card | Header | Graph | What is removed |
|---|---|---|---|
| **Budgets per agent** | "Agent spend", chip "$78 of $100" | 14 thin bars, two soft colours, one hairline for the cap | dropdowns, y-axis labels, tooltip, cursor, future-day ghosts |
| **A track record** | robot mark, "Claude Code", chip "94% approved" | the grid of changes, older ones dimmer | the big number (it moves to the chip), the legend, the "Let it act on its own?" box (becomes one status line) |
| **One burndown** | "Sprint 4", chip "6 days left" | three lines and the dashed ideal, one end dot each | dropdowns, legend (labels sit at the line ends), axis numbers, the area fill |

Graph rules:

- **Strokes 1.5 px, no fills** except bars. Lines end in a 3 px dot.
- **Two data colours at most**, both soft: mint `#5fc79a`, lavender `#a696f0`. Everything
  else is white at 20 to 60 percent.
- **One hairline for reference** (the cap, the ideal). No gridlines.
- **Labels only where they answer a question:** the first date, the last date, the line
  names at their ends. No tick labels.
- **The number that matters lives in the header chip,** not in the graph.

## Motion

Small and once. Every animation uses `transform` and `opacity` only.

| What | How |
|---|---|
| A row of cards arrives | each card rises 8 px and fades in, 60 ms apart, 420 ms, `cubic-bezier(0.22, 1, 0.36, 1)` |
| A scene plays | bubble at 0 ms, status at 350 ms, result rows from 800 ms, 90 ms apart |
| A status changes | the old text fades up and out while the new one fades in from below, 220 ms; a "…" pulses while waiting |
| Bars | grow from the floor, 30 ms apart, 600 ms |
| Lines | draw left to right in 900 ms; end dots fade in after |
| Grid cells | fade in oldest to newest, 12 ms apart |
| Hover | the border goes from 12 to 20 percent white and the edge highlight follows the pointer; no lift, no scale |

- Plays the first time a card is 35 percent in view. It does not replay.
- With reduced motion, every card shows its final state at once.
- Nothing loops. The film in the hero is the only thing on the page that never stops.

## Files

| File | Change |
|---|---|
| `components/landing/Card.tsx` (new) | the card: surface, header, edge highlight, bottom fade, in-view trigger |
| `components/landing/Scenes.tsx` (new) | bubble, status line, rows, and the six scenes |
| `components/landing/Stages.tsx` | the three graphs redrawn to the rules above; the old `Stage` panel goes |
| `components/landing/ConsoleShots.tsx` | replaced by the three step scenes |
| `components/landing/Sections.tsx` | both sections use the new card |
| `app/globals.css` | the status swap and edge-highlight styles |

## Done means

1. The six cards are the same height, the same surface and the same header.
2. No card contains a bordered box inside a bordered box.
3. Each graph has at most two colours and no tick labels.
4. Every card plays once, in under two seconds, and looks finished with reduced motion.
5. The Approve card still works.
6. No sideways scroll at 375, 768 and 1440 px.

## Open questions

1. **Window dots in the header** (minimise, expand, close): Linear has them because its
   cards are app windows. Ours could keep them as decoration or drop them.
2. **Should the graphs lose their numbers this far?** The spend and the 94 percent stay
   in the chips; the axis numbers go.

## As built (2026-11-17)

- **Height:** 316 px desktop, 300 px phones, not 420/360. At 420 every card had an empty
  lower half.
- **Budgets:** the monthly cap is a thin meter above the bars instead of a hairline
  across them. Daily bars and a monthly cap don't share a scale, so a line across the
  bars would have been misleading. A two-item legend stays, because the two colours
  need names.
- **Burndown:** line names sit at the line ends, pushed apart so they keep 13 px
  between them.
- **Header window dots** (question 1): kept, faint, decoration only.
- **Hover:** the border brightens and a second hairline follows the pointer; near the
  top-left corner it shows faintly at rest.
- **Not deleted:** `ConsoleShots.tsx` and the old graph components in `Stages.tsx` are
  no longer used by these sections but are still in the repo.

Checked in the browser at 1440 px and 375 px: all six cards the same size, each status
line swaps after its scene, Approve and "Show it again" work, no sideways scroll and
nothing overflowing a card. **Not checked:** the motion as it plays (the browser pane was
hidden, so only finished frames were seen) and reduced motion in a real browser.

## Revised to match linear.app's agent cards (2026-11-18)

Measured on linear.app/homepage (the Cursor card): header padding 14px 14px 14px 20px; a
16px round avatar with a 0.5px inner ring; the name at 13px/500 in #d0d6e0; the prompt
as a bubble on the right (40px left inset, panel colour plus 4% white, a 1px dark ring,
radius 8); "ENG-2844 added to context" right-aligned at 12px in #8a8f98 / #62666d;
"Thinking…" 32px tall in #62666d; text ramp #f7f8f8 / #d0d6e0 / #8a8f98 / #62666d.

The three "How it works" cards are now short conversations built from those pieces
(`Prompt`, `Context`, `Thinking`, `Reply`, `Issue`, `Task` in `Card.tsx`):
- "Thinking…" shimmers, then becomes "Worked for 6 sec".
- Issues are mentioned inline as pills (status icon, key, title).
- A running task row has Linear's 3x3 dot grid pulsing in a diagonal wave and a timer
  that counts up while the card is on screen.

The spend-and-trust graphs went back to their earlier versions (`Stages.tsx`) at the
user's request.
