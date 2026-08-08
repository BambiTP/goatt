#!/usr/bin/env node
'use strict';

const path = require('path');
const { STRATEGIES } = require('./lib/strategies');
const { buildJobs, freshTally, newRunId, runOneJob } = require('./lib/runEngine');

const trials = parseInt(process.argv[2], 10) || 5;
const strategyNames = Object.keys(STRATEGIES);
const gamesDir = path.join(__dirname, 'results', 'games');

console.log(`Running same-strategy-team round robin: ${trials} trials per pairing...`);
const start = Date.now();

const { jobs } = buildJobs({ strategyNames, mixed: false, trials });
const tally = freshTally();
const runId = newRunId();
for (let i = 0; i < jobs.length; i++) runOneJob(jobs[i], gamesDir, runId, i + 1, tally);

console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s. ${tally.completed} games played. SGF files in ${gamesDir}`);

console.log('\nOverall win rate:');
const names = strategyNames.slice().sort((a, b) => (tally.perStrategy[b]?.wins / tally.perStrategy[b]?.games || 0) - (tally.perStrategy[a]?.wins / tally.perStrategy[a]?.games || 0));
for (const name of names) {
  const s = tally.perStrategy[name];
  const pct = s?.games ? ((s.wins / s.games) * 100).toFixed(1) : '0.0';
  console.log(`  ${name.padEnd(18)} ${pct}%  (${s?.wins ?? 0}/${s?.games ?? 0})`);
}
