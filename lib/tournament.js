'use strict';

// Node-only bulk runner: headless round robin, writes every game to disk as
// standard SGF (for replay.html/games.html) plus a summary/matrix. Defaults
// to same-strategy teams (11x11) so `node run.js` stays simple; pass an
// explicit `teams` list of [strat1,strat2] pairs for mixed-teammate runs.

const fs = require('fs');
const path = require('path');
const { playMatch, KOMI } = require('./match');
const { STRATEGIES } = require('./strategies');
const { gameToSGF } = require('./sgf');

function defaultTeams(strategyNames) {
  return strategyNames.map((s) => [s, s]);
}

function runTournament({
  trialsPerPairing = 10,
  outDir,
  strategyNames = Object.keys(STRATEGIES),
  teams = defaultTeams(strategyNames),
  baseSeed = 1,
} = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const gamesDir = path.join(outDir, 'games');
  fs.mkdirSync(gamesDir, { recursive: true });

  const results = [];
  let seedCounter = baseSeed;
  let gameId = 0;

  for (const blackTeam of teams) {
    for (const whiteTeam of teams) {
      for (let t = 0; t < trialsPerPairing; t++) {
        const seed = seedCounter++;
        const result = playMatch({ blackTeam, whiteTeam, seed });
        gameId++;
        const gameFile = `game_${String(gameId).padStart(5, '0')}_${result.blackName}_vs_${result.whiteName}.sgf`;
        fs.writeFileSync(path.join(gamesDir, gameFile), gameToSGF(result, KOMI));
        results.push({
          gameId, file: gameFile,
          blackName: result.blackName, whiteName: result.whiteName,
          blackStrategies: result.blackStrategies, whiteStrategies: result.whiteStrategies,
          seed,
          winner: result.winner, blackScore: result.score.black, whiteScore: result.score.white,
          moveCount: result.moveCount,
        });
      }
    }
  }

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));

  // Each team's win/loss is credited to both of its member strategies -
  // team names are joined ("random+random"), so attribution has to go
  // through blackStrategies/whiteStrategies, not a name match.
  const winRate = {};
  for (const name of strategyNames) winRate[name] = { wins: 0, games: 0 };
  for (const r of results) {
    const blackWon = r.winner === r.blackName;
    const whiteWon = r.winner === r.whiteName;
    for (const name of new Set(r.blackStrategies)) {
      if (!(name in winRate)) continue;
      winRate[name].games++;
      if (blackWon) winRate[name].wins++;
    }
    for (const name of new Set(r.whiteStrategies)) {
      if (!(name in winRate)) continue;
      winRate[name].games++;
      if (whiteWon) winRate[name].wins++;
    }
  }

  fs.writeFileSync(path.join(outDir, 'winRate.json'), JSON.stringify(winRate, null, 2));
  return { results, winRate };
}

module.exports = { runTournament, defaultTeams };
