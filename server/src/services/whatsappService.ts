/**
 * Connexion WhatsApp du helpdesk (création des groupes de suivi des matchs).
 *
 * ⚠️ Utilise whatsapp-web.js, une bibliothèque NON officielle qui pilote WhatsApp Web
 * dans un Chromium headless. Hors des conditions d'utilisation de WhatsApp : le numéro
 * connecté peut être bloqué. Choix assumé par le responsable support (volume faible :
 * ~15 groupes / semaine, membres = collègues). Garde-fous : un seul job à la fois,
 * pause aléatoire entre deux groupes, pas de doublon si le groupe existe déjà.
 *
 * Session : conservée sur disque (LocalAuth) → un seul scan de QR code, puis la
 * connexion est rétablie automatiquement au redémarrage du serveur.
 */
import path from 'path';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';
import { Client, LocalAuth, MessageMedia, type GroupChat } from 'whatsapp-web.js';

const isDev = process.env.NODE_ENV !== 'production';
const log = (...a: unknown[]) => console.log('[WhatsApp]', ...a);
const logError = (...a: unknown[]) => console.error('[WhatsApp]', ...a);

// ─── État de la connexion ────────────────────────────────────────────────────

export type WhatsAppState = 'DISCONNECTED' | 'STARTING' | 'QR' | 'READY' | 'ERROR';

interface Status {
  state: WhatsAppState;
  /** QR code à scanner (data URL PNG), uniquement en état QR */
  qr: string | null;
  /** Numéro connecté (E.164) une fois prêt */
  phone: string | null;
  name: string | null;
  error: string | null;
}

let client: Client | null = null;
let status: Status = { state: 'DISCONNECTED', qr: null, phone: null, name: null, error: null };

const SESSION_DIR = process.env.WHATSAPP_SESSION_DIR || path.resolve(process.cwd(), '.wwebjs_auth');

export function getStatus(): Status {
  return status;
}

function setStatus(patch: Partial<Status>) {
  status = { ...status, ...patch };
}

