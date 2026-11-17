import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ADMIN_PERMISSIONS, AGENT_PERMISSIONS } from '../src/config/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Roles ────────────────────────────────────────────────────────────────

  const adminRole = await prisma.role.upsert({
    where: { name: 'Administrateur' },
    update: { permissions: ADMIN_PERMISSIONS },
    create: {
      name: 'Administrateur',
      description: 'Accès complet à toutes les fonctionnalités',
      isSystem: true,
      permissions: ADMIN_PERMISSIONS,
    },
  });

  const agentRole = await prisma.role.upsert({
    where: { name: 'Agent' },
    update: { permissions: AGENT_PERMISSIONS },
    create: {
      name: 'Agent',
      description: 'Agent de support standard',
      isSystem: true,
      permissions: AGENT_PERMISSIONS,
    },
  });

  console.log('✅ Roles created');

  // ─── Users ────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('admin123', 12);
  const agentPassword = await bcrypt.hash('agent123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@helpdesk.com' },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Système',
      email: 'admin@helpdesk.com',
      password: adminPassword,
      roleId: adminRole.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { email: 'agent1@helpdesk.com' },
    update: {},
    create: {
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'agent1@helpdesk.com',
      password: agentPassword,
      roleId: agentRole.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'agent2@helpdesk.com' },
    update: {},
    create: {
      firstName: 'Thomas',
      lastName: 'Martin',
      email: 'agent2@helpdesk.com',
      password: agentPassword,
      roleId: agentRole.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'agent3@helpdesk.com' },
    update: {},
    create: {
      firstName: 'Sophie',
      lastName: 'Bernard',
      email: 'agent3@helpdesk.com',
      password: agentPassword,
      roleId: agentRole.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log('✅ Users created');

  // ─── Categories ───────────────────────────────────────────────────────────

  const catMateriel = await prisma.category.upsert({
    where: { name: 'Matériel' },
    update: {},
    create: { name: 'Matériel', slug: 'materiel', color: '#185FA5', icon: 'Monitor', position: 1, isActive: true },
  });
  const catLogiciel = await prisma.category.upsert({
    where: { name: 'Logiciel' },
    update: {},
    create: { name: 'Logiciel', slug: 'logiciel', color: '#534AB7', icon: 'Code', position: 2, isActive: true },
  });
  const catReseau = await prisma.category.upsert({
    where: { name: 'Réseau' },
    update: {},
    create: { name: 'Réseau', slug: 'reseau', color: '#0F6E56', icon: 'Wifi', position: 3, isActive: true },
  });
  const catAcces = await prisma.category.upsert({
    where: { name: 'Accès' },
    update: {},
    create: { name: 'Accès', slug: 'acces', color: '#854F0B', icon: 'Lock', position: 4, isActive: true },
  });
  const catAutre = await prisma.category.upsert({
    where: { name: 'Autre' },
    update: {},
    create: { name: 'Autre', slug: 'autre', color: '#5F5E5A', icon: 'LifeBuoy', position: 5, isActive: true },
  });

  console.log('✅ Categories created');

  // ─── Settings ─────────────────────────────────────────────────────────────

  const settingsData = [
    { key: 'company_name', value: 'Mon Helpdesk' },
  ];

  for (const s of settingsData) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log('✅ Settings created');
  console.log('');
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('Default credentials:');
  console.log('  admin@helpdesk.com  / admin123  (Administrateur)');
  console.log('  agent1@helpdesk.com / agent123  (Agent)');
  console.log('  agent2@helpdesk.com / agent123  (Agent)');
  console.log('  agent3@helpdesk.com / agent123  (Agent)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
