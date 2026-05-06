#!/usr/bin/env node
/**
 * HelpDesk -- Reset mots de passe
 * Usage : node reset.js
 * Reinitialise tous les mots de passe :
 *   Administrateurs -> Helpdesk2026!
 *   Agents          -> Agent2026!
 */

const path = require('path');
const APP_SERVER = '/opt/helpdesk/server';

// Charger bcryptjs depuis l'app installee
let bcrypt;
try {
  bcrypt = require(path.join(APP_SERVER, 'node_modules', 'bcryptjs'));
} catch (e) {
  console.error('bcryptjs introuvable. Assurez-vous que l\'app est installee dans /opt/helpdesk');
  process.exit(1);
}

// Charger Prisma depuis l'app installee
let PrismaClient;
try {
  PrismaClient = require(path.join(APP_SERVER, 'node_modules', '@prisma', 'client')).PrismaClient;
} catch (e) {
  console.error('Prisma introuvable. Assurez-vous que l\'app est installee dans /opt/helpdesk');
  process.exit(1);
}

// Charger le .env
require(path.join(APP_SERVER, 'node_modules', 'dotenv')).config({
  path: path.join(APP_SERVER, '.env')
});

const prisma = new PrismaClient();

async function run() {
  console.log('');
  console.log('=== HelpDesk -- Reset mots de passe ===');
  console.log('');

  const ADMIN_PASS = 'Helpdesk2026!';
  const AGENT_PASS = 'Agent2026!';

  const adminHash = await bcrypt.hash(ADMIN_PASS, 10);
  const agentHash = await bcrypt.hash(AGENT_PASS, 10);

  const adminRole = await prisma.role.findFirst({ where: { name: 'Administrateur' } });
  if (!adminRole) {
    console.error('ERREUR : role Administrateur introuvable en base.');
    process.exit(1);
  }

  const admins = await prisma.user.updateMany({
    where: { roleId: adminRole.id },
    data: { password: adminHash, mustChangePassword: false }
  });

  const agents = await prisma.user.updateMany({
    where: { roleId: { not: adminRole.id } },
    data: { password: agentHash, mustChangePassword: true }
  });

  console.log('Administrateurs (' + admins.count + ') -> ' + ADMIN_PASS);
  console.log('Agents          (' + agents.count + ') -> ' + AGENT_PASS + '  (changement force a la connexion)');
  console.log('');

  const users = await prisma.user.findMany({
    select: { email: true, role: { select: { name: true } } },
    orderBy: { role: { name: 'asc' } }
  });

  console.log('Comptes :');
  users.forEach(u => {
    const role = u.role.name.padEnd(20);
    console.log('  [' + role + '] ' + u.email);
  });

  console.log('');
  console.log('Reset termine. Redemarrez l\'app : pm2 restart helpdesk-server');
  console.log('');

  await prisma.$disconnect();
}

run().catch(e => {
  console.error('ERREUR :', e.message);
  process.exit(1);
});
