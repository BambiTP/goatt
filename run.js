#!/usr/bin/env node
'use strict';

const path = require('path');
const { runTournament } = require('./lib/tournament');

const trials = parseInt(process.argv[2], 10) || 5;
const outDir = path.join(__dirname, 'results');

console.log(`Running same-strategy-team round robin: ${trials} trials per pairing...`);
const start = Date.now();
const { results, winRate } = runTournament({ trialsPerPairing: trials, outDir });
console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s. ${results.length} games played. Results in ${outDir}`);

console.log('\nOverall win rate:');
const names = Object.keys(winRate).sort((a, b) => (winRate[b].wins / winRate[b].games) - (winRate[a].wins / winRate[a].games));
for (const name of names) {
  const { wins, games } = winRate[name];
  const pct = games ? ((wins / games) * 100).toFixed(1) : '0.0';
  console.log(`  ${name.padEnd(18)} ${pct}%  (${wins}/${games})`);
}
