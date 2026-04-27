#!/usr/bin/env node
/**
 * Build script — produit un dossier dist/ minifié pour la production.
 *
 * - Minifie tous les .html (HTML + CSS inline + JS inline)
 * - Minifie styles.css
 * - Copie tous les autres assets tels quels (images, PDF, CSV, JSON, JS)
 *
 * Usage : node scripts/build.js
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const HTML_OPTS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
  // Conserve les espaces dans les <pre>/<textarea>
  conservativeCollapse: false,
};

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist',
  '.image-backup-before-webp', '.tmp-downloads',
  '.claude', '.vscode',
  'scripts',
]);
const SKIP_FILES = new Set([
  '.DS_Store',
  '.gitignore', '.gitattributes',
  '.asset-mapping.json',
  'package.json', 'package-lock.json',
  'README.md',
  'Plan-migration-site-officiel.pdf',
  'Recap-deploiement-shootbytheo.pdf',
  'Guide-modifier-site-ChamblyBad.pdf',
  'Site-ChamblyBad-de-A-a-Z.pdf',
]);

function human(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

async function processFile(srcPath, distPath) {
  const ext = path.extname(srcPath).toLowerCase();
  const before = fs.statSync(srcPath).size;

  fs.mkdirSync(path.dirname(distPath), { recursive: true });

  if (ext === '.html') {
    const html = fs.readFileSync(srcPath, 'utf8');
    const minified = await minify(html, HTML_OPTS);
    fs.writeFileSync(distPath, minified);
  } else if (ext === '.css') {
    const css = fs.readFileSync(srcPath, 'utf8');
    const out = new CleanCSS({ level: 2, returnPromise: false }).minify(css);
    if (out.errors.length) {
      console.error('CSS errors in', srcPath, out.errors);
    }
    fs.writeFileSync(distPath, out.styles);
  } else {
    // Copy as-is
    fs.copyFileSync(srcPath, distPath);
  }

  const after = fs.statSync(distPath).size;
  return { before, after };
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await walk(path.join(dir, entry.name))));
    } else {
      if (SKIP_FILES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function main() {
  console.log(`Cleaning ${DIST}...`);
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const files = await walk(ROOT);
  console.log(`Processing ${files.length} files...\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const transformed = [];

  for (const src of files) {
    const rel = path.relative(ROOT, src);
    const dist = path.join(DIST, rel);
    try {
      const { before, after } = await processFile(src, dist);
      totalBefore += before;
      totalAfter += after;
      const ext = path.extname(src).toLowerCase();
      if (ext === '.html' || ext === '.css') {
        transformed.push({ rel, before, after });
      }
    } catch (e) {
      console.error(`  ✗ ${rel}: ${e.message}`);
    }
  }

  console.log('=' .repeat(70));
  console.log('FICHIERS MINIFIÉS');
  console.log('=' .repeat(70));
  for (const f of transformed) {
    const pct = ((1 - f.after / f.before) * 100).toFixed(0);
    console.log(
      `  ${f.rel.padEnd(40)} ${human(f.before).padStart(8)} → ${human(f.after).padStart(8)}  (-${pct}%)`,
    );
  }
  console.log('\n' + '=' .repeat(70));
  console.log('BILAN');
  console.log('=' .repeat(70));
  console.log(`  Avant : ${human(totalBefore)}`);
  console.log(`  Après : ${human(totalAfter)}`);
  const totalPct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(`  Gain  : ${human(totalBefore - totalAfter)} (-${totalPct}%)`);
  console.log(`\nOutput : ${DIST}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
