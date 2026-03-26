// All permission keys grouped by domain
export const PERMISSIONS = {
  TICKETS: {
    VIEW: 'tickets.view',
    CREATE: 'tickets.create',
    EDIT: 'tickets.edit',
    CLOSE: 'tickets.close',
    DELETE: 'tickets.delete',
    ASSIGN: 'tickets.assign',
    VIEW_ALL: 'tickets.viewAll',
  },
  CLIENTS: {
    VIEW: 'clients.view',
    CREATE: 'clients.create',
    EDIT: 'clients.edit',
    DELETE: 'clients.delete',
  },
  COMMENTS: {
    CREATE: 'comments.create',
    DELETE: 'comments.delete',
    DELETE_ANY: 'comments.deleteAny',
  },
  SURVEYS: {
    VIEW: 'surveys.view',
    CONFIGURE: 'surveys.configure',
  },
  ADMIN: {
    ACCESS: 'admin.access',
    USERS: 'admin.users',
    ROLES: 'admin.roles',
    CATEGORIES: 'admin.categories',
    CLIENT_ROLES: 'admin.clientRoles',
    SETTINGS: 'admin.settings',
  },
} as const;

// Flat list for iteration / validation
export const PERMISSIONS_LIST: string[] = [
  ...Object.values(PERMISSIONS.TICKETS),
  ...Object.values(PERMISSIONS.CLIENTS),
  ...Object.values(PERMISSIONS.COMMENTS),
  ...Object.values(PERMISSIONS.SURVEYS),
  ...Object.values(PERMISSIONS.ADMIN),
];

// All admin sub-permissions that require admin.access automatically
export const ADMIN_SUB_PERMISSIONS = [
  PERMISSIONS.ADMIN.USERS,
  PERMISSIONS.ADMIN.ROLES,
  PERMISSIONS.ADMIN.CATEGORIES,
  PERMISSIONS.ADMIN.CLIENT_ROLES,
  PERMISSIONS.ADMIN.SETTINGS,
];

// Grouped structure for the UI role editor
export interface PermissionMeta {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  icon: string;
  permissions: PermissionMeta[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'tickets',
    label: 'Tickets',
    icon: 'Ticket',
    permissions: [
      { key: 'tickets.view', label: 'Voir les tickets', description: 'Accès à la liste et au détail des tickets' },
      { key: 'tickets.create', label: 'Créer un ticket', description: 'Créer de nouveaux tickets' },
      { key: 'tickets.edit', label: 'Modifier un ticket', description: 'Éditer le titre, la description, la priorité...' },
      { key: 'tickets.close', label: 'Fermer un ticket', description: 'Passer un ticket en CLOSED' },
      { key: 'tickets.delete', label: 'Supprimer un ticket', description: 'Supprimer définitivement un ticket' },
      { key: 'tickets.assign', label: 'Assigner un ticket', description: "Assigner un ticket à un agent" },
      { key: 'tickets.viewAll', label: 'Voir tous les tickets', description: "Sans ce droit, l'agent ne voit que ses tickets assignés" },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: 'Users',
    permissions: [
      { key: 'clients.view', label: 'Voir les clients', description: 'Accès à la liste et aux fiches clients' },
      { key: 'clients.create', label: 'Créer un client', description: 'Ajouter de nouveaux clients' },
      { key: 'clients.edit', label: 'Modifier un client', description: 'Éditer les informations client' },
      { key: 'clients.delete', label: 'Supprimer un client', description: 'Supprimer un client (bloqué si tickets ouverts)' },
    ],
  },
  {
    key: 'comments',
    label: 'Commentaires',
    icon: 'MessageSquare',
    permissions: [
      { key: 'comments.create', label: 'Ajouter un commentaire', description: 'Poster des commentaires sur les tickets' },
      { key: 'comments.delete', label: 'Supprimer ses commentaires', description: 'Supprimer ses propres commentaires uniquement' },
      { key: 'comments.deleteAny', label: 'Supprimer tout commentaire', description: 'Supprimer les commentaires de tous les agents' },
    ],
  },
  {
    key: 'surveys',
    label: 'Enquêtes',
    icon: 'BarChart2',
    permissions: [
      { key: 'surveys.view', label: 'Voir les résultats', description: 'Accéder aux résultats et statistiques des enquêtes' },
      { key: 'surveys.configure', label: 'Configurer le modèle', description: "Modifier les questions du modèle d'enquête" },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: 'Shield',
    permissions: [
      { key: 'admin.access', label: 'Accéder au panneau admin', description: 'Voir le menu Administration dans la sidebar' },
      { key: 'admin.users', label: 'Gérer les agents', description: 'Créer, modifier, activer/désactiver des agents' },
      { key: 'admin.roles', label: 'Gérer les rôles', description: 'Créer et modifier les rôles et leurs permissions' },
      { key: 'admin.categories', label: 'Gérer les catégories', description: 'Gérer les catégories de tickets' },
      { key: 'admin.clientRoles', label: 'Gérer les rôles clients', description: 'Gérer les rôles attribuables aux clients' },
      { key: 'admin.settings', label: 'Modifier les paramètres', description: 'Paramètres généraux, logo, branding' },
    ],
  },
];

// Default permissions for built-in roles
export const ADMIN_PERMISSIONS: string[] = PERMISSIONS_LIST;

export const AGENT_PERMISSIONS: string[] = [
  PERMISSIONS.TICKETS.VIEW,
  PERMISSIONS.TICKETS.CREATE,
  PERMISSIONS.TICKETS.EDIT,
  PERMISSIONS.TICKETS.CLOSE,
  PERMISSIONS.TICKETS.ASSIGN,
  PERMISSIONS.TICKETS.VIEW_ALL,
  PERMISSIONS.CLIENTS.VIEW,
  PERMISSIONS.CLIENTS.CREATE,
  PERMISSIONS.CLIENTS.EDIT,
  PERMISSIONS.COMMENTS.CREATE,
  PERMISSIONS.COMMENTS.DELETE,
];
