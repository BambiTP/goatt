'use strict';

// 11 deliberately simple, fixed ("repeating") move-choice rules - no
// learning, no lookahead, no score evaluation. Each is a pure function of
// the current legal-move list plus a little context. The interesting
// variable in the experiment is which of these wins, and which pairings
// make good teammates - not how clever any single bot is.

(function () {

const boardLib = (typeof module !== 'undefined' && module.exports)
  ? require('./board')
  : window.GoTourney;
const { SIZE, BLACK, WHITE } = boardLib;

const CENTER = { x: 4, y: 4 };

function pickRandom(list, rng) {
  if (!list.length) return null;
  return list[Math.floor(rng() * list.length)];
}

function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function distToNearestEdge(p) {
  return Math.min(p.x, SIZE - 1 - p.x, p.y, SIZE - 1 - p.y);
}

// The 4 corner star points (3-3 points) on a 9x9 board.
const STAR_POINTS = [
  { x: 2, y: 2 }, { x: SIZE - 3, y: 2 }, { x: 2, y: SIZE - 3 }, { x: SIZE - 3, y: SIZE - 3 },
];

function nearestCornerIndex(p) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < STAR_POINTS.length; i++) {
    const d = manhattan(p, STAR_POINTS[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Returns the item(s) minimizing scoreFn, tie broken uniformly at random.
function best(list, scoreFn, rng) {
  let bestScore = Infinity;
  let bests = [];
  for (const item of list) {
    const s = scoreFn(item);
    if (s < bestScore) { bestScore = s; bests = [item]; }
    else if (s === bestScore) bests.push(item);
  }
  return pickRandom(bests, rng);
}

const STRATEGIES = {
  random(ctx) {
    return pickRandom(ctx.legalMoves, ctx.rng);
  },

  selfAdjacent(ctx) {
    if (!ctx.ownLastMove) return STRATEGIES.random(ctx);
    const adj = ctx.legalMoves.filter((m) => manhattan(m, ctx.ownLastMove) === 1);
    return adj.length ? pickRandom(adj, ctx.rng) : STRATEGIES.random(ctx);
  },

  contact(ctx) {
    if (!ctx.oppLastMove) return STRATEGIES.random(ctx);
    const adj = ctx.legalMoves.filter((m) => manhattan(m, ctx.oppLastMove) === 1);
    return adj.length ? pickRandom(adj, ctx.rng) : STRATEGIES.random(ctx);
  },

  mirror(ctx) {
    if (!ctx.oppLastMove) return STRATEGIES.random(ctx);
    const mx = SIZE - 1 - ctx.oppLastMove.x;
    const my = SIZE - 1 - ctx.oppLastMove.y;
    const match = ctx.legalMoves.find((m) => m.x === mx && m.y === my);
    return match || STRATEGIES.random(ctx);
  },

  // Claims a corner star point immediately, then grows that corner's chain
  // one stone at a time from whichever of its own stones is furthest out
  // (the "tip"), preferring to stay on the 3rd line (distToNearestEdge===2)
  // and only dropping to the 2nd line when the 3rd line is cut off. Which
  // of the 4 corners gets extended each turn reacts to the opponent's last
  // move - no state is stored on the strategy itself (every strategy here
  // is a pure function of ctx, shared across every game in a tournament run
  // - stashing state on the function would leak between unrelated games),
  // so "which corner has which tip" is re-derived from the live board every
  // single call instead of remembered.
  cornerSeeker(ctx) {
    const ownStones = ctx.board.stonesOf(ctx.color);
    const anchor = ctx.oppLastMove || ctx.ownLastMove || ownStones[0] || null;
    const targetIdx = anchor ? nearestCornerIndex(anchor) : Math.floor(ctx.rng() * STAR_POINTS.length);
    const star = STAR_POINTS[targetIdx];

    const ownInCorner = ownStones.filter((s) => nearestCornerIndex(s) === targetIdx);
    if (!ownInCorner.length) {
      const atStar = ctx.legalMoves.find((m) => m.x === star.x && m.y === star.y);
      return atStar || best(ctx.legalMoves, (m) => manhattan(m, star), ctx.rng);
    }

    const tip = best(ownInCorner, (s) => -manhattan(s, star), ctx.rng);
    const adjacent = ctx.legalMoves.filter((m) => manhattan(m, tip) === 1);
    if (!adjacent.length) return STRATEGIES.random(ctx);

    const outward = adjacent.filter((m) => manhattan(m, star) > manhattan(tip, star));
    const pool = outward.length ? outward : adjacent;

    const thirdLine = pool.filter((m) => distToNearestEdge(m) === 2);
    if (thirdLine.length) return pickRandom(thirdLine, ctx.rng);

    const secondLine = pool.filter((m) => distToNearestEdge(m) === 1);
    if (secondLine.length) return pickRandom(secondLine, ctx.rng);

    return pickRandom(pool, ctx.rng);
  },

  centerSeeker(ctx) {
    return best(ctx.legalMoves, (m) => manhattan(m, CENTER), ctx.rng);
  },

  greedyCapture(ctx) {
    const capturing = ctx.legalMoves.filter((m) => m.capturedCount > 0);
    if (!capturing.length) return STRATEGIES.selfAdjacent(ctx);
    const max = Math.max(...capturing.map((m) => m.capturedCount));
    return pickRandom(capturing.filter((m) => m.capturedCount === max), ctx.rng);
  },

  libertyMaximizer(ctx) {
    return best(ctx.legalMoves, (m) => -ctx.board.libertiesAfter(ctx.color, m.x, m.y), ctx.rng);
  },

  spacer(ctx) {
    const stones = [...ctx.board.stonesOf(BLACK), ...ctx.board.stonesOf(WHITE)];
    if (!stones.length) return STRATEGIES.centerSeeker(ctx);
    return best(ctx.legalMoves, (m) => -Math.min(...stones.map((s) => manhattan(m, s))), ctx.rng);
  },

  libertyReducer(ctx) {
    const scored = ctx.legalMoves.map((m) => ({ m, v: ctx.board.opponentLibertiesAfter(ctx.color, m.x, m.y) }));
    const finite = scored.filter((s) => s.v < Infinity);
    if (!finite.length) return STRATEGIES.random(ctx);
    const min = Math.min(...finite.map((s) => s.v));
    return pickRandom(finite.filter((s) => s.v === min).map((s) => s.m), ctx.rng);
  },

  // One/two-space "jump" extension off your own last stone (straight line,
  // gap of 1-2), favoring whichever jump moves closer to an edge than the
  // origin stone; if none do, jump toward the center instead.
  jumpExtender(ctx) {
    if (!ctx.ownLastMove) return STRATEGIES.random(ctx);
    const origin = ctx.ownLastMove;
    const candidates = ctx.legalMoves.filter((m) => {
      const sameRow = m.y === origin.y && m.x !== origin.x && Math.abs(m.x - origin.x) <= 2;
      const sameCol = m.x === origin.x && m.y !== origin.y && Math.abs(m.y - origin.y) <= 2;
      return sameRow || sameCol;
    });
    if (!candidates.length) return STRATEGIES.random(ctx);
    const towardEdge = candidates.filter((m) => distToNearestEdge(m) < distToNearestEdge(origin));
    if (towardEdge.length) return pickRandom(towardEdge, ctx.rng);
    return best(candidates, (m) => manhattan(m, CENTER), ctx.rng);
  },
};

const EXPORTS = { STRATEGIES };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPORTS;
} else {
  window.GoTourney = Object.assign(window.GoTourney || {}, EXPORTS);
}

})();