/** Démarre (ou redémarre) le client. Idempotent tant qu'un client tourne. */
export async function connect(): Promise<Status> {
  if (client && status.state !== 'ERROR' && status.state !== 'DISCONNECTED') return status;
  if (client) await destroyClient();

  setStatus({ state: 'STARTING', qr: null, error: null });

  const c = new Client({
    authStrategy: new LocalAuth({ clientId: 'helpdesk', dataPath: SESSION_DIR }),
    puppeteer: {
      headless: true,
      executablePath: process.env.WHATSAPP_CHROME_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });
  client = c;

  c.on('qr', async (qr: string) => {
    try {
      setStatus({ state: 'QR', qr: await QRCode.toDataURL(qr, { margin: 1, width: 280 }) });
    } catch (err) {
      logError('QR', err);
    }
  });
  c.on('ready', () => {
    const wid = c.info?.wid?.user;
    setStatus({ state: 'READY', qr: null, error: null, phone: wid ? `+${wid}` : null, name: c.info?.pushname ?? null });
    log('connecté', wid);
  });
  c.on('auth_failure', (msg: string) => {
    setStatus({ state: 'ERROR', qr: null, error: `Échec d'authentification : ${msg}` });
  });
  c.on('disconnected', (reason: string) => {
    log('déconnecté', reason);
    setStatus({ state: 'DISCONNECTED', qr: null, phone: null, name: null, error: null });
    void destroyClient();
  });

  c.initialize().catch((err: unknown) => {
    logError('initialize', err);
    setStatus({ state: 'ERROR', qr: null, error: err instanceof Error ? err.message : 'Démarrage impossible' });
  });

  return status;
}

async function destroyClient() {
  const c = client;
  client = null;
  if (!c) return;
  try {
    await c.destroy();
  } catch {
    /* déjà arrêté */
  }
}

/** Déconnecte le compte (le prochain démarrage redemandera un QR code). */
export async function logout(): Promise<void> {
  if (client && status.state === 'READY') {
    try {
      await client.logout();
    } catch (err) {
      logError('logout', err);
    }
  }
  await destroyClient();
  setStatus({ state: 'DISCONNECTED', qr: null, phone: null, name: null, error: null });
}

/**
 * Au démarrage du serveur : si une session existe déjà sur disque, on se reconnecte
 * sans attendre qu'un agent ouvre la page.
 */
export async function resumeIfSessionExists(): Promise<void> {
  const fs = await import('fs');
  if (fs.existsSync(path.join(SESSION_DIR, 'session-helpdesk'))) {
    log('session trouvée, reconnexion…');
    void connect();
  }
}

// ─── Création des groupes ────────────────────────────────────────────────────

export interface GroupRequest {
  /** Identifiant côté client (ligne de la page), renvoyé tel quel */
  key: string;
  name: string;
  /** Numéros E.164 (+33…) des membres à ajouter (hors compte connecté) */
  participants: string[];
}

export type GroupResultStatus = 'PENDING' | 'RUNNING' | 'CREATED' | 'EXISTS' | 'FAILED';

export interface ParticipantResult {
  phone: string;
  ok: boolean;
  /** Ajout direct impossible, une invitation privée a été envoyée */
  invited: boolean;
  message: string;
}

export interface GroupResult {
  key: string;
  name: string;
  status: GroupResultStatus;
  groupId: string | null;
  pictureSet: boolean;
  participants: ParticipantResult[];
  error: string | null;
}

export interface Job {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  results: GroupResult[];
}

let currentJob: Job | null = null;

export function getJob(id: string): Job | null {
  return currentJob && currentJob.id === id ? currentJob : null;
}

export function isJobRunning(): boolean {
  return !!currentJob && !currentJob.finishedAt;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pause « humaine » entre deux groupes */
const humanPause = () => sleep(4000 + Math.random() * 4000);

/**
 * Lance la création en arrière-plan et renvoie immédiatement le job (suivi par polling).
 * @param picture data URL de l'image (PNG/JPEG) à mettre en photo de groupe, optionnelle
 */
export function startCreateGroupsJob(groups: GroupRequest[], picture: string | null): Job {
  if (!client || status.state !== 'READY') throw new Error('WhatsApp n\'est pas connecté');
  if (isJobRunning()) throw new Error('Une création est déjà en cours');

  const job: Job = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    results: groups.map((g) => ({
      key: g.key, name: g.name, status: 'PENDING', groupId: null, pictureSet: false, participants: [], error: null,
    })),
  };
  currentJob = job;
  void runJob(job, groups, picture);
  return job;
}

function pictureMedia(dataUrl: string | null): MessageMedia | null {
  if (!dataUrl) return null;
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  return m ? new MessageMedia(m[1], m[2], 'logo') : null;
}

async function runJob(job: Job, groups: GroupRequest[], picture: string | null) {
  const c = client!;
  const media = pictureMedia(picture);

  // Groupes déjà existants (même nom exact) → pas de doublon si on relance
  const existing = new Map<string, string>();
  try {
    for (const chat of await c.getChats()) {
      if (chat.isGroup) existing.set(chat.name.trim(), chat.id._serialized);
    }
  } catch (err) {
    logError('getChats', err);
  }

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const r = job.results[i];
    if (!client || status.state !== 'READY') {
      r.status = 'FAILED';
      r.error = 'Connexion WhatsApp perdue';
      continue;
    }
    r.status = 'RUNNING';

    const existingId = existing.get(g.name.trim());
    if (existingId) {
      r.status = 'EXISTS';
      r.groupId = existingId;
      continue;
    }

    try {
      // Vérifie que chaque numéro a bien un compte WhatsApp
      const ids: string[] = [];
      for (const phone of g.participants) {
        const id = await c.getNumberId(phone.replace(/^\+/, ''));
        if (id) ids.push(id._serialized);
        else r.participants.push({ phone, ok: false, invited: false, message: 'Pas de compte WhatsApp sur ce numéro' });
      }

      const created = await c.createGroup(g.name, ids, {
        // « Pas d'autorisations particulières » : tout le monde peut modifier les infos
        isRestrict: false,
        memberAddMode: false,
        autoSendInviteV4: true,
      });
      if (typeof created === 'string') throw new Error(created);

      r.groupId = created.gid._serialized;
      for (const [pid, p] of Object.entries(created.participants ?? {})) {
        const phone = g.participants.find((n) => pid.startsWith(n.replace(/^\+/, ''))) ?? `+${pid.split('@')[0]}`;
        r.participants.push({
          phone,
          ok: p.statusCode === 200,
          invited: p.isInviteV4Sent,
          message: p.statusCode === 200 ? 'Ajouté' : p.isInviteV4Sent ? 'Invitation envoyée (ajout direct refusé par la personne)' : p.message,
        });
      }

      if (media) {
        try {
          await sleep(1500);
          const chat = (await c.getChatById(r.groupId)) as GroupChat;
          r.pictureSet = await chat.setPicture(media);
        } catch (err) {
          logError('setPicture', err);
        }
      }
      r.status = 'CREATED';
      existing.set(g.name.trim(), r.groupId);
    } catch (err) {
      r.status = 'FAILED';
      r.error = err instanceof Error ? err.message : 'Erreur inconnue';
      if (isDev) logError('createGroup', g.name, err);
    }

    if (i < groups.length - 1) await humanPause();
  }

  job.finishedAt = new Date().toISOString();
}
