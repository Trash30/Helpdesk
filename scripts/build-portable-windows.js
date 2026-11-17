/**
 * Assemble la version portable Windows (sans installation) dans helpdesk-usb/windows-portable/.
 *
 * Usage :  node scripts/build-portable-windows.js
 * Prérequis : Node (celui qui lance le script est embarqué), PostgreSQL 15 installé
 *   (ses binaires sont copiés ; chemin surchargeable via PG_HOME), accès npm.
 * La base embarquée = helpdesk-usb/db/helpdesk_dev.sql (dump du schéma courant).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'helpdesk-usb', 'windows-portable');
const PG_HOME = process.env.PG_HOME || 'C:\\Program Files\\PostgreSQL\\15';
const DUMP = path.join(ROOT, 'helpdesk-usb', 'db', 'helpdesk_dev.sql');
const SRC = path.join(__dirname, 'portable-windows');

const run = (cmd, cwd, env = {}) =>
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

for (const p of [PG_HOME, DUMP]) {
  if (!fs.existsSync(p)) throw new Error('Introuvable : ' + p);
}

console.log('\n== 1/6 Build client + serveur');
run('npx vite build', path.join(ROOT, 'client'));
fs.rmSync(path.join(ROOT, 'server', 'dist'), { recursive: true, force: true });
run('npx tsc', path.join(ROOT, 'server'));

console.log('\n== 2/6 Dossier de sortie (data/ préservé)');
fs.mkdirSync(OUT, { recursive: true });
for (const d of ['app', 'node', 'pgsql', 'db']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

console.log('\n== 3/6 Node + PostgreSQL embarqués');
fs.mkdirSync(path.join(OUT, 'node'), { recursive: true });
fs.copyFileSync(process.execPath, path.join(OUT, 'node', 'node.exe'));
for (const d of ['bin', 'lib', 'share']) copy(path.join(PG_HOME, d), path.join(OUT, 'pgsql', d));

console.log('\n== 4/6 Application');
const appServer = path.join(OUT, 'app', 'server');
fs.mkdirSync(appServer, { recursive: true });
copy(path.join(ROOT, 'server', 'dist'), path.join(appServer, 'dist'));
copy(path.join(ROOT, 'client', 'dist'), path.join(OUT, 'app', 'client', 'dist'));
fs.mkdirSync(path.join(appServer, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'server', 'prisma', 'schema.prisma'), path.join(appServer, 'prisma', 'schema.prisma'));
copy(path.join(ROOT, 'server', 'prisma', 'migrations'), path.join(appServer, 'prisma', 'migrations'));
for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(ROOT, 'server', f), path.join(appServer, f));
for (const f of ['portable-server.js', 'reset-passwords.js']) fs.copyFileSync(path.join(SRC, f), path.join(appServer, f));

console.log('\n== 5/6 Dépendances de production + client Prisma (Windows)');
run('npm ci --omit=dev --no-audit --no-fund', appServer, { PUPPETEER_SKIP_DOWNLOAD: '1' });
run('node node_modules/prisma/build/index.js generate', appServer);

console.log('\n== 6/6 Base, lanceurs, notice');
fs.mkdirSync(path.join(OUT, 'db'), { recursive: true });
fs.copyFileSync(DUMP, path.join(OUT, 'db', 'helpdesk.sql'));
for (const f of ['Start-HelpDesk.bat', 'Stop-HelpDesk.bat', 'LISEZMOI.txt']) {
  const txt = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(path.join(OUT, f), txt);
}

const size = execSync(`du -sh "${OUT}"`, { encoding: 'utf8' }).split('\t')[0];
console.log(`\nOK -> ${OUT} (${size})`);
