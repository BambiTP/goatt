'use strict';

// Plays one full game between two 2-agent teams. Teammates can run
// different strategies now (not just the same one per side) - each side
// alternates which of its two agents is "on move" every turn, tagged A1/A2
// (black) or B1/B2 (white) in the move log so the replay viewer can show
// who did what.

(function () {

const boardLib = (typeof module !== 'undefined' && module.exports)
  ? require('./board')
  : window.GoTourney;
const stratLib = (typeof module !== 'undefined' && module.exports)
  ? require('./strategies')
  : window.GoTourney;
const { Board, BLACK, WHITE } = boardLib;
const { STRATEGIES } = stratLib;

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_MOVES = 300;
const KOMI = 0;

function resolveStrategy(nameOrFn) {
  return typeof nameOrFn === 'function' ? nameOrFn : STRATEGIES[nameOrFn];
}

function teamName(team) {
  return team.filter((s) => typeof s === 'string').join('+') || 'custom';
}

// blackTeam/whiteTeam: [strategyName|fn, strategyName|fn] - two agents per
// side, sharing a color, alternating turns.
function playMatch({ blackTeam, whiteTeam, seed = 1, blackName, whiteName }) {
  const board = new Board();
  const rng = mulberry32(seed);
  const blackFns = blackTeam.map(resolveStrategy);
  const whiteFns = whiteTeam.map(resolveStrategy);
  const fns = { [BLACK]: blackFns, [WHITE]: whiteFns };

  const log = [];
  const ownLastMove = { [BLACK]: null, [WHITE]: null };
  const agentTurn = { [BLACK]: 0, [WHITE]: 0 };
  let consecutivePasses = 0;
  let moveNumber = 0;
  let color = BLACK;

  while (moveNumber < MAX_MOVES && consecutivePasses < 2) {
    const legalMoves = board.legalMoves(color);
    const opponent = color === BLACK ? WHITE : BLACK;
    const ctx = {
      board, color,
      legalMoves,
      ownLastMove: ownLastMove[color],
      oppLastMove: ownLastMove[opponent],
      rng,
    };
    const agentIndex = agentTurn[color];
    const choice = legalMoves.length ? fns[color][agentIndex](ctx) : null;
    const agentLabel = (color === BLACK ? 'A' : 'B') + (agentIndex + 1);
    moveNumber++;

    if (!choice) {
      log.push({ moveNumber, color, agent: agentLabel, pass: true });
      consecutivePasses++;
    } else {
      const captured = board.play(color, choice.x, choice.y);
      log.push({ moveNumber, color, agent: agentLabel, x: choice.x, y: choice.y, captured });
      ownLastMove[color] = { x: choice.x, y: choice.y };
      consecutivePasses = 0;
    }

    agentTurn[color] = 1 - agentIndex;
    color = opponent;
  }

  const score = board.scoreArea(KOMI);
  const winnerColor = score.black === score.white ? null : (score.black > score.white ? BLACK : WHITE);
  const bName = blackName || teamName(blackTeam);
  const wName = whiteName || teamName(whiteTeam);

  return {
    blackName: bName,
    whiteName: wName,
    blackStrategies: blackTeam.filter((s) => typeof s === 'string'),
    whiteStrategies: whiteTeam.filter((s) => typeof s === 'string'),
    seed,
    moves: log,
    finalBoard: Array.from(board.grid),
    score,
    winner: winnerColor === BLACK ? bName : winnerColor === WHITE ? wName : 'draw',
    winnerColor,
    moveCount: moveNumber,
  };
}

const EXPORTS = { playMatch, MAX_MOVES, KOMI, teamName };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPORTS;
} else {
  window.GoTourney = Object.assign(window.GoTourney || {}, EXPORTS);
}

})();
