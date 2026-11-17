// All permission keys grouped by domain
export const PERMISSIONS = {
  ADMIN: {
    ACCESS: 'admin.access',
    USERS: 'admin.users',
    ROLES: 'admin.roles',
    CATEGORIES: 'admin.categories',
    SETTINGS: 'admin.settings',
  },
  KB: {
    READ: 'kb.read',
    WRITE: 'kb.write',
  },
  SPORTS: {
    EDIT: 'sports.edit',
  },
  EVENTS: {
    CREATE: 'events.create',
  },
  BMC: {
    VIEW: 'bmc.view',
    MANAGE: 'bmc.manage',
    DELETE: 'bmc.delete',
  },
  WHATSAPP: {
    GROUPS: 'whatsapp.groups',
  },
} as const;

// Flat list for iteration / validation
export const PERMISSIONS_LIST: string[] = [
  ...Object.values(PERMISSIONS.ADMIN),
  ...Object.values(PERMISSIONS.KB),
  ...Object.values(PERMISSIONS.SPORTS),
  ...Object.values(PERMISSIONS.EVENTS),
  ...Object.values(PERMISSIONS.BMC),
  ...Object.values(PERMISSIONS.WHATSAPP),
];

// All admin sub-permissions that require admin.access automatically
export const ADMIN_SUB_PERMISSIONS = [
  PERMISSIONS.ADMIN.USERS,
  PERMISSIONS.ADMIN.ROLES,
  PERMISSIONS.ADMIN.CATEGORIES,
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
    key: 'admin',
    label: 'Administration',
    icon: 'Shield',
    permissions: [
      { key: 'admin.access', label: 'Accéder au panneau admin', description: 'Voir le menu Administration dans la sidebar' },
      { key: 'admin.users', label: 'Gérer les agents', description: 'Créer, modifier, activer/désactiver des agents' },
      { key: 'admin.roles', label: 'Gérer les rôles', description: 'Créer et modifier les rôles et leurs permissions' },
      { key: 'admin.categories', label: 'Gérer les catégories', description: 'Gérer les catégories de la base de connaissance' },
      { key: 'admin.settings', label: 'Modifier les paramètres', description: 'Paramètres généraux, logo, branding' },
    ],
  },
  {
    key: 'kb',
    label: 'Base de connaissance',
    icon: 'BookOpen',
    permissions: [
      { key: 'kb.read', label: 'Consulter la KB', description: 'Accéder aux articles de la base de connaissance' },
      { key: 'kb.write', label: 'Gérer la KB', description: 'Créer, modifier et supprimer des articles de la base de connaissance' },
    ],
  },
  {
    key: 'sports',
    label: 'Calendrier sportif',
    icon: 'Trophy',
    permissions: [
      { key: 'sports.edit', label: 'Notes et PDF des matchs', description: "Rédiger les notes de match, joindre des PDF et forcer l'actualisation du calendrier" },
    ],
  },
  {
    key: 'events',
    label: 'Missions Support',
    icon: 'CalendarPlus',
    permissions: [
      { key: 'events.create', label: 'Gérer ses missions', description: 'Enregistrer et consulter ses propres missions Support' },
    ],
  },
  {
    key: 'bmc',
    label: 'Cartes BMC',
    icon: 'Server',
    permissions: [
      { key: 'bmc.view', label: 'Voir les cartes BMC', description: "Accéder à la page des cartes BMC des serveurs LNR" },
      { key: 'bmc.manage', label: 'Ajouter/modifier une carte BMC', description: "Créer et éditer les cartes BMC" },
      { key: 'bmc.delete', label: 'Supprimer une carte BMC', description: "Supprimer définitivement une carte BMC" },
    ],
  },
  {
    key: 'whatsapp',
    label: 'Groupes WhatsApp',
    icon: 'MessageCircle',
    permissions: [
      { key: 'whatsapp.groups', label: 'Préparer les groupes WhatsApp', description: "Importer la planification et préparer les groupes WhatsApp des matchs" },
    ],
  },
];

// Default permissions for built-in roles
export const ADMIN_PERMISSIONS: string[] = PERMISSIONS_LIST;

export const AGENT_PERMISSIONS: string[] = [
  PERMISSIONS.SPORTS.EDIT,
  PERMISSIONS.BMC.VIEW,
  PERMISSIONS.BMC.MANAGE,
];
