'use strict';

// Node-only shared core for running a round robin, used by both run.js (CLI,
// tight synchronous loop) and serve.js (server, chunked so it keeps
// answering HTTP requests between batches). Every game played is written to
// disk as SGF inside runOneJob - simulating and persisting are the same
// step, so nothing simulated is ever lost, even from a run that gets
// stopped early, and every game ever played (across every run, forever)
// accumulates as permanent history for games.html to browse.
//
// Filenames get a per-run id prefix (base36 timestamp) so two different
// runs - or two separate `node run.js` invocations - never collide/overwrite
// each other's files.

const fs = require('fs');
const path = require('path');
const { playMatch, teamName, KOMI } = require('./match');
const { gameToSGF } = require('./sgf');

function uniquePairs(names) {
  const teams = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i; j < names.length; j++) teams.push([names[i], names[j]]);
  }
  return teams;
}

function sameTeams(names) {
  return names.map((n) => [n, n]);
}

// Canonical grouping key for "this pairing of two strategies as teammates,
// regardless of which one moved first" - sorted, so ['mirror','random'] and
// ['random','mirror'] aggregate together. Distinct from teamName (match.js),
// which preserves actual agent order and is what goes in the SGF PB/PW
// fields and each game's exact display name.
function teamKey(team) {
  return [...team].sort().join('+');
}

function buildJobs({ strategyNames, mixed, trials, baseSeed = 1 }) {
  const teams = mixed ? uniquePairs(strategyNames) : sameTeams(strategyNames);
  const jobs = [];
  let seed = baseSeed;
  for (const blackTeam of teams) {
    for (const whiteTeam of teams) {
      for (let t = 0; t < trials; t++) jobs.push({ blackTeam, whiteTeam, seed: seed++ });
    }
  }
  return { teams, jobs };
}

function freshTally() {
  return { completed: 0, perStrategy: {}, perTeamPair: {}, games: [] };
}

function newRunId() {
  return Date.now().toString(36);
}

// Plays one job, writes its SGF, updates `tally` in place, returns the
// lightweight index record (also pushed onto tally.games).
function runOneJob(job, gamesDir, runId, seq, tally) {
  const { blackTeam, whiteTeam, seed } = job;
  const result = playMatch({ blackTeam, whiteTeam, seed });
  const file = `game_${runId}_${String(seq).padStart(4, '0')}_${result.blackName}_vs_${result.whiteName}.sgf`;
  fs.mkdirSync(gamesDir, { recursive: true });
  fs.writeFileSync(path.join(gamesDir, file), gameToSGF(result, KOMI));

  const blackWon = result.winner === result.blackName;
  const whiteWon = result.winner === result.whiteName;

  for (const n of new Set(result.blackStrategies)) {
    if (!tally.perStrategy[n]) tally.perStrategy[n] = { wins: 0, games: 0 };
    tally.perStrategy[n].games++;
    if (blackWon) tally.perStrategy[n].wins++;
  }
  for (const n of new Set(result.whiteStrategies)) {
    if (!tally.perStrategy[n]) tally.perStrategy[n] = { wins: 0, games: 0 };
    tally.perStrategy[n].games++;
    if (whiteWon) tally.perStrategy[n].wins++;
  }

  for (const [team, won] of [[blackTeam, blackWon], [whiteTeam, whiteWon]]) {
    const key = teamKey(team);
    if (!tally.perTeamPair[key]) tally.perTeamPair[key] = { label: teamName(team), wins: 0, games: 0 };
    tally.perTeamPair[key].games++;
    if (won) tally.perTeamPair[key].wins++;
  }

  const record = {
    file,
    blackName: result.blackName, whiteName: result.whiteName,
    blackKey: teamKey(blackTeam), whiteKey: teamKey(whiteTeam),
    winner: result.winner, blackScore: result.score.black, whiteScore: result.score.white,
    moveCount: result.moveCount, seed,
  };
  tally.games.push(record);
  tally.completed++;
  return record;
}

module.exports = { uniquePairs, sameTeams, teamKey, buildJobs, freshTally, newRunId, runOneJob };
