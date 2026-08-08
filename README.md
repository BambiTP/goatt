# goatt

A 9x9 Go tournament platform for testing deliberately simple, fixed bot
strategies against each other in teams of two.

## Why this exists

This started as a design conversation about a skill rating and matchmaking
system for a different (team-based, capture-the-flag) game, where the core
problem was: how do you rate an individual in a game where the outcome
depends heavily on teammates, not just 1v1 skill? That led through Elo/Glicko
generalizations, Bayesian skill+certainty updates, win/lose/toss-up
probability bands, and eventually the idea that a rating system converging
toward "the skill level where you win about half your games against your
current peers" is structurally the same thing as an evolution strategy - a
population doing a noisy random walk toward a stable equilibrium.

That's a hard thing to validate against a real multiplayer game, where every
data point requires real matches. This platform is the cheap version: a
small, fully-deterministic-given-a-seed game (9x9 Go), a catalog of simple
non-learning strategies instead of humans, and team-of-2 play so
teammate-pairing questions (does strategy A help or hurt when paired with
strategy B?) can be tested by just running thousands of games in seconds.

## What's actually here

**Rules engine** (`lib/board.js`) - legal moves, captures, suicide
prohibition, positional superko, Chinese/area scoring. Real Go rules, not a
simplification.

**11 strategies** (`lib/strategies.js`) - each a pure, fixed, non-learning
function of the current board (no persistent state, since the same strategy
function is reused across every game in a run - see the comment above
`cornerSeeker` for why that matters):

| Strategy | Rule |
|---|---|
| `random` | Uniform random legal move |
| `selfAdjacent` | Play adjacent to your own last stone |
| `contact` | Play adjacent to the opponent's last stone |
| `mirror` | Play the 180°-symmetric point of the opponent's last move |
| `cornerSeeker` | Claims a corner star point, extends that corner's chain outward one stone at a time, staying on the 3rd line until cut off then dropping to the 2nd; reacts to whichever corner the opponent just played into |
| `centerSeeker` | Play closest to the center point |
| `greedyCapture` | Play whichever legal move captures the most stones, else fall back |
| `libertyMaximizer` | Play whichever move leaves your group with the most liberties |
| `libertyReducer` | Play whichever move most reduces an adjacent enemy group's liberties |
| `spacer` | Play the point farthest from every existing stone |
| `jumpExtender` | One/two-space jump off your last stone, favoring the direction that moves toward an edge |

**Teams of 2** (`lib/match.js`) - each side is two agents sharing one color,
alternating turns (A1→B1→A2→B2→...). Teammates can run different
strategies, not just two copies of the same one, so "is X a good or bad
teammate for Y" is a real, testable question.

**SGF output** - `lib/sgf.js` reads/writes standard SGF (the same file
format real Go software uses), with per-stone teammate attribution (A1/A2 vs
B1/B2) stored via the standard `LB` label property, so files stay valid SGF
while still recording who played what. Captures aren't stored in the file -
replay derives them by replaying the moves through the real rules engine,
which is what keeps the format genuinely standard instead of an
app-specific dump.

**Two ways to run it:**

- `node run.js [trials]` - CLI round robin, same-strategy teams (11x11
  matchups), writes every game as `.sgf` to `results/games/` plus a console
  win-rate summary.
- `control.html` - open directly in a browser (or via `node serve.js` +
  `http://localhost:8934/control.html`). Self-contained dashboard: pick
  which strategies to include, set trials per matchup, optionally enable
  "mixed teammates" (pairs *different* strategies on one team - this is what
  makes the best/worst-teammates ranking meaningful), click Run, and watch
  live win-rate bars animate as it plays. Also shows best/worst teammate
  pairings and a head-to-head lookup between any two teams. Runs the whole
  simulation client-side in the browser tab.

`replay.html` is a drag-and-drop move-by-move viewer (SVG board, numbered
stones showing which teammate played each one).

## Known gap

`control.html`'s "download replay" and `replay.html`'s file loader currently
speak **JSON** (self-consistent with each other), while `run.js` writes
**SGF**. They haven't been reconciled yet - `replay.html` can't currently
open a file produced by `run.js`. Whichever format wins, the other side
needs updating; SGF is the more useful long-term choice since it's a real,
portable format any Go software can open, not just this project's own
viewer.

## Not built

A persistent games browser (list every game ever played, filter by bot
"profile", arrow-key through them) and a server-side simulation mode
(so the browser doesn't have to do the computation itself) were both
scoped but not implemented.
