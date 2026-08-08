'use strict';

// Minimal 9x9 Go rules engine: legal moves (suicide prohibited, positional
// superko), capture resolution, Chinese (area) scoring. No territory/dead-
// stone judgment needed - area scoring makes "keep playing until no legal
// move remains" scoring-safe, which is what lets the simple bots in
// strategies.js skip real pass judgment entirely.
//
// Wrapped in an IIFE: classic (non-module) <script> tags share ONE global
// lexical scope for top-level const/let/class, so without this, loading
// board.js + strategies.js + match.js on the same page throws "Identifier
// already declared" the moment two files both have a top-level `const SIZE`
// or `class Board`. Node's CommonJS wrapper already gives each file its own
// scope, so this is a no-op there - it's purely for the browser.
(function () {

const SIZE = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2;

function idx(x, y) { return y * SIZE + x; }
function inBounds(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }

const NEIGHBOR_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

class Board {
  constructor() {
    this.grid = new Uint8Array(SIZE * SIZE);
    this.history = new Set();
    this.history.add(this.serialize());
  }

  serialize() {
    return this.grid.join('');
  }

  clone() {
    const b = Object.create(Board.prototype);
    b.grid = Uint8Array.from(this.grid);
    b.history = this.history; // read-only inside tryMove; play() owns writes
    return b;
  }

  neighbors(x, y) {
    const out = [];
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny)) out.push([nx, ny]);
    }
    return out;
  }

  groupAndLiberties(x, y) {
    const color = this.grid[idx(x, y)];
    if (color === EMPTY) return null;
    const stones = [];
    const liberties = new Set();
    const seen = new Set([idx(x, y)]);
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      stones.push([cx, cy]);
      for (const [nx, ny] of this.neighbors(cx, cy)) {
        const ni = idx(nx, ny);
        const nc = this.grid[ni];
        if (nc === EMPTY) {
          liberties.add(ni);
        } else if (nc === color && !seen.has(ni)) {
          seen.add(ni);
          stack.push([nx, ny]);
        }
      }
    }
    return { stones, liberties };
  }

  // Pure: never mutates `this`. Returns {ok:false} or {ok:true, captured,
  // resultBoard, key} - caller decides whether to commit via play().
  tryMove(color, x, y) {
    if (!inBounds(x, y) || this.grid[idx(x, y)] !== EMPTY) return { ok: false };

    const clone = this.clone();
    clone.grid[idx(x, y)] = color;
    const opponent = color === BLACK ? WHITE : BLACK;

    const captured = [];
    const checked = new Set();
    for (const [nx, ny] of clone.neighbors(x, y)) {
      const ni = idx(nx, ny);
      if (clone.grid[ni] === opponent && !checked.has(ni)) {
        const g = clone.groupAndLiberties(nx, ny);
        for (const [sx, sy] of g.stones) checked.add(idx(sx, sy));
        if (g.liberties.size === 0) {
          for (const [sx, sy] of g.stones) {
            clone.grid[idx(sx, sy)] = EMPTY;
            captured.push([sx, sy]);
          }
        }
      }
    }

    const ownGroup = clone.groupAndLiberties(x, y);
    if (ownGroup.liberties.size === 0) return { ok: false, suicide: true };

    const key = clone.serialize();
    if (this.history.has(key)) return { ok: false, koViolation: true };

    return { ok: true, captured, resultBoard: clone, key };
  }

  play(color, x, y) {
    const result = this.tryMove(color, x, y);
    if (!result.ok) throw new Error(`illegal move for ${color} at ${x},${y}`);
    this.grid = result.resultBoard.grid;
    this.history.add(result.key);
    return result.captured;
  }

  legalMoves(color) {
    const moves = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.grid[idx(x, y)] !== EMPTY) continue;
        const r = this.tryMove(color, x, y);
        if (r.ok) moves.push({ x, y, capturedCount: r.captured.length });
      }
    }
    return moves;
  }

  stonesOf(color) {
    const out = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.grid[idx(x, y)] === color) out.push({ x, y });
      }
    }
    return out;
  }

  // Resulting liberty count of the group at (x,y) if `color` played there.
  libertiesAfter(color, x, y) {
    const r = this.tryMove(color, x, y);
    if (!r.ok) return -1;
    return r.resultBoard.groupAndLiberties(x, y).liberties.size;
  }

  // Minimum resulting liberty count among opponent groups touched by this
  // move, or Infinity if the move touches no opponent group.
  opponentLibertiesAfter(color, x, y) {
    const r = this.tryMove(color, x, y);
    if (!r.ok) return Infinity;
    const opponent = color === BLACK ? WHITE : BLACK;
    let min = Infinity;
    const checked = new Set();
    for (const [nx, ny] of r.resultBoard.neighbors(x, y)) {
      const ni = idx(nx, ny);
      if (r.resultBoard.grid[ni] === opponent && !checked.has(ni)) {
        const g = r.resultBoard.groupAndLiberties(nx, ny);
        for (const [sx, sy] of g.stones) checked.add(idx(sx, sy));
        min = Math.min(min, g.liberties.size);
      }
    }
    return min;
  }

  // Chinese/area scoring: stones on board + empty regions bordered by only
  // one color. Neutral (dame) or fully-open regions count for no one.
  scoreArea(komi) {
    const visited = new Uint8Array(SIZE * SIZE);
    let black = 0, white = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = idx(x, y);
        if (this.grid[i] === BLACK) { black++; continue; }
        if (this.grid[i] === WHITE) { white++; continue; }
        if (visited[i]) continue;

        const region = [];
        const borders = new Set();
        const stack = [[x, y]];
        visited[i] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          region.push(idx(cx, cy));
          for (const [nx, ny] of this.neighbors(cx, cy)) {
            const ni = idx(nx, ny);
            const c = this.grid[ni];
            if (c === EMPTY) {
              if (!visited[ni]) { visited[ni] = 1; stack.push([nx, ny]); }
            } else {
              borders.add(c);
            }
          }
        }
        if (borders.size === 1) {
          if (borders.has(BLACK)) black += region.length;
          else white += region.length;
        }
      }
    }
    return { black, white: white + komi };
  }
}

// Isomorphic: required by run.js/tournament.js under Node, <script>-tagged
// by control.html/replay.html in the browser (same pattern as this repo's
// shared/replayFormat.js) - board.js must load before any file that reads
// window.GoTourney.
const EXPORTS = { Board, SIZE, EMPTY, BLACK, WHITE };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPORTS;
} else {
  window.GoTourney = Object.assign(window.GoTourney || {}, EXPORTS);
}

})();
