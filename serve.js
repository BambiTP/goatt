#!/usr/bin/env node
'use strict';

// Minimal static file server for this directory - control.html/replay.html
// load their lib/*.js via <script src> tags, which some browsers/extensions
// block under file:// but not http://, so this is the easiest way to view
// them reliably.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : 8934;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(ROOT, urlPath === '/' ? '/control.html' : urlPath);

  // Don't serve anything outside this directory.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`go-tourney serving at http://localhost:${PORT}/`);
  console.log(`  control panel: http://localhost:${PORT}/control.html`);
  console.log(`  replay viewer: http://localhost:${PORT}/replay.html`);
});
