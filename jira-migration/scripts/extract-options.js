#!/usr/bin/env node
/**
 * Extrait depuis la base Helpdesk les listes de valeurs qui deviendront
 * des options de champs Jira CSM (catégories, types, pôles, rôles clients,
 * organisations, clubs, agents).
 *
 * Usage (depuis la racine du projet) :
 *   node jira-migration/scripts/extract-options.js
 *
 * Sortie : jira-migration/config/options.generated.json
 * Utilise le client Prisma et le DATABASE_URL de server/.env.
 */
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.resolve(__dirname, '../../server');
require(path.join(SERVER_DIR, 'node_modules/dotenv')).config({ path: path.join(SERVER_DIR, '.env') });

const { PrismaClient } = require(path.join(SERVER_DIR, 'node_modules/@prisma/client'));
const prisma = new PrismaClient();

const OUT = path.resolve(__dirname, '../config/options.generated.json');

async function main() {
  const [categories, types, poles, clientRoles, organisations, clubs, agents] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { name: true, slug: true, color: true, isActive: true } }),
    prisma.ticketType.findMany({ orderBy: { position: 'asc' }, select: { name: true, isActive: true } }),
    prisma.clientPole.findMany({ orderBy: { position: 'asc' }, select: { name: true, isActive: true } }),
    prisma.clientRole.findMany({ orderBy: { position: 'asc' }, select: { name: true, isActive: true } }),
    prisma.clientOrganisation.findMany({ orderBy: { position: 'asc' }, select: { name: true, isActive: true } }),
    prisma.clientClub.findMany({
      orderBy: [{ organisation: { position: 'asc' } }, { position: 'asc' }],
      select: { name: true, isActive: true, organisation: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { lastName: 'asc' }, select: { firstName: true, lastName: true, email: true } }),
  ]);

  const payload = {
    _generatedAt: new Date().toISOString(),
    _source: (process.env.DATABASE_URL || '').replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@'),
    categories,
    ticketTypes: types,
    poles,
    clientRoles,
    organisations,
    clubs: clubs.map((c) => ({ name: c.name, organisation: c.organisation.name, isActive: c.isActive })),
    agents,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(`Ecrit : ${path.relative(process.cwd(), OUT)}`);
  for (const [k, v] of Object.entries(payload)) {
    if (Array.isArray(v)) console.log(`  ${k.padEnd(16)} ${v.length}`);
  }
}

main()
  .catch((e) => {
    console.error('Echec extraction :', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
