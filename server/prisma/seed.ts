import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_PERMISSIONS = [
  'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.close',
  'tickets.delete', 'tickets.assign', 'tickets.viewAll',
  'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
  'comments.create', 'comments.delete', 'comments.deleteAny',
  'surveys.view', 'surveys.configure',
  'admin.access', 'admin.users', 'admin.roles', 'admin.categories',
  'admin.clientRoles', 'admin.settings',
];

const AGENT_PERMISSIONS = [
  'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.close',
  'tickets.assign', 'tickets.viewAll',
  'clients.view', 'clients.create', 'clients.edit',
  'comments.create', 'comments.delete',
];

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

  const admin = await prisma.user.upsert({
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

  const agent1 = await prisma.user.upsert({
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

  const agent2 = await prisma.user.upsert({
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

  const agent3 = await prisma.user.upsert({
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

  // ─── Client Roles ─────────────────────────────────────────────────────────

  const crIT = await prisma.clientRole.upsert({
    where: { name: 'Responsable IT' },
    update: {},
    create: { name: 'Responsable IT', color: '#185FA5', position: 1, isActive: true },
  });
  const crUser = await prisma.clientRole.upsert({
    where: { name: 'Utilisateur' },
    update: {},
    create: { name: 'Utilisateur', color: '#534AB7', position: 2, isActive: true },
  });
  const crDir = await prisma.clientRole.upsert({
    where: { name: 'Direction' },
    update: {},
    create: { name: 'Direction', color: '#3B6D11', position: 3, isActive: true },
  });
  const crPrest = await prisma.clientRole.upsert({
    where: { name: 'Prestataire' },
    update: {},
    create: { name: 'Prestataire', color: '#854F0B', position: 4, isActive: true },
  });
  const crAutre = await prisma.clientRole.upsert({
    where: { name: 'Autre' },
    update: {},
    create: { name: 'Autre', color: '#5F5E5A', position: 5, isActive: true },
  });

  console.log('✅ Client roles created');

  // ─── Clients (10) ─────────────────────────────────────────────────────────

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { id: 'seed-client-01' },
      update: {},
      create: { id: 'seed-client-01', firstName: 'Jean', lastName: 'Moreau', email: 'jean.moreau@acme.fr', phone: '0601020304', company: 'ACME Corp', roleId: crIT.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-02' },
      update: {},
      create: { id: 'seed-client-02', firstName: 'Claire', lastName: 'Petit', email: 'claire.petit@techno.fr', phone: '0602030405', company: 'Techno SAS', roleId: crUser.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-03' },
      update: {},
      create: { id: 'seed-client-03', firstName: 'Pierre', lastName: 'Durand', email: 'p.durand@globex.fr', phone: '0603040506', company: 'Globex', roleId: crDir.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-04' },
      update: {},
      create: { id: 'seed-client-04', firstName: 'Isabelle', lastName: 'Leroy', email: null, phone: '0604050607', company: 'Initech', roleId: crUser.id, isSurveyable: false },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-05' },
      update: {},
      create: { id: 'seed-client-05', firstName: 'Marc', lastName: 'Simon', email: 'marc.simon@contoso.fr', phone: '0605060708', company: 'Contoso', roleId: crPrest.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-06' },
      update: {},
      create: { id: 'seed-client-06', firstName: 'Nathalie', lastName: 'Roux', email: 'nathalie.roux@fabrikam.fr', phone: '0606070809', company: 'Fabrikam', roleId: crIT.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-07' },
      update: {},
      create: { id: 'seed-client-07', firstName: 'Luc', lastName: 'Girard', email: 'luc.girard@northwind.fr', phone: '0607080910', company: 'Northwind', roleId: crUser.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-08' },
      update: {},
      create: { id: 'seed-client-08', firstName: 'Sylvie', lastName: 'Blanc', email: null, phone: '0608091011', company: 'Adventure Works', roleId: crAutre.id, isSurveyable: false },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-09' },
      update: {},
      create: { id: 'seed-client-09', firstName: 'Paul', lastName: 'Mercier', email: 'paul.mercier@alpine.fr', phone: '0609101112', company: 'Alpine Industries', roleId: crDir.id, isSurveyable: true },
    }),
    prisma.client.upsert({
      where: { id: 'seed-client-10' },
      update: {},
      create: { id: 'seed-client-10', firstName: 'Julie', lastName: 'Laurent', email: 'julie.laurent@vertex.fr', phone: '0610111213', company: 'Vertex SA', roleId: crUser.id, isSurveyable: true },
    }),
  ]);

  console.log('✅ Clients created');

  // ─── Tickets (25) ─────────────────────────────────────────────────────────

  const agents = [agent1, agent2, agent3];
  const categories = [catMateriel, catLogiciel, catReseau, catAcces, catAutre];

  const ticketDefs = [
    { num: 'VG20260001', title: "PC ne démarre plus après mise à jour", desc: "L'ordinateur de bureau refuse de démarrer depuis la mise à jour Windows du week-end.", status: 'OPEN', priority: 'CRITICAL', cat: catMateriel, client: clients[0], agent: agent1 },
    { num: 'VG20260002', title: "Problème de connexion VPN", desc: "Impossible de se connecter au VPN d'entreprise depuis le domicile.", status: 'IN_PROGRESS', priority: 'HIGH', cat: catReseau, client: clients[1], agent: agent2 },
    { num: 'VG20260003', title: "Réinitialisation mot de passe AD", desc: "L'utilisateur a oublié son mot de passe Active Directory.", status: 'RESOLVED', priority: 'MEDIUM', cat: catAcces, client: clients[2], agent: agent1 },
    { num: 'VG20260004', title: "Imprimante réseau hors ligne", desc: "L'imprimante du service comptabilité n'est plus accessible depuis le réseau.", status: 'PENDING', priority: 'MEDIUM', cat: catMateriel, client: clients[3], agent: agent3 },
    { num: 'VG20260005', title: "Logiciel de facturation plante", desc: "Le logiciel ERP se ferme inopinément lors de la génération des factures.", status: 'IN_PROGRESS', priority: 'HIGH', cat: catLogiciel, client: clients[4], agent: agent2 },
    { num: 'VG20260006', title: "Mise à jour antivirus bloquée", desc: "Les postes du service RH n'arrivent pas à mettre à jour leur antivirus.", status: 'OPEN', priority: 'HIGH', cat: catLogiciel, client: clients[5], agent: null },
    { num: 'VG20260007', title: "Écran noir au démarrage", desc: "Trois postes affichent un écran noir après le logo Windows.", status: 'RESOLVED', priority: 'HIGH', cat: catMateriel, client: clients[6], agent: agent1 },
    { num: 'VG20260008', title: "Partage réseau inaccessible", desc: "Le dossier partagé \\\\serveur\\commun n'est plus accessible depuis la salle de réunion.", status: 'CLOSED', priority: 'MEDIUM', cat: catReseau, client: clients[7], agent: agent3 },
    { num: 'VG20260009', title: "Demande création compte utilisateur", desc: "Création d'un compte pour le nouveau stagiaire intégrant le service marketing.", status: 'RESOLVED', priority: 'LOW', cat: catAcces, client: clients[8], agent: agent2 },
    { num: 'VG20260010', title: "Clavier et souris sans fil déconnectés", desc: "Les périphériques sans fil se déconnectent aléatoirement.", status: 'CLOSED', priority: 'LOW', cat: catMateriel, client: clients[9], agent: agent1 },
    { num: 'VG20260011', title: "Messagerie Outlook lente", desc: "Outlook met plus de 2 minutes à charger les emails au démarrage.", status: 'OPEN', priority: 'MEDIUM', cat: catLogiciel, client: clients[0], agent: agent3 },
    { num: 'VG20260012', title: "Caméra web non détectée", desc: "La webcam USB n'est pas reconnue lors des réunions Teams.", status: 'IN_PROGRESS', priority: 'MEDIUM', cat: catMateriel, client: clients[1], agent: agent1 },
    { num: 'VG20260013', title: "Certificat SSL expiré sur site intranet", desc: "Alerte de sécurité lors de la navigation sur l'intranet.", status: 'OPEN', priority: 'CRITICAL', cat: catReseau, client: clients[2], agent: agent2 },
    { num: 'VG20260014', title: "Perte de données suite à crash disque", desc: "Disque dur en panne sur le poste direction. Récupération de données nécessaire.", status: 'IN_PROGRESS', priority: 'CRITICAL', cat: catMateriel, client: clients[3], agent: agent3 },
    { num: 'VG20260015', title: "Migration boite mail vers O365", desc: "Accompagnement migration de la boite mail historique vers Office 365.", status: 'PENDING', priority: 'MEDIUM', cat: catLogiciel, client: clients[4], agent: agent2 },
    { num: 'VG20260016', title: "Accès refusé sur application métier", desc: "L'utilisateur reçoit une erreur 403 lors de la connexion à l'application RH.", status: 'OPEN', priority: 'HIGH', cat: catAcces, client: clients[5], agent: null },
    { num: 'VG20260017', title: "Poste de travail très lent", desc: "Le PC est extrêmement lent depuis l'installation du dernier patch sécurité.", status: 'RESOLVED', priority: 'MEDIUM', cat: catLogiciel, client: clients[6], agent: agent1 },
    { num: 'VG20260018', title: "Wifi instable en open space", desc: "Déconnexions fréquentes du WiFi dans l'espace de travail collaboratif.", status: 'OPEN', priority: 'HIGH', cat: catReseau, client: clients[7], agent: agent3 },
    { num: 'VG20260019', title: "Scanner ne fonctionne plus", desc: "Le scanner du service juridique ne communique plus avec le PC.", status: 'CLOSED', priority: 'LOW', cat: catMateriel, client: clients[8], agent: agent2 },
    { num: 'VG20260020', title: "Erreur license Microsoft Office", desc: "Office affiche 'Produit non activé' depuis le renouvellement du contrat.", status: 'RESOLVED', priority: 'HIGH', cat: catLogiciel, client: clients[9], agent: agent1 },
    { num: 'VG20260021', title: "Double facteur authentification bloqué", desc: "Le SMS de vérification 2FA n'arrive pas sur le téléphone de l'utilisateur.", status: 'IN_PROGRESS', priority: 'HIGH', cat: catAcces, client: clients[0], agent: agent2 },
    { num: 'VG20260022', title: "Déploiement poste Windows 11", desc: "Déploiement et configuration d'un nouveau poste Windows 11 pour arrivant.", status: 'PENDING', priority: 'LOW', cat: catMateriel, client: clients[1], agent: agent3 },
    { num: 'VG20260023', title: "Firewall bloque application externe", desc: "Le pare-feu bloque l'accès à l'outil de collaboration partenaire.", status: 'OPEN', priority: 'MEDIUM', cat: catReseau, client: clients[2], agent: null },
    { num: 'VG20260024', title: "Sauvegarde automatique en échec", desc: "Les sauvegardes nocturnes échouent depuis 5 jours sans alerte.", status: 'OPEN', priority: 'CRITICAL', cat: catLogiciel, client: clients[3], agent: agent1 },
    { num: 'VG20260025', title: "Formation utilisation Teams", desc: "Demande de formation pour l'équipe commerciale sur Teams et SharePoint.", status: 'CLOSED', priority: 'LOW', cat: catAutre, client: clients[4], agent: agent2 },
  ];

  const createdTickets: any[] = [];

  for (const def of ticketDefs) {
    const resolvedAt =
      def.status === 'RESOLVED' || def.status === 'CLOSED'
        ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        : null;
    const closedAt =
      def.status === 'CLOSED'
        ? new Date((resolvedAt?.getTime() ?? Date.now()) + 2 * 60 * 60 * 1000)
        : null;

    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: def.num } });
    if (existing) {
      createdTickets.push(existing);
      continue;
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: def.num,
        title: def.title,
        description: def.desc,
        status: def.status as any,
        priority: def.priority as any,
        categoryId: def.cat.id,
        clientId: def.client.id,
        assignedToId: def.agent?.id ?? null,
        createdById: admin.id,
        resolvedAt,
        closedAt,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdTickets.push(ticket);

    // ActivityLog entries (3 per ticket)
    await prisma.activityLog.createMany({
      data: [
        { ticketId: ticket.id, userId: admin.id, action: 'Ticket créé', createdAt: ticket.createdAt },
        {
          ticketId: ticket.id,
          userId: def.agent?.id ?? admin.id,
          action: def.agent ? `Assigné à : ${def.agent.firstName} ${def.agent.lastName}` : 'En attente d\'assignation',
          createdAt: new Date(ticket.createdAt.getTime() + 5 * 60 * 1000),
        },
        {
          ticketId: ticket.id,
          userId: def.agent?.id ?? admin.id,
          action: `Statut changé : OPEN → ${def.status}`,
          oldValue: 'OPEN',
          newValue: def.status,
          createdAt: new Date(ticket.createdAt.getTime() + 30 * 60 * 1000),
        },
      ],
    });

    // Comments (2 per ticket)
    const commentAuthor = def.agent ?? admin;
    await prisma.comment.createMany({
      data: [
        {
          ticketId: ticket.id,
          authorId: commentAuthor.id,
          content: `Prise en charge du ticket. Je commence l'analyse du problème.`,
          isInternal: false,
          createdAt: new Date(ticket.createdAt.getTime() + 10 * 60 * 1000),
        },
        {
          ticketId: ticket.id,
          authorId: commentAuthor.id,
          content: `Note interne : problème identifié, mise en place d'un correctif en cours.`,
          isInternal: true,
          createdAt: new Date(ticket.createdAt.getTime() + 60 * 60 * 1000),
        },
      ],
    });
  }

  console.log('✅ Tickets created (25)');

  // ─── Survey Template ──────────────────────────────────────────────────────

  const existingTemplate = await prisma.surveyTemplate.findFirst({ where: { isActive: true } });
  if (!existingTemplate) {
    await prisma.surveyTemplate.create({
      data: {
        name: 'Modèle standard',
        isActive: true,
        questions: [
          {
            id: 'q1_csat',
            type: 'csat',
            label: 'Comment évaluez-vous votre satisfaction globale concernant le traitement de votre demande ?',
            required: true,
            order: 1,
            config: { min: 1, max: 5, minLabel: '1 = Très insatisfait', maxLabel: '5 = Très satisfait' },
          },
          {
            id: 'q1b_csat_comment',
            type: 'textarea',
            label: "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?",
            helpText: 'Votre retour nous aide à progresser',
            required: false,
            order: 2,
            config: { showIf: { questionId: 'q1_csat', operator: 'lte', value: 3 } },
          },
          {
            id: 'q2_nps',
            type: 'nps',
            label: 'Sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez à un proche ou un collègue ?',
            required: true,
            order: 3,
            config: { min: 0, max: 10, minLabel: 'Pas du tout probable', maxLabel: 'Très probable' },
          },
          {
            id: 'q3_speed',
            type: 'rating',
            label: 'Comment évaluez-vous la rapidité de traitement de votre demande ?',
            required: true,
            order: 4,
            config: { min: 1, max: 5, minLabel: 'Très lent', maxLabel: 'Très rapide' },
          },
          {
            id: 'q4_quality',
            type: 'rating',
            label: 'Comment évaluez-vous la qualité de la solution apportée ?',
            required: true,
            order: 5,
            config: { min: 1, max: 5, minLabel: 'Insuffisante', maxLabel: 'Excellente' },
          },
          {
            id: 'q5_professionalism',
            type: 'select',
            label: 'Le technicien qui a traité votre demande était-il ?',
            required: false,
            order: 6,
            options: ['Très professionnel', 'Professionnel', 'Correct', 'Peu professionnel'],
          },
          {
            id: 'q6_comment',
            type: 'textarea',
            label: 'Avez-vous des commentaires ou suggestions pour améliorer notre service ?',
            helpText: 'Votre retour nous aide à progresser',
            required: false,
            order: 7,
          },
        ],
      },
    });
    console.log('✅ Survey template created');
  } else {
    console.log('⏭️  Survey template already exists, skipping');
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  const settingsData = [
    { key: 'company_name', value: 'Mon Helpdesk' },
    { key: 'survey_delay_hours', value: '48' },
    { key: 'survey_cooldown_days', value: '10' },
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
