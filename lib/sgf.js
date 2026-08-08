'use strict';

// SGF (Smart Game Format) reader/writer - the standard file format for
// stored Go games (same role PGN plays for chess). Deliberately minimal:
// only what SGF actually needs (moves + result + player names + komi) is
// written, so any real SGF viewer can open these files. The one addition is
// a standard LB (label) property on each move recording which of the two
// teammates played it ("1"/"2") - that's ordinary SGF, just repurposed.
// Captures are NOT stored - replay derives them by replaying the moves
// through board.js's real rules engine, which is what keeps the file
// genuinely standard instead of an app-specific dump.

(function () {

const boardLib = (typeof module !== 'undefined' && module.exports)
  ? require('./board')
  : window.GoTourney;
const { SIZE, BLACK, WHITE } = boardLib;

function coordToSGF(x, y) {
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y);
}

function sgfToCoord(s) {
  return { x: s.charCodeAt(0) - 97, y: s.charCodeAt(1) - 97 };
}

// SGF text values escape '\' and ']'.
function escapeSGF(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

function unescapeSGF(s) {
  return s.replace(/\\\]/g, ']').replace(/\\\\/g, '\\');
}

function resultString(result) {
  if (result.winnerColor == null) return '0';
  const margin = Math.abs(result.score.black - result.score.white);
  const marginStr = Number.isInteger(margin) ? String(margin) : margin.toFixed(1);
  return (result.winnerColor === BLACK ? 'B+' : 'W+') + marginStr;
}

function gameToSGF(result, komi) {
  const lines = [];
  lines.push(
    `(;GM[1]FF[4]SZ[${SIZE}]KM[${komi.toFixed(2)}]`
    + `PB[${escapeSGF(result.blackName)}]PW[${escapeSGF(result.whiteName)}]`
    + `RE[${resultString(result)}]GC[seed ${result.seed}]`
  );
  for (const mv of result.moves) {
    const colorTag = mv.color === BLACK ? 'B' : 'W';
    const agentNum = mv.agent.slice(1);
    if (mv.pass) {
      lines.push(`;${colorTag}[]AG[${agentNum}]C[${mv.agent} passes]`);
    } else {
      const pt = coordToSGF(mv.x, mv.y);
      lines.push(`;${colorTag}[${pt}]LB[${pt}:${agentNum}]AG[${agentNum}]`);
    }
  }
  lines.push(')');
  return lines.join('\n');
}

// Only needs to round-trip files this module itself writes - single game
// tree, no variations, one property-set per move. Not a general SGF parser.
function parseSGF(text) {
  const body = text.trim().replace(/^\(/, '').replace(/\)\s*$/, '');
  const nodes = body.split(';').map((s) => s.trim()).filter(Boolean);

  const propPattern = /([A-Z]+)((?:\[(?:[^\]\\]|\\.)*\])+)/g;
  function parseProps(node) {
    const props = {};
    let m;
    propPattern.lastIndex = 0;
    while ((m = propPattern.exec(node))) {
      const key = m[1];
      const values = [];
      const valuePattern = /\[((?:[^\]\\]|\\.)*)\]/g;
      let vm;
      while ((vm = valuePattern.exec(m[2]))) values.push(unescapeSGF(vm[1]));
      props[key] = values;
    }
    return props;
  }

  const header = parseProps(nodes[0]);
  const komi = parseFloat(header.KM?.[0] ?? '0');
  const blackName = header.PB?.[0] ?? 'black';
  const whiteName = header.PW?.[0] ?? 'white';
  const result = header.RE?.[0] ?? '';
  const size = parseInt(header.SZ?.[0] ?? String(SIZE), 10);

  const moves = [];
  for (let i = 1; i < nodes.length; i++) {
    const props = parseProps(nodes[i]);
    const colorTag = 'B' in props ? 'B' : ('W' in props ? 'W' : null);
    if (!colorTag) continue;
    const color = colorTag === 'B' ? BLACK : WHITE;
    const raw = props[colorTag][0];
    const agentNum = props.AG?.[0] ?? props.LB?.[0]?.split(':')[1] ?? '?';
    const agent = (colorTag === 'B' ? 'A' : 'B') + agentNum;
    if (!raw) {
      moves.push({ color, pass: true, agent });
    } else {
      const { x, y } = sgfToCoord(raw);
      moves.push({ color, x, y, agent });
    }
  }

  return { size, komi, blackName, whiteName, result, moves };
}

const EXPORTS = { gameToSGF, parseSGF, coordToSGF, sgfToCoord };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXPORTS;
} else {
  window.GoTourney = Object.assign(window.GoTourney || {}, EXPORTS);
}

})();
