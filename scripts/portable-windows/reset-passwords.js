// Réinitialise les mots de passe après la première restauration de la base (portable).
// Admins -> Helpdesk2026 · autres comptes -> Agent2026 (changement demandé à la 1re connexion).
const { hashPassword } = require('./dist/src/utils/password');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const ADMIN_PASS = 'Helpdesk2026';
  const AGENT_PASS = 'Agent2026';

  const adminRole = await p.role.findFirst({ where: { name: 'Administrateur' } });
  if (!adminRole) throw new Error('Role Administrateur introuvable');

  const admins = await p.user.updateMany({
    where: { roleId: adminRole.id },
    data: { password: await hashPassword(ADMIN_PASS), mustChangePassword: false },
  });
  const others = await p.user.updateMany({
    where: { roleId: { not: adminRole.id } },
    data: { password: await hashPassword(AGENT_PASS), mustChangePassword: true },
  });
  console.log(`Admins : ${admins.count} compte(s) -> ${ADMIN_PASS}`);
  console.log(`Autres : ${others.count} compte(s) -> ${AGENT_PASS}`);

  const users = await p.user.findMany({
    select: { email: true, role: { select: { name: true } } },
    orderBy: { role: { name: 'asc' } },
  });
  users.forEach((u) => console.log(`  [${u.role.name}] ${u.email}`));
  await p.$disconnect();
}

run().catch((e) => {
  console.error('ERREUR:', e.message);
  process.exit(1);
});
