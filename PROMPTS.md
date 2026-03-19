# PROMPTS CLAUDE CODE — Helpdesk Ticketing
# À donner dans l'ordre exact, un par un.
# Attendre la confirmation de Claude Code avant de passer au suivant.
# En début de chaque nouvelle session : utiliser le PROMPT DE REPRISE ci-dessous.

---

## PROMPT DE REPRISE (début de session)

```
Read SPEC.md and the current project structure entirely.
Tell me clearly what has been completed and what remains to do.
Then continue from where we left off without repeating completed steps.
```

---

## PROMPT 1 — Squelette projet + schéma Prisma

```
Read the SPEC.md file entirely before doing anything.
This is the complete specification for a helpdesk ticketing web application.
Do not start coding until you have confirmed you have read and understood it.

Once read, create the project skeleton:

1. Monorepo structure with /client and /server folders at the root

2. /server/prisma/schema.prisma with ALL models from spec section 4:
   Role, User, ClientRole, Client, Category, Ticket, Comment,
   Attachment, ActivityLog, Settings, SurveyTemplate, SurveySend,
   SurveyResponse and all enums (Status, Priority, SurveySendStatus)
   Use exact field names, types and relations defined in spec section 4.

3. /client/package.json with these exact dependencies:
   react@18, react-dom@18, @vitejs/plugin-react, vite,
   tailwindcss, postcss, autoprefixer,
   @shadcn/ui (or manually add shadcn components),
   react-router-dom@6, zustand, @tanstack/react-query, axios,
   recharts, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities,
   lucide-react, react-hot-toast

4. /server/package.json with these exact dependencies:
   express, @prisma/client, prisma,
   bcrypt, @types/bcrypt,
   jsonwebtoken, @types/jsonwebtoken,
   zod, multer, @types/multer,
   nodemailer, @types/nodemailer,
   node-cron, cors, helmet,
   express-rate-limit, morgan,
   cross-env, concurrently,
   typescript, ts-node, @types/express, @types/node

5. /server/.env.example:
   DATABASE_URL=postgresql://helpdesk_user:password@localhost:5432/helpdesk_db
   JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
   PORT=3001
   UPLOADS_PATH=./uploads
   APP_URL=http://localhost:5173
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your@email.com
   SMTP_PASS=yourpassword
   SMTP_FROM="Mon Helpdesk <noreply@helpdesk.com>"

6. Root package.json with scripts:
   "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""
   "install:all": "npm install --prefix server && npm install --prefix client"

7. ecosystem.config.js (PM2) at root

8. .gitignore covering node_modules, .env, uploads/, dist/, build/

9. README.md with Windows local setup instructions step by step

Do not write any feature code yet. Skeleton and schema only.
Tell me when done and wait for my confirmation before proceeding.
```

---

## PROMPT 2 — Utilitaires + permissions + middleware

```
Read SPEC.md sections 5, 6 and 13.

Implement the core utilities and permissions layer:

1. /server/src/config/permissions.ts
   Export a PERMISSIONS object with all permission keys from spec section 6,
   grouped by domain (TICKETS, CLIENTS, COMMENTS, SURVEYS, ADMIN).
   Export a PERMISSIONS_LIST array for iteration.
   Export a PERMISSION_GROUPS array for the UI editor:
   [{ key: 'tickets', label: 'Tickets', icon: 'Ticket', permissions: [...] }]

2. /server/src/middleware/auth.ts
   authMiddleware(req, res, next):
     Extract Bearer token from Authorization header
     Verify with jsonwebtoken
     Fetch user from DB with role and role.permissions
     Check: if (token.iat * 1000) < role.roleUpdatedAt.getTime() → 401
     Attach to req.user: { id, firstName, lastName, email, role, permissions[] }
     Return 401 if token missing/invalid

3. /server/src/middleware/permissions.ts
   requirePermission(...perms: string[]): RequestHandler
     Returns middleware that checks ALL perms are in req.user.permissions
     Returns 403 { error: "Permission refusée", required: perms } if fails
   hasPermission(user: any, perm: string): boolean
     Returns true if perm is in user.permissions array

4. /server/src/utils/jwt.ts
   signToken(payload: object): string
     Signs with JWT_SECRET, expiration: '8h'
   verifyToken(token: string): any | null
     Returns decoded payload or null on error

5. /server/src/utils/password.ts
   hashPassword(plain: string): Promise<string>
     bcrypt with rounds: 12
   comparePassword(plain: string, hash: string): Promise<boolean>

6. /server/src/utils/ticketNumber.ts
   generateTicketNumber(): Promise<string>
     Get current year (4 digits)
     Query DB: SELECT MAX(ticketNumber) WHERE ticketNumber LIKE 'VG[year]%'
     Extract numeric suffix, increment by 1, pad to 4 digits with leading zeros
     If none found this year: start at 0001
     Return "VG" + year + paddedNumber (e.g. "VG20250001")
     Wrap entire logic in Prisma.$transaction with retry loop (max 3 attempts)
     On unique constraint violation: retry with incremented number
     Examples: VG20250001, VG20250099, VG20251000, VG20260001 (new year)

7. /server/src/utils/email.ts
   getBrandedEmailTemplate(options: {
     title: string,
     preheader?: string,
     content: string,  (HTML string)
     ctaUrl?: string,
     ctaLabel?: string
   }): string
     Returns complete HTML email string
     Fetches company logo_url and company_name from Settings table
     Structure:
       <html> full email-safe HTML
       Header: centered logo img (max-width: 180px) + company name h1
       Divider
       Content section (injected HTML)
       CTA button if ctaUrl (rounded, #185FA5 background, white text)
       Footer: company name + "Ne pas répondre à cet email"
       Clean professional design, email-safe CSS (inline styles only)

   sendEmail(options: {
     to: string | string[],
     subject: string,
     html: string
   }): Promise<void>
     Uses nodemailer createTransport from SMTP env vars
     Throws on failure (let callers handle)

8. /server/src/app.ts
   Express app setup:
     helmet(), cors({ origin: process.env.APP_URL }), json(),
     morgan('dev'), static /uploads
     Mount all routers (fill in as routes are created)
     404 handler, global error handler middleware

9. /server/src/index.ts
   Start server on PORT, connect Prisma, register cron jobs

Tell me when done and wait for my confirmation.
```

---

## PROMPT 3 — API complète (toutes les routes)

```
Read SPEC.md sections 7, 8, 10, 12 and 13.

Implement the complete REST API. For every route:
- Apply requirePermission() as defined in spec section 7
- Add Zod validation on all request bodies and query params
- Return consistent JSON: { data } for success, { error } for failures
- Write ActivityLog entries where specified

Create these files in /server/src/routes/ and /server/src/controllers/:

1. AUTH (/server/src/routes/auth.ts)
   POST /api/auth/login
     Validate { email, password }, find user with role+permissions
     Compare password with bcrypt, return 401 if wrong or user inactive
     Return { token, user: { id, firstName, lastName, email, mustChangePassword,
     role: { name, permissions[] } } }
   GET /api/auth/me → return req.user with role and permissions
   PATCH /api/auth/change-password (auth required)
     Check: if user is admin (has admin.access) → return 403
     Validate { currentPassword, newPassword, confirmPassword }
     Verify currentPassword against stored hash
     Validate newPassword: min 8 chars, 1 uppercase, 1 digit
     If newPassword !== confirmPassword → 400
     Hash and save, return 200 { message: "Mot de passe mis à jour" }
   POST /api/auth/reset-password (public)
     Validate { token, newPassword, confirmPassword }
     Find ALL users with non-null passwordResetToken
     Use bcrypt.compare(token, user.passwordResetToken) to find match
     Check passwordResetExpiry > now() → 400 "Lien expiré" if not
     Validate newPassword, hash and save
     Clear passwordResetToken and passwordResetExpiry
     Set mustChangePassword = false
     Return 200
   GET /api/auth/validate-reset-token/:token (public)
     Same bcrypt search as above
     Return { valid: true, userEmail } or { valid: false, reason }

2. TICKETS (/server/src/routes/tickets.ts)
   GET /api/tickets (tickets.view)
     Query params: status[], priority[], categoryId, assignedToId,
     dateFrom, dateTo, search, page (default 1), limit (default 25)
     If !hasPermission(req.user, 'tickets.viewAll'):
       force filter: assignedToId = req.user.id
     Search: title ILIKE, description ILIKE, ticketNumber ILIKE, client name ILIKE
     Include: client, assignedTo, category, createdBy
     Return: { data: tickets[], total, page, totalPages }
   POST /api/tickets (tickets.create)
     Validate body, call generateTicketNumber()
     Create ticket + ActivityLog "Ticket créé"
     Upload attachments if provided (handle file array separately)
   GET /api/tickets/:id (tickets.view)
     Include: client.role, assignedTo, category, createdBy,
     comments.author, attachments.uploadedBy,
     activityLogs.user (ordered by createdAt ASC)
   PUT /api/tickets/:id (tickets.edit)
     Update fields, write ActivityLog for each changed field
   PATCH /api/tickets/:id/status (tickets.edit or tickets.close)
     Validate new status, update
     If RESOLVED: set resolvedAt = now()
     If CLOSED: set closedAt = now()
     Write ActivityLog "Statut changé : OLD → NEW"
   PATCH /api/tickets/:id/assign (tickets.assign)
     Update assignedToId
     Write ActivityLog "Assigné à : [agent name]" or "Désassigné"
   DELETE /api/tickets/:id (tickets.delete) — soft delete with deletedAt field

3. COMMENTS (/server/src/routes/comments.ts)
   POST /api/tickets/:id/comments (comments.create)
     Validate { content, isInternal }, create comment
     Write ActivityLog "Commentaire ajouté"
   DELETE /api/comments/:id
     Check ownership (own comment) or hasPermission deleteAny
     Delete, write ActivityLog

4. ATTACHMENTS (/server/src/routes/attachments.ts)
   POST /api/tickets/:id/attachments (tickets.edit)
     Multer middleware: max 5 files, 10MB each
     Allowed mimetypes: image/*, application/pdf,
       application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,
       application/zip, text/plain
     Store to uploads/attachments/[uuid]-[originalname]
     Create Attachment records
   GET /api/attachments/:id/download (tickets.view)
     Stream file with Content-Disposition: attachment; filename="[originalName]"
   DELETE /api/attachments/:id (tickets.edit)
     Delete from disk (use path.join, never hardcoded slashes)
     Delete DB record

5. CLIENTS (/server/src/routes/clients.ts)
   GET /api/clients (clients.view)
     Params: search, roleId, hasOpenTickets (bool), page, limit
     Include: role, _count of tickets
   POST /api/clients (clients.create)
     Validate: phone OR email required
     Accept isSurveyable field
   GET /api/clients/:id (clients.view)
     Include: role, tickets with status/priority/assignedTo,
     _count { tickets, openTickets, resolvedTickets }
     Compute avgResolutionHours from resolved tickets
   PUT /api/clients/:id (clients.edit) — accept all fields including isSurveyable
   DELETE /api/clients/:id (clients.delete)
     Block if client has tickets with status IN (OPEN, IN_PROGRESS, PENDING)
     Return 400 with count if blocked

6. CLIENT ROLES (/server/src/routes/clientRoles.ts)
   GET /api/client-roles (auth) — only isActive=true, ordered by position
   GET /api/admin/client-roles (admin.clientRoles) — all, ordered by position
   POST /api/admin/client-roles — validate { name, color, description?, isActive? }
     Auto-set position to max+1
   PUT /api/admin/client-roles/:id — update fields
   DELETE /api/admin/client-roles/:id
     Block if any Client uses this roleId (return count)
   PATCH /api/admin/client-roles/reorder
     Body: [{ id, position }] — bulk update positions

7. CATEGORIES (/server/src/routes/categories.ts)
   Same structure as client roles but with additional icon and slug fields
   Auto-generate slug from name on create/update
   DELETE blocked if any Ticket uses this categoryId

8. ROLES (/server/src/routes/roles.ts)
   GET /api/admin/roles (admin.roles)
     Include _count of users per role
   POST /api/admin/roles
     Cannot set isSystem: true via API
     Validate permissions array against known PERMISSIONS_LIST
   PUT /api/admin/roles/:id
     isSystem roles: can update permissions but NOT name or isSystem
     On permissions change: update roleUpdatedAt = new Date()
   DELETE /api/admin/roles/:id
     Block if isSystem=true (return 400)
     Block if any User uses this roleId (return count)
   POST /api/admin/roles/:id/duplicate
     Clone role with name "Copie de [name]", isSystem=false

9. USERS (/server/src/routes/users.ts)
   GET /api/admin/users (admin.users)
     Include role, _count assigned tickets
     Filter by roleId
   POST /api/admin/users
     Hash password, set mustChangePassword=true
   PUT /api/admin/users/:id
     No password field (use reset email instead)
   POST /api/admin/users/:id/send-reset-email (admin.users)
     Generate UUID token (crypto.randomUUID())
     Hash token with bcrypt (rounds: 12)
     Store hash in passwordResetToken, set passwordResetExpiry = now()+24h
     Build email using getBrandedEmailTemplate():
       title: "Réinitialisation de votre mot de passe"
       content: "<p>Bonjour [firstName],</p>
         <p>Une demande de réinitialisation de mot de passe a été effectuée
         pour votre compte <strong>[company_name]</strong> HelpDesk.</p>
         <p>Ce lien est valable <strong>24 heures</strong>.</p>
         <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>"
       ctaUrl: "[APP_URL]/reset-password/[raw_token]"
       ctaLabel: "Réinitialiser mon mot de passe"
     Send email, return 200 { message: "Email envoyé" }

10. SETTINGS (/server/src/routes/settings.ts)
    GET /api/settings/public (public, no auth)
      Return { logo_url, company_name } from Settings table
      Return defaults if not set: { logo_url: null, company_name: "HelpDesk" }
    POST /api/admin/settings/logo (admin.settings)
      Multer single file, 2MB max, images only
      Store to uploads/logo/logo.[ext]
      Delete old logo file if exists
      Upsert Settings key "logo_url"
    PUT /api/admin/settings (admin.settings)
      Body: { [key]: value } object
      Upsert each key/value pair in Settings table
      Allowed keys: company_name, default_priority, default_assigned_to,
        auto_close_days, survey_delay_hours, survey_cooldown_days

11. DASHBOARD (/server/src/routes/dashboard.ts)
    GET /api/dashboard/stats (auth)
      Return:
        openTickets: count status=OPEN
        inProgressTickets: count status=IN_PROGRESS
        resolvedToday: count resolvedAt = today (start to end of day)
        csatGlobal: {
          score: float (0-100),
          satisfied: int,   // vocScore >= 4
          neutral: int,     // vocScore = 3
          unsatisfied: int, // vocScore <= 2
          total: int,
          vsLastMonth: float // difference in percentage points vs last month
        }
        ticketsByPriority: { CRITICAL: n, HIGH: n, MEDIUM: n, LOW: n }
        ticketsByCategory: [{ name, color, count }]
        ticketsByAgent: [{ agentName, count }] ordered by count desc, max 10
        recentActivity: last 10 ActivityLog with user firstName+lastName and ticket ticketNumber
    GET /api/dashboard/trends (auth)
      Return: [{ date: "YYYY-MM-DD", count: n }] for last 30 days
      Include days with 0 tickets

12. SURVEYS (/server/src/routes/surveys.ts)
    GET /api/survey/:token (public, rate limit 10/min per IP)
      Find SurveySend by token
      If not found: 404 { error: "invalid" }
      If response already exists: 410 { error: "already_answered" }
      If createdAt < now() - 30 days: 410 { error: "expired" }
      Fetch active SurveyTemplate
      Fetch company branding from Settings
      Return { ticket: { ticketNumber, title }, questions, companyName, logoUrl }
    POST /api/survey/:token/respond (public, rate limit 10/min per IP)
      Validate: SurveySend exists, not answered, not expired
      Validate body: { answers: [{ questionId, value }] }
      Extract npsScore: find answer where question type=nps, value=int
      Extract vocScore: find answer where question type=csat, value=float
      Create SurveyResponse
      Return 200 { message: "Merci pour votre réponse" }
    GET /api/admin/surveys/csat-live (surveys.view)
      All-time CSAT calculation, no date filter
      Return { score, satisfied, neutral, unsatisfied, total, vsLastMonth }
    GET /api/admin/surveys/results (surveys.view)
      Params: dateFrom, dateTo
      Return { csatGlobal, csatFiltered, npsScore,
        npsBreakdown: { promoters, passives, detractors },
        npsPerWeek: [{ week, score }],
        responses: [{ ...response, ticket, client }] paginated }
    GET /api/admin/surveys/sends (surveys.view)
      Paginated list of SurveySend with ticket and hasResponse
    GET /api/admin/surveys/template (surveys.view)
      Return active SurveyTemplate
    PUT /api/admin/surveys/template (surveys.configure)
      Validate questions array structure
      Set all existing templates isActive=false
      Create new SurveyTemplate with isActive=true

Tell me when done and wait for my confirmation.
```

---

## PROMPT 4 — Cron job enquêtes de satisfaction

```
Read SPEC.md section 8.6 (survey trigger logic and template definition).

Implement the survey automation system:

1. /server/prisma/seed.ts — complete seed file with ALL data from spec section 15:
   - 2 system roles with exact permission arrays
   - 4 users (1 admin + 3 agents)
   - 5 categories with exact colors, icon names, positions
   - 5 client roles with exact colors, positions
   - 10 clients (mix of roles, 8 isSurveyable=true, 2 false)
   - 25 tickets (varied statuses, priorities, categories, agents)
     Each ticket: at least 2 comments + 3 ActivityLog entries
   - Default SurveyTemplate with EXACTLY these 7 questions in order:
     Q1: id="q1_csat", type="csat", label="Comment évaluez-vous votre satisfaction globale...",
       required=true, order=1
     Q1b: id="q1b_csat_comment", type="textarea",
       label="Qu'est-ce qui vous a déplu ou pourrait être amélioré ?",
       helpText="Votre retour nous aide à progresser",
       required=false, order=2,
       config={ showIf: { questionId: "q1_csat", operator: "lte", value: 3 } }
     Q2: id="q2_nps", type="nps",
       label="Sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez...",
       required=true, order=3,
       config={ min: 0, max: 10, minLabel: "Pas du tout probable", maxLabel: "Très probable" }
     Q3: id="q3_speed", type="rating",
       label="Comment évaluez-vous la rapidité de traitement de votre demande ?",
       required=true, order=4,
       config={ min: 1, max: 5, minLabel: "Très lent", maxLabel: "Très rapide" }
     Q4: id="q4_quality", type="rating",
       label="Comment évaluez-vous la qualité de la solution apportée ?",
       required=true, order=5,
       config={ min: 1, max: 5, minLabel: "Insuffisante", maxLabel: "Excellente" }
     Q5: id="q5_professionalism", type="select",
       label="Le technicien qui a traité votre demande était-il ?",
       required=false, order=6,
       options=["Très professionnel", "Professionnel", "Correct", "Peu professionnel"]
     Q6: id="q6_comment", type="textarea",
       label="Avez-vous des commentaires ou suggestions pour améliorer notre service ?",
       helpText="Votre retour nous aide à progresser",
       required=false, order=7
   - Settings: company_name, survey_delay_hours="48", survey_cooldown_days="10"

2. /server/src/jobs/surveyJob.ts
   export function startSurveyJob(): void
   
   node-cron schedule: '0 * * * *' (every hour at minute 0)
   
   checkAndSendSurveys():
     Read settings: survey_delay_hours (default 48), survey_cooldown_days (default 10)
     
     Query tickets:
       status = CLOSED
       AND resolvedAt <= new Date(Date.now() - delayHours * 3600000)
       AND client.email IS NOT NULL
       AND client.isSurveyable = true
       AND NOT EXISTS (SurveySend where ticketId = ticket.id)
       AND NOT EXISTS (SurveySend where clientEmail = client.email
                       AND status = SENT
                       AND createdAt >= new Date(Date.now() - cooldownDays * 86400000))
     
     For each ticket:
       const rawToken = crypto.randomUUID()
       Create SurveySend { status: PENDING, token: rawToken, clientEmail: client.email }
       
       const html = await getBrandedEmailTemplate({
         title: "Votre avis nous intéresse",
         preheader: `Ticket ${ticket.ticketNumber} — ${ticket.title}`,
         content: `<p>Bonjour ${client.firstName},</p>
           <p>Votre demande <strong>${ticket.ticketNumber} — ${ticket.title}</strong>
           a été résolue.</p>
           <p>Nous aimerions connaître votre avis sur la qualité de notre support.
           Cela ne prendra que 2 minutes.</p>`,
         ctaUrl: `${process.env.APP_URL}/survey/${rawToken}`,
         ctaLabel: "Donner mon avis"
       })
       
       await sendEmail({
         to: client.email,
         subject: `Votre avis nous intéresse — ticket ${ticket.ticketNumber}`,
         html
       })
       
       On success: update SurveySend { status: SENT, sentAt: new Date() }
       On failure: update SurveySend { status: FAILED }
                   console.error with ticket number and error
     
     Log each run:
       console.log(`[SurveyJob] Checked: ${total}, Sent: ${sent}, Skipped: ${skipped}`)

3. Register in /server/src/index.ts:
   import { startSurveyJob } from './jobs/surveyJob'
   startSurveyJob() // call after server starts

Tell me when done and wait for my confirmation.
```

---

## PROMPT 5 — Frontend : base, auth et navigation

```
Read SPEC.md sections 8.5, 10, 11, 13 and 14.

Set up the complete React frontend foundation:

1. Vite + TailwindCSS + shadcn/ui configuration
   tailwind.config.js with content paths
   Initialize shadcn/ui components needed:
   button, input, label, select, dialog, sheet (slide-over),
   badge, card, separator, toast, tooltip, switch, tabs, progress

2. /client/src/lib/axios.ts
   Axios instance with baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
   Request interceptor: add Authorization: Bearer [token] from localStorage
   Response interceptor: on 401 → call authStore.logout() + navigate('/login')

3. /client/src/stores/authStore.ts (Zustand + persist)
   State: { user, token, permissions: string[], isAuthenticated, mustChangePassword }
   Actions: login(token, user), logout(), setMustChangePassword(bool)
   Persist token in localStorage key 'helpdesk_token'

4. /client/src/stores/brandingStore.ts (Zustand)
   State: { logoUrl: string | null, companyName: string, loaded: boolean }
   Actions: setBranding(logoUrl, companyName), setLoaded(bool)

5. /client/src/hooks/useBranding.ts
   On first call: fetch GET /api/settings/public
   Set brandingStore state
   Return { logoUrl, companyName }

6. /client/src/hooks/usePermissions.ts
   Read permissions from authStore
   Return:
     can(perm: string): boolean
     canAny(...perms: string[]): boolean
     canAll(...perms: string[]): boolean

7. /client/src/components/auth/ProtectedRoute.tsx
   If !isAuthenticated → <Navigate to="/login" />
   If mustChangePassword → <Navigate to="/change-password" />
   If requiredPermission && !can(requiredPermission) → <Navigate to="/403" />
   Otherwise → render children

8. /client/src/App.tsx — React Router v6 with ALL routes:
   Wrap with: QueryClientProvider, BrandingProvider, ClientPanelProvider, Toaster
   
   PUBLIC: /login, /reset-password/:token, /survey/:token, /403, /404
   
   PROTECTED (inside MainLayout):
     /dashboard
     /tickets
     /tickets/new         (requires tickets.create)
     /tickets/:id
     /clients             (requires clients.view)
     /clients/:id         (requires clients.view)
     /profile
     /change-password
   
   ADMIN (inside MainLayout, requires admin.access):
     /admin/settings      (requires admin.settings)
     /admin/categories    (requires admin.categories)
     /admin/client-roles  (requires admin.clientRoles)
     /admin/roles         (requires admin.roles)
     /admin/users         (requires admin.users)
     /admin/surveys       (requires surveys.view)

9. /client/src/layouts/MainLayout.tsx
   Sidebar:
     Logo (useBranding, max 140x40px, fallback company name styled)
     Nav items with Lucide icons:
       Dashboard (LayoutDashboard icon)
       Tickets (Ticket icon) + badge with open tickets count from /api/dashboard/stats
       Clients (Users icon) — if clients.view
     Administration section header (if admin.access):
       Paramètres (Settings icon) — if admin.settings
       Catégories tickets (Tag icon) — if admin.categories
       Rôles clients (UserCheck icon) — if admin.clientRoles
       Rôles & permissions (Shield icon) — if admin.roles
       Équipe (Users2 icon) — if admin.users
       Enquêtes (BarChart2 icon) — if surveys.view
     Sidebar collapses to icon-only on screen < 1024px with tooltips
   
   Topbar:
     Global search input (debounced 300ms):
       Searches /api/tickets?search= AND /api/clients?search= in parallel
       Grouped dropdown: "Tickets" section (ticketNumber, title, status badge)
                         "Clients" section (name, company, phone)
       Max 5 results per section
       Keyboard: Escape closes, Arrow keys navigate, Enter selects
       Click outside closes
     Avatar circle (user initials):
       Dropdown: "Mon profil" → /profile / "Déconnexion" → logout
     "Nouveau ticket" button (if tickets.create) → /tickets/new

10. /client/src/pages/LoginPage.tsx (standalone, no sidebar)
    useBranding() to get logo and company name
    Center layout: logo (max 200x80px) → company name → form
    Form: email input, password input, "Se connecter" button
    On submit: POST /api/auth/login
    On success: authStore.login(), redirect /dashboard or /change-password

11. /client/src/pages/ChangePasswordPage.tsx (protected)
    Title "Choisissez votre nouveau mot de passe"
    New password + confirm inputs
    Password strength indicator:
      weak (< 8 chars or no rules): red bar 33%
      medium (8+ chars, 1 rule): orange bar 66%
      strong (8+ chars, uppercase + digit): green bar 100%
    POST /api/auth/change-password (no current password, mustChangePassword flow)
    On success: authStore.setMustChangePassword(false), redirect /dashboard

12. /client/src/pages/ResetPasswordPage.tsx (public, standalone)
    On mount: GET /api/auth/validate-reset-token/:token
    If invalid: show error card with message + "Contacter votre administrateur"
    If valid: show form with email greeting
    useBranding() for logo in header
    New password + confirm + strength indicator
    POST /api/auth/reset-password on submit
    Success: toast "Mot de passe mis à jour" + redirect /login after 3s

13. /client/src/pages/ProfilePage.tsx (protected)
    User info card: initials avatar (large, 64px), name, email, role badge
    Editable: firstName + lastName (PUT /api/admin/users/:id or new endpoint)
    Security section:
      If NOT admin (no admin.access): show change password form
        Current password, new password (with strength), confirm
        PATCH /api/auth/change-password
        On success: toast + logout + redirect /login
      If admin: info box "La modification du mot de passe administrateur
        doit être effectuée par un autre administrateur depuis la gestion
        des utilisateurs."

14. /client/src/pages/NotFoundPage.tsx (/404)
15. /client/src/pages/ForbiddenPage.tsx (/403)

Tell me when done and wait for my confirmation.
```

---

## PROMPT 6 — Frontend : Dashboard

```
Read SPEC.md section 8.1 (dashboard features and layout).

Build the complete DashboardPage at /dashboard.

Data sources (TanStack Query):
  statsQuery: GET /api/dashboard/stats, refetchInterval: 60000
  trendsQuery: GET /api/dashboard/trends, refetchInterval: 60000

/client/src/pages/DashboardPage.tsx:

ROW 1 — KPI Grid (4 columns, responsive 2 cols on mobile):

  KpiCard component (reusable, props: label, value, color, icon, children?):

  Card 1: "Tickets ouverts"
    Color: blue (#185FA5)
    Icon: TicketIcon (Lucide)
    Value: stats.openTickets

  Card 2: "En cours"
    Color: orange (#EF9F27)
    Icon: Clock (Lucide)
    Value: stats.inProgressTickets

  Card 3: "Résolus aujourd'hui"
    Color: green (#639922)
    Icon: CheckCircle (Lucide)
    Value: stats.resolvedToday

  Card 4: "CSAT global"
    Dynamic color: <50% = #E24B4A / 50-75% = #EF9F27 / >75% = #639922
    Icon: Star (Lucide)
    Value: "{stats.csatGlobal.score.toFixed(1)}%"
    Below value: progress bar (width = score%, same dynamic color)
    Below bar: "{stats.csatGlobal.total} réponses"
    If vsLastMonth !== 0: badge "+X%" green or "-X%" red
    Hover tooltip (shadcn Tooltip): breakdown
      "Satisfaits: {satisfied}% ({n} réponses)"
      "Neutres: {neutral}% ({n} réponses)"
      "Non satisfaits: {unsatisfied}% ({n} réponses)"

ROW 2 — Charts (flex row, responsive stacks on mobile):

  Left 60%: Line chart "Tickets créés — 30 derniers jours"
    Recharts: LineChart, ResponsiveContainer, Line, XAxis, YAxis,
    CartesianGrid, Tooltip
    Data: trends array { date, count }
    X-axis: show only every 7th date label
    Smooth curve (type="monotone"), color #185FA5, dot on hover only
    Card wrapper with title

  Right 40%: Donut chart "Par priorité"
    Recharts: PieChart, Pie, Cell, Legend, Tooltip
    Data: ticketsByPriority (CRITICAL/HIGH/MEDIUM/LOW)
    Colors: CRITICAL=#E24B4A HIGH=#EF9F27 MEDIUM=#378ADD LOW=#639922
    innerRadius=60, outerRadius=90
    Center label: total count
    Card wrapper with title

ROW 3 (flex row):

  Left 50%: Bar chart "Tickets par agent"
    Recharts: BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
    Horizontal bars (layout="vertical")
    Y-axis: agent firstName only (truncated 10 chars)
    Color: #185FA5
    Card wrapper with title

  Right 50%: "Activité récente"
    List of stats.recentActivity (10 items):
    Each item: initials avatar (32px, gray bg) + flex column:
      Agent name bold (14px) + action text (13px, muted)
      Relative timestamp right-aligned (12px, muted)
      "il y a Xh", "il y a Xmin", "hier"
    Card wrapper with title + "Voir tout" link → /tickets

ROW 4: "Tickets urgents" table
  Filter: priority IN [CRITICAL, HIGH] AND status IN [OPEN, IN_PROGRESS]
  Use stats data or separate query
  Table component:
    Columns: # (ticketNumber, mono link) / Client (name+phone) /
    Titre (truncated 50 chars) / Priorité (badge) / Statut (badge) /
    Assigné (avatar+name) / Créé le (relative)
  Max 10 rows, "Voir tous les tickets urgents" link if more

Loading skeletons:
  4 KPI skeleton cards (pulse animation)
  2 chart skeleton rectangles
  Table skeleton rows

Tell me when done and wait for my confirmation.
```

---

## PROMPT 7 — Frontend : Tickets

```
Read SPEC.md section 8.2 (ticket features in detail).

Build the complete ticket management UI:

1. /client/src/pages/TicketsListPage.tsx

FilterBar component (sticky top):
  Status multi-select: OPEN/IN_PROGRESS/PENDING/RESOLVED/CLOSED
  Priority multi-select: CRITICAL/HIGH/MEDIUM/LOW
  Category select (from GET /api/categories)
  Assigned agent select (from GET /api/admin/users, if tickets.assign)
  Date range: two date inputs (from/to)
  "Réinitialiser les filtres" link

Search input (debounced 400ms, magnifier icon)

Tickets table (shadcn Table):
  Columns with sort indicators:
  - # : ticketNumber in monospace, blue, clickable link
  - Client : name bold + phone below in gray (12px)
  - Titre : text truncated 60 chars
  - Catégorie : badge with category color and name
  - Priorité : colored badge
    CRITICAL: bg=#FCEBEB text=#A32D2D
    HIGH: bg=#FAEEDA text=#854F0B
    MEDIUM: bg=#E6F1FB text=#185FA5
    LOW: bg=#EAF3DE text=#3B6D11
  - Statut : colored badge
    OPEN: bg=#E6F1FB text=#185FA5
    IN_PROGRESS: bg=#FAEEDA text=#854F0B
    PENDING: bg=#FBEAF0 text=#993556
    RESOLVED: bg=#EAF3DE text=#3B6D11
    CLOSED: bg=#F1EFE8 text=#5F5E5A
  - Assigné : initials avatar (24px) + name (truncated)
  - Créé le : relative time, full date on hover tooltip

Click row → navigate /tickets/:id
"Nouveau ticket" button in page header (if tickets.create)

Pagination: shadcn Pagination, 25/page
Empty state: illustration + "Aucun ticket trouvé" + CTA if can create

Loading: table skeleton (10 rows, each column width matching header)

2. /client/src/pages/NewTicketPage.tsx

CLIENT SECTION — "Client" card:
  Live search input with magnifier icon
  Async search: GET /api/clients?search=[input]&limit=5 on input
  Dropdown results (max 5):
    Each: initials avatar + name bold + company + phone + role badge
  No results state: "Aucun client trouvé pour '[search]'" + button "Créer ce client"
  
  Selected client state: card showing:
    Initials avatar (40px) + name + company + phone + role badge
    Actions row: "Changer" button (clears selection) + "Modifier" link (openClientPanel(id))
  
  Inline creation form (AnimatePresence slide-down when "Créer ce client"):
    Row 1: firstName input + lastName input (50/50)
    Row 2: phone input + email input (50/50)
    Row 3: company input + ClientRole select (50/50)
    isSurveyable toggle with label
    Action row: "Créer et sélectionner" primary button + "Annuler" text link
    On create: POST /api/clients → auto-select new client → collapse form

TICKET SECTION — "Détails du ticket" card:
  Title input (required, autofocus)
  Description textarea (4 rows, markdown hint)
  Row: Category select + Priority select (50/50)
  Assigned to select (agents list)

ATTACHMENTS SECTION — "Pièces jointes" card:
  Drag & drop zone (dashed border, hover state):
    Icon + "Déposez vos fichiers ici ou cliquez pour sélectionner"
    Accepted: images, PDF, DOC, DOCX, ZIP, TXT / Max 5 files / 10MB each
  File list (if files added):
    Each: file icon (image thumbnail or type icon) + name + size + remove button
  Error if file exceeds 10MB or wrong type

Validation:
  Client required: show "Veuillez sélectionner ou créer un client" inline error
  Title required: standard validation
  
Form submit:
  POST /api/tickets (multipart/form-data with files)
  Loading state on button "Création en cours..."
  On success: toast "Ticket VGxxxxxxxx créé !" + navigate /tickets/:id
  On error: toast error message

3. /client/src/pages/TicketDetailPage.tsx

2-column layout (CSS Grid: 65% / 35%, stacks on mobile):

LEFT COLUMN:

Title (inline edit):
  Display: h2, click to show input, save on Enter or blur, Escape to cancel
  
Description (inline edit):
  Display: rendered markdown (use react-markdown or similar)
  Click to show textarea with toolbar: Bold (Ctrl+B), Italic (Ctrl+I), Code (Ctrl+`)
  Save on blur outside, Escape to cancel

Timeline:
  Mixed list of ActivityLog and Comment, sorted by createdAt ASC
  TanStack Query refetchInterval: 30000

  ActivityLog item:
    Left dot (4px, gray) + italic gray text (13px):
    "[User name] a [action] · [relative time]"
    Examples:
      "Marie Dupont a changé le statut : OPEN → IN_PROGRESS · il y a 2h"
      "Jean Martin a assigné à Sophie Lebrun · il y a 1j"

  Comment item:
    Initials avatar (32px) + name (500 weight) + relative time (muted)
    Rendered markdown content (react-markdown, prose style)
    If isInternal: yellow left border + "Note interne" badge (yellow bg)
    Delete button (trash icon, hover only) if own comment or deleteAny permission
    Confirm dialog before delete

Comment input (bottom of left column):
  Toolbar row: Bold / Italic / Code buttons
  Textarea (3 rows, resize-y)
  Footer row:
    Toggle "Note interne" (Switch component, yellow accent when on)
    "Ajouter un commentaire" button (right-aligned)
  Keyboard: Ctrl+Enter submits
  POST /api/tickets/:id/comments

RIGHT COLUMN (sticky top on scroll):

Status section:
  Label "Statut"
  Dropdown select with colored options
  Optimistic update: update local cache immediately, revert on error
  On change: PATCH /api/tickets/:id/status + create ActivityLog (done by server)

Priority dropdown (same pattern, colored options)
Category dropdown
Assigned agent dropdown (with initials avatars in options)

Separator

Client card:
  Initials avatar (40px, colored by name hash) + name (bold) + company
  Phone: tel: link with Phone icon
  Email: mailto: link with Mail icon
  Role badge
  "Voir la fiche client" link with ExternalLink icon → /clients/:id

Separator

Ticket info grid:
  Numéro: [ticketNumber] (monospace)
  Créé par: [firstName lastName]
  Créé le: [full date] (relative in parentheses)
  Mis à jour: [relative]
  Résolu le: [date] (only if resolvedAt)

Separator

Attachments:
  Title "Pièces jointes" + count badge
  List: file icon (Paperclip or image thumb 32px) + name + size + date
    Download button (Download icon)
    Delete button (Trash icon) with confirm dialog
  Empty: "Aucune pièce jointe"
  Upload button: opens file picker, POST /api/tickets/:id/attachments

Separator

Action buttons:
  "Résoudre" (CheckCircle icon, green) if OPEN or IN_PROGRESS and tickets.close
  "Fermer" (XCircle icon, gray) if RESOLVED and tickets.close
  "Rouvrir" (RefreshCw icon, blue) if RESOLVED or CLOSED and tickets.edit
  Each with ConfirmDialog before action

Tell me when done and wait for my confirmation.
```

---

## PROMPT 8 — Frontend : Clients

```
Read SPEC.md section 8.3 (client management features).

Build the complete client management UI:

1. /client/src/contexts/ClientPanelContext.tsx
   Context with:
     isOpen: boolean
     clientId: string | null (null = create mode)
     openClientPanel(clientId?: string): void
     closeClientPanel(): void
   Provider wraps entire app (add in App.tsx)

2. /client/src/components/clients/ClientSlideOver.tsx
   Uses shadcn Sheet (slide from right, 480px wide)
   
   Fields layout:
     Row: firstName* input + lastName* input
     company input (full width)
     Row: phone input + email input
     Validation note: "Au moins un contact requis (téléphone ou email)"
     ClientRole select (GET /api/client-roles, show colored badge preview)
     isSurveyable Switch:
       Label: "Enquêtes de satisfaction"
       Description: "Si désactivé, aucune enquête NPS/CSAT ne sera envoyée"
       Tooltip: info icon with full explanation
     notes Textarea (3 rows)
   
   Create mode (clientId=null):
     Title "Nouveau client"
     POST /api/clients on submit
     Toast "Client créé" + invalidate clients queries
   
   Edit mode (clientId set):
     Fetch GET /api/clients/:id on open
     Title "Modifier le client"
     PUT /api/clients/:id on submit
     Toast "Client mis à jour" + invalidate
   
   Footer: "Enregistrer" button + "Annuler" button
   Unsaved changes: if form isDirty and user tries to close → confirm dialog

3. /client/src/pages/ClientsListPage.tsx

Search bar (full width, debounced 300ms)
Filters row:
  Role multi-select (GET /api/client-roles)
  "Tickets ouverts uniquement" toggle
"Nouveau client" button → openClientPanel()

Table columns:
  Nom : initials avatar (24px) + firstName+lastName bold, link to /clients/:id
  Société : company or "—"
  Téléphone : tel: link or "—"
  Email : mailto: link or "—"
  Rôle : colored badge or "—"
  Enquêtes : if isSurveyable=false → BellOff icon (gray) with tooltip "Enquêtes désactivées"
             if true → nothing (default)
  Tickets ouverts : count badge (blue if >0, gray if 0)
  Total tickets : plain number
  Dernière activité : relative date of most recent ticket or "Jamais"
  Actions : 3 buttons:
    "Voir" → /clients/:id
    "Modifier" → openClientPanel(id)
    "Nouveau ticket" → /tickets/new?clientId=[id] (pre-select client)

Pagination 25/page
Empty state: UserPlus icon + "Aucun client" + "Créer le premier client" button

4. /client/src/pages/ClientDetailPage.tsx

Header:
  Large initials avatar (64px, colored by name hash)
  firstName + lastName (h1)
  Role badge (colored)
  "Modifier" button → openClientPanel(id)

Info grid (2 columns):
  Société / Téléphone (tel:) / Email (mailto:) /
  Enquêtes : "Activées" (green CheckCircle) or "Désactivées" (gray BellOff) /
  Notes / Membre depuis : createdAt date

Stats row (4 KPI mini-cards):
  Total tickets / Tickets ouverts / Tickets résolus / Temps moyen résolution

Ticket history section:
  Title "Historique des tickets" + count
  Same table as TicketsListPage but filtered for this client
  Include: # / Titre / Catégorie / Priorité / Statut / Assigné / Créé le
  "Créer un ticket pour ce client" button → /tickets/new?clientId=[id]

Delete section (admin only, if can('clients.delete')):
  Danger zone card at bottom
  "Supprimer ce client" button (red outline)
  Disabled with tooltip if client has open tickets: "Ce client a X tickets ouverts"
  ConfirmDialog: "Cette action est irréversible. Voulez-vous vraiment supprimer [name] ?"

Tell me when done and wait for my confirmation.
```

---

## PROMPT 9 — Frontend : Administration

```
Read SPEC.md section 9 (admin panel, all pages).

Build the complete administration section:

1. /client/src/pages/admin/AdminSettingsPage.tsx

3 cards sections:

Apparence card:
  Current logo preview: <img src={logoUrl} /> max 200px, or placeholder "Aucun logo"
  Upload zone (FileUpload component):
    Drag & drop or click to browse
    Accept: image/png, image/jpeg, image/svg+xml, image/webp
    Max 2MB — show error if exceeded
    On drop/select: preview immediately + store File
  "Supprimer le logo" button (only if logo exists) with confirm
  Company name input
  "Enregistrer" → POST logo (if new file) + PUT settings { company_name }
  Success toast + refresh brandingStore

Tickets card:
  Default priority select (LOW/MEDIUM/HIGH/CRITICAL)
  Default assigned agent select (agents list + "Non assigné" option)
  Auto-close after N days input (number, min 0, 0 = désactivé)
  Helper text for auto-close: "Les tickets résolus seront automatiquement
  fermés après ce nombre de jours (0 = désactivé)"
  "Enregistrer" → PUT /api/admin/settings

Enquêtes card:
  Délai avant envoi: number input + "heures" label (default 48)
  Cooldown: number input + "jours" label (default 10)
  Helper texts explaining each setting
  "Enregistrer" → PUT /api/admin/settings

2. /client/src/pages/admin/CategoriesPage.tsx

DraggableList component using @dnd-kit/core + useSortable:
  Each row (draggable):
    GripVertical handle icon
    Color dot (12px circle, category.color)
    Lucide icon (dynamic: import icon by name from lucide-react)
    Name (bold) + description (muted, truncated)
    isActive Switch (PATCH inline on toggle)
    Edit button → opens modal pre-filled
    Delete button → ConfirmDialog (disabled with tooltip if tickets exist)
  On drag end: PATCH /api/admin/categories/reorder with new positions

"Nouvelle catégorie" button → opens modal

CategoryModal component (shadcn Dialog):
  name input (required)
  description input
  isActive switch
  Color picker:
    12 preset color swatches (colored circles, 28px, selected has ring)
    Hex input below: "#XXXXXX" with live preview dot
    Presets: #185FA5 #534AB7 #0F6E56 #854F0B #5F5E5A
             #E24B4A #EF9F27 #639922 #D4537E #0C447C #3B6D11 #A32D2D
  Icon picker:
    Search input filtering 30 icons by name
    Grid of icon buttons (5 cols):
      Each: Lucide icon + name below (11px)
      Selected: blue background ring
      Icons: Monitor Code Wifi Lock Printer Mail Phone Database Server
             HardDrive Cpu Globe Shield AlertTriangle Settings Wrench
             Package Users FileText Cloud Smartphone Headphones Camera
             Mic Battery Zap Link Key Bug LifeBuoy
  Live badge preview:
    Label: "Aperçu"
    Shows: [color dot] [Lucide icon] [name] as it will appear in tickets
  Footer: "Enregistrer" + "Annuler"

3. /client/src/pages/admin/ClientRolesPage.tsx
   Same structure as CategoriesPage but:
   - No icon picker
   - Row shows: handle / color dot / name / description / active toggle / edit / delete
   - Delete blocked if clients use this role

4. /client/src/pages/admin/RolesPage.tsx

Roles grid (3 columns responsive):
  RoleCard component:
    Header: name (bold) + isSystem badge if applicable
    "{n} agents utilisent ce rôle"
    Permission pills row: "Tickets (3/7)" "Clients (2/4)" "Admin (0/6)"
    Footer: Edit / Duplicate / Delete buttons
    Delete disabled (tooltip) if isSystem or has users

RoleSlideOverEditor (shadcn Sheet, 560px wide):
  Header: "Modifier le rôle" or "Nouveau rôle"
  name input (required, disabled if isSystem)
  description input
  
  Permission groups (5 groups, expand/collapse each):
  For each group { key, label, icon, permissions[] }:
    Group header row:
      Lucide icon + label bold
      "Tout cocher" / "Tout décocher" button (right-aligned)
    Permission rows (indented 24px):
      Checkbox + label (bold 13px) + description (muted 12px below)
    
    Auto-dependency logic (on checkbox change):
      Check dependency rules from spec section 6
      If dependency missing: auto-check it + show toast
      Toast: "tickets.view activé automatiquement (requis par tickets.edit)"
  
  Sticky footer (border-top, white bg):
    Left: "{X} droits sur {total}"
    Pills: "Tickets(3/7)" · "Clients(2/4)" · "Commentaires(1/3)" · "Enquêtes(0/2)" · "Admin(0/6)"
    Right: "Enregistrer" + "Annuler" buttons
  
  Unsaved changes: warn on close if isDirty

5. /client/src/pages/admin/UsersPage.tsx

Users table:
  Columns: Avatar(initials) / Nom complet / Email / Rôle badge /
  Tickets assignés count / Actif badge / Edit button

Filter: role select dropdown

"Nouvel agent" button

UserSlideOver (shadcn Sheet, 520px wide):
  firstName + lastName (row)
  email
  Password (create only): input + strength indicator
  Role select:
    Shows role options
    Below selection: "Voir les droits de ce rôle" collapsible:
      Same grouped checkbox layout as RoleSlideOverEditor
      ALL INPUTS DISABLED (read-only preview)
  isActive switch
  
  EDIT MODE ONLY — "Envoyer un email de réinitialisation" section:
    ConfirmDialog: "Envoyer un email de réinitialisation à [email] ?"
    Button: "Envoyer un email de réinitialisation" (Mail icon)
    POST /api/admin/users/:id/send-reset-email
    Show below: "Dernier envoi : [relative time]" or "Jamais envoyé"
    Toast on success: "Email envoyé à [email]"

6. /client/src/pages/admin/SurveysPage.tsx

3 tabs (shadcn Tabs): Résultats / Envois / Modèle

Tab "Résultats":

  CSAT Global card (always visible, above date filter):
    Title: "CSAT global — toutes périodes"
    Source: GET /api/admin/surveys/csat-live, refetchInterval: 30000
    Layout:
      3 stacked bars (label + bar + percentage + count):
        Satisfaits (≥4): green (#639922)
        Neutres (=3): orange (#EF9F27)
        Non satisfaits (≤2): red (#E24B4A)
      Total: "{total} réponses au total"
      Evolution: "+X% vs mois précédent" badge

  Date filter row: "7 derniers jours" / "30 derniers jours" /
    "90 derniers jours" / "Personnalisé" (two date inputs)

  CSAT filtré card (same layout as global, uses csatFiltered from results)

  NPS card:
    Large NPS score value (colored: <0=red / 0-30=orange / 30-70=blue / >70=green)
    Label "Net Promoter Score"
    3 segments (admin only, shown here):
      Promoteurs (9-10): count + %
      Passifs (7-8): count + %
      Détracteurs (0-6): count + %
    NPS trend line chart (Recharts, weekly data)

  Response table:
    Date / Ticket# (link) / Client email / NPS (colored number badge) /
    CSAT (number) / Délai réponse (from send to response) /
    Commentaire (truncated 50 chars) / "Voir" button
    "Voir" opens detail slide-over:
      All questions + answers displayed in order
      NPS and CSAT highlighted

Tab "Envois":
  Table: Date envoi / Ticket# / Email client / Statut badge /
    Répondu (CheckCircle or XCircle) / "Renvoyer" button (FAILED only)
  "Renvoyer" → POST with new token generation

Tab "Modèle":
  Active template info: name + last modified date
  "Modifier le modèle" button → opens TemplateEditor

  TemplateEditor (full-width card or modal):
    Drag & drop question list (@dnd-kit):
      Each row: handle / type badge / label (truncated) /
        "Requis" badge if required / "Conditionnel" badge if showIf / edit / delete
    "Ajouter une question" button → QuestionForm:
      Type select (nps/csat/rating/text/textarea/select/multiselect)
      Label input
      Help text input
      Required toggle
      If type has options (select/multiselect): chips input for options
      If type has scale (nps/rating): min/max + minLabel/maxLabel inputs
      If conditional: showIf: questionId select + operator select + value input
    Right panel: live preview of question as rendered in survey page
    "Enregistrer le modèle" → PUT /api/admin/surveys/template
    Warning banner: "La modification n'affecte pas les enquêtes déjà envoyées"
    "Restaurer le modèle par défaut" → ConfirmDialog → restore 7 default questions

Tell me when done and wait for my confirmation.
```

---

## PROMPT 10 — Page enquête publique

```
Read SPEC.md section 8.6 (public survey page — rendering rules critical).

Build /client/src/pages/SurveyPage.tsx.
This page uses StandaloneLayout (no sidebar, no topbar, no authentication required).

Route: /survey/:token (already defined in App.tsx as public)

ON MOUNT:
  GET /api/survey/:token
  Handle 3 error states (show instead of form):
    response.error === "invalid": card "Ce lien n'est pas valide."
    response.error === "expired": card "Ce lien n'est plus valide (expiré)."
    response.error === "already_answered": card "Merci, votre réponse a déjà été enregistrée."

SURVEY PAGE LAYOUT:
  Max-width: 640px, centered, padding: 2rem
  
  Header:
    If logoUrl: <img src={logoUrl} style={{ maxWidth: 180px, maxHeight: 70px }} />
    Company name (muted, 14px)
    Ticket ref: "Votre avis — {ticketNumber} : {ticketTitle}" (16px, 500 weight)
  
  Progress bar (shadcn Progress):
    value = (requiredAnswered / totalRequired) * 100
    Show text: "{requiredAnswered}/{totalRequired} questions requises"
    Updates live as user answers
  
  Questions list (map over template questions, ordered by order field):

QUESTION RENDERING — CRITICAL RULES:

For ALL numeric scale types (nps, csat, rating) — IDENTICAL rendering:
  Component: NumericScaleQuestion
  Props: min, max, minLabel, maxLabel, value, onChange
  
  Container: flex row, gap: 6px, flex-wrap: wrap
  Each button (number from min to max):
    Size: min 44x44px, border-radius: 6px
    Font: 16px, weight 500
    Display: ONLY the number — NO emoji, NO star, NO icon
    Unselected state: background white, border: 1px solid #D1D5DB, color: #374151
    Selected state: background #185FA5, border: none, color: white
    SAME #185FA5 for ALL values regardless of which number is selected
    Hover: background #F3F4F6 (unselected) or #1e4f8a (selected)
    Focus: ring 2px #185FA5
  
  Legends row (below buttons, flex justify-between):
    Left: "{min} = {minLabel}" (12px, muted)
    Right: "{max} = {maxLabel}" (12px, muted)
  
  DO NOT show Détracteur/Passif/Promoteur labels on this page.
  DO NOT add any color coding based on selected value.
  DO NOT add any emoji.

For CONDITIONAL questions (showIf config):
  Component: ConditionalQuestion (wraps children)
  Logic: check if answer[showIf.questionId] [operator] showIf.value
    operator "lte": answer <= value → show
    operator "gte": answer >= value → show
    operator "eq": answer === value → show
  Animation: CSS transition max-height 0 → auto with overflow hidden
    300ms ease-in-out
    Slide down when condition met, slide up when not
  Even when hidden, the field is NOT required

For SELECT type:
  Radio cards: each option = full-width card with border
  Unselected: white bg, gray border
  Selected: light blue bg (#E6F1FB), blue border (#185FA5), blue text

For MULTISELECT type:
  Checkbox cards: same layout as select, multi-select allowed

For TEXT type:
  shadcn Input, full width

For TEXTAREA type:
  shadcn Textarea, 4 rows, resize-y
  If helpText: show below as muted 12px text

FORM SUBMISSION:
  "Envoyer mon avis" button (full width, disabled if required incomplete):
    Shows count "X/Y réponses requises manquantes" when disabled
    Loading spinner on click
  
  Collect answers: { questionId, value } for all answered questions
  Include conditional answer if field was shown AND has content
  POST /api/survey/:token/respond with { answers: [...] }

SUCCESS SCREEN (replace form):
  Large CheckCircle icon (64px, green)
  "Merci pour votre retour !" (h2)
  "Votre avis a bien été enregistré." (p, muted)
  Company logo
  No submit button, no back link, no re-submit possible

Tell me when done and wait for my confirmation.
```

---

## PROMPT 11 — Finitions et polish UX

```
Read SPEC.md sections 14 (UX rules) and 15 (seed data).

Finalize and polish the entire application:

1. ConfirmDialog component (/client/src/components/ui/ConfirmDialog.tsx):
   shadcn AlertDialog
   Props: { isOpen, title, description, confirmLabel, confirmVariant, onConfirm, onCancel }
   confirmVariant: "default" | "destructive"
   Used before: delete ticket, delete client, delete category, delete role,
   delete user, delete attachment, delete comment, close ticket, resolve ticket,
   restore default survey template, send reset password email
   Add useConfirmDialog hook for easy usage

2. useBeforeUnload hook (/client/src/hooks/useBeforeUnload.ts):
   Takes isDirty: boolean
   Shows browser "Modifications non enregistrées" warning on navigation
   Apply to: NewTicketPage, ClientSlideOver (when isDirty), 
   RoleSlideOverEditor, AdminSettingsPage

3. Global search (topbar) — complete implementation:
   Debounced 300ms after typing (min 2 chars)
   Parallel TanStack Query fetches:
     GET /api/tickets?search=[q]&limit=5&page=1
     GET /api/clients?search=[q]&limit=5
   Dropdown results (shadcn Popover):
     Section "Tickets" (if results):
       Each: ticketNumber (mono) + title (truncated) + status badge
     Section "Clients" (if results):
       Each: initials avatar + name + company + phone
     "Aucun résultat" if both empty
   Keyboard: Escape closes, Tab navigates results, Enter selects
   Click outside closes
   Click result → navigate, close dropdown

4. Relative time formatting:
   Create /client/src/utils/time.ts:
     formatRelative(date: Date): string
       < 1min: "à l'instant"
       < 1h: "il y a Xmin"
       < 24h: "il y a Xh"
       < 2 days: "hier"
       < 7 days: "il y a X jours"
       else: full date "DD/MM/YYYY"
     Apply everywhere: timeline, activity, ticket lists, client lists

5. Empty states (create EmptyState component):
   Props: { icon, title, description, ctaLabel?, ctaAction? }
   Apply to:
     /tickets list: "Aucun ticket" + create button if can create
     /clients list: "Aucun client" + create button if can create
     /admin/categories: "Aucune catégorie"
     /admin/roles: "Aucun rôle personnalisé"
     /admin/users: "Aucun agent"
     Survey results: "Aucune réponse reçue"
     Ticket timeline: "Aucune activité"

6. Loading skeletons (create Skeleton component based on shadcn):
   TicketListSkeleton: 10 rows matching table column widths
   ClientListSkeleton: 10 rows
   DashboardKpiSkeleton: 4 cards
   DashboardChartSkeleton: 2 chart placeholders
   TicketDetailSkeleton: 2-column layout

7. Password strength indicator (reusable component):
   Props: { password: string }
   Rules: length >= 8, has uppercase, has digit
   Strength levels:
     0 rules: empty bar (gray)
     1 rule or length<8: weak (red, 33%)
     2 rules: medium (orange, 66%)
     3 rules: strong (green, 100%)
   Show: colored bar + text label below

8. Sidebar responsive:
   On screen >= 1024px: full sidebar with text labels
   On screen < 1024px: icon-only sidebar (48px wide)
     All nav items show only icon
     shadcn Tooltip on hover showing label
   Toggle button on mobile to show/hide sidebar completely

9. Final Windows compatibility check:
   Verify ALL server file paths use path.join() — never '/' or '\' directly
   Verify ALL npm scripts use cross-env
   Verify root "dev" script works with concurrently
   Test: npm run dev starts both Vite (5173) and Express (3001)

10. Run end-to-end verification:
    Login with admin@helpdesk.com / admin123
    Dashboard loads with seed data charts
    Create new ticket with new client inline
    Upload attachment to ticket
    Add comment (internal + public)
    Change ticket status through lifecycle
    Access /admin/categories — create + reorder
    Access /admin/roles — edit permissions
    Open /survey/[any-valid-token] — verify numeric buttons render correctly
    Verify no emoji on survey page
    Fix any errors found

Tell me when done and wait for my confirmation.
```

---

## PROMPT 12 — Déploiement Linux + installateur Windows

```
Read SPEC.md section 12 (deployment — full details).

Generate all deployment files:

LINUX PRODUCTION FILES:

1. /ecosystem.config.js:
module.exports = {
  apps: [{
    name: 'helpdesk-server',
    script: 'src/index.js',
    cwd: '/opt/helpdesk/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
    env: { NODE_ENV: 'production' },
    error_file: '/opt/helpdesk/logs/error.log',
    out_file: '/opt/helpdesk/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}

2. /nginx.conf:
Complete nginx server block:
  listen 80; server_name _;
  client_max_body_size 15M;
  location /api/ { proxy_pass http://localhost:3001/api/; proxy headers; }
  location /uploads/ { alias /opt/helpdesk/uploads/; }
  location / { root /opt/helpdesk/client/dist; try_files $uri $uri/ /index.html; }

3. /deploy.sh (for updates):
#!/bin/bash
set -e
cd /opt/helpdesk
git pull origin main
cd server && npm ci --production
npx prisma migrate deploy
cd ../client && npm ci && npm run build
pm2 restart helpdesk-server
echo "✓ Déployé avec succès — $(date)"

4. /install.sh (complete, idempotent, Ubuntu 22.04):
#!/bin/bash
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

Print header banner
Check if already installed (detect existing .env), offer repair mode

Step 1: nvm + Node.js 20 LTS
  if ! command -v node || [[ $(node -v) != v20* ]]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source ~/.bashrc && nvm install 20 && nvm use 20
  fi

Step 2: PostgreSQL 15
  if ! command -v psql; then
    apt-get install -y postgresql-15 postgresql-client-15
    systemctl start postgresql && systemctl enable postgresql
  fi

Step 3: Nginx + PM2
  apt-get install -y nginx
  npm install -g pm2

Step 4: Create directories
  mkdir -p /opt/helpdesk/uploads/attachments
  mkdir -p /opt/helpdesk/uploads/logo
  mkdir -p /opt/helpdesk/logs
  chown -R $USER:$USER /opt/helpdesk

Step 5: Interactive configuration
  Read DB_PASS (generate random if empty: openssl rand -base64 16)
  Read JWT_SECRET (generate: openssl rand -base64 32)
  Read SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM
  Read APP_URL (default: http://localhost)
  Read COMPANY_NAME (default: Mon Helpdesk)
  Write /opt/helpdesk/server/.env with all values

Step 6: Create PostgreSQL user + database
  sudo -u postgres psql -c "CREATE USER helpdesk_user WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE helpdesk_db OWNER helpdesk_user;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL ON DATABASE helpdesk_db TO helpdesk_user;" 2>/dev/null || true

Step 7: Install dependencies
  cd /opt/helpdesk/server && npm ci
  cd /opt/helpdesk/client && npm ci

Step 8: Database setup
  cd /opt/helpdesk/server
  npx prisma migrate deploy
  if [[ "$1" != "--no-seed" ]]; then npx prisma db seed; fi

Step 9: Build frontend
  cd /opt/helpdesk/client && npm run build

Step 10: PM2 setup
  cd /opt/helpdesk && pm2 start ecosystem.config.js
  pm2 save
  echo "Run: pm2 startup — then run the displayed command as root"

Step 11: Nginx setup
  cp /opt/helpdesk/nginx.conf /etc/nginx/sites-available/helpdesk
  ln -sf /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/helpdesk
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

Step 12: Summary
  Print colored box:
    ✓ URL: http://[APP_URL]
    ✓ Admin: admin@helpdesk.com / admin123
    ⚠ Changez le mot de passe admin dès la première connexion !

WINDOWS INSTALLER FILES (/installer/ folder):

5. /installer/setup.bat:
@echo off
chcp 65001 >nul
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause

6. /installer/setup.ps1 — complete PowerShell script with 10 steps:

Step 1: Display ASCII banner
  Write-Host "  _   _      _       ____            _    "
  Write-Host " | | | | ___| |_ __ |  _ \  ___  ___| | __"
  etc.
  Write-Host "Installation de HelpDesk Ticketing"
  Write-Host "Durée estimée : 5-10 minutes"
  Read-Host "Appuyez sur Entrée pour commencer"

Step 2: Prerequisites check (function Test-Prerequisites):
  Check OS (Windows 10/11 via (Get-WmiObject Win32_OperatingSystem).Caption)
  Check admin rights ([Security.Principal.WindowsPrincipal]...)
  Check internet (Test-Connection 8.8.8.8 -Count 1 -Quiet)
  Check disk space (Get-PSDrive C, require >2GB free)
  Check RAM (Get-WmiObject Win32_ComputerSystem, require >2GB)
  Display ✓ or ✗ for each, exit if critical fails
  Write to log file: C:\HelpDesk\install.log

Step 3: Node.js 20 LTS
  $nodeVersion = (node --version 2>$null)
  if ($nodeVersion -notmatch "v20") {
    $url = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\node.msi" -UseBasicParsing
    Start-Process msiexec -Args "/i $env:TEMP\node.msi /quiet /norestart" -Wait
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
  }

Step 4: PostgreSQL 15
  $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
  if (!$pgService) {
    Download PostgreSQL 15 installer from enterprisedb.com
    $pgPass = [System.Web.Security.Membership]::GeneratePassword(16,2)
    Start-Process installer.exe -Args "--mode unattended --superpassword $pgPass
      --servicename postgresql-helpdesk --serverport 5432
      --datadir C:\HelpDesk\pgdata" -Wait
  }
  Add psql to PATH

Step 5: Database setup
  Generate $dbPassword = random 16-char alphanumeric
  Generate $jwtSecret = random 32-char
  Run psql commands to create user + database
  Write C:\HelpDesk\.env with all variables (never display passwords)

Step 6: App installation
  New-Item -ItemType Directory -Force -Path "C:\HelpDesk\app"
  New-Item -ItemType Directory -Force -Path "C:\HelpDesk\uploads\attachments"
  New-Item -ItemType Directory -Force -Path "C:\HelpDesk\uploads\logo"
  Copy app files to C:\HelpDesk\app\
  Write C:\HelpDesk\app\server\.env from template
  cd C:\HelpDesk\app\server; npm ci; npx prisma migrate deploy; npx prisma db seed
  cd C:\HelpDesk\app\client; npm ci; npm run build

Step 7: NSSM + Windows Service
  Download NSSM portable from nssm.cc
  Extract to C:\HelpDesk\nssm\
  C:\HelpDesk\nssm\nssm.exe install HelpDesk-Server node.exe
  Configure service: AppDirectory, AppParameters, AppEnvironmentExtra (.env)
  sc config HelpDesk-Server start=auto
  sc start HelpDesk-Server

Step 8: Nginx for Windows
  Download nginx-1.25.x.zip from nginx.org
  Extract to C:\HelpDesk\nginx\
  Write C:\HelpDesk\nginx\conf\nginx.conf (proxy to 3001, serve client/dist)
  Install Nginx as service via NSSM: C:\HelpDesk\nssm\nssm.exe install HelpDesk-Nginx
  sc config HelpDesk-Nginx start=auto; sc start HelpDesk-Nginx

Step 9: Shortcuts
  $WShell = New-Object -ComObject WScript.Shell
  Desktop shortcut: "HelpDesk" → start http://localhost
  Start Menu folder: Ouvrir / Démarrer les services / Arrêter / Désinstaller

Step 10: Final summary
  Write-Host "╔══════════════════════════════════════════╗"
  Write-Host "║   HelpDesk installé avec succès !        ║"
  Write-Host "║   URL    : http://localhost               ║"
  Write-Host "║   Login  : admin@helpdesk.com            ║"
  Write-Host "║   Mot de passe : admin123                 ║"
  Write-Host "║   ⚠ Changez le mot de passe !           ║"
  Write-Host "╚══════════════════════════════════════════╝"
  $open = Read-Host "Ouvrir HelpDesk maintenant ? (O/N)"
  if ($open -eq "O") { Start-Process "http://localhost" }

All steps wrapped in try/catch with logging to C:\HelpDesk\install.log
Idempotent: each step checks if already done before executing

7. /installer/start.bat:
   @echo off
   net start HelpDesk-Server
   net start HelpDesk-Nginx
   timeout /t 3 /nobreak >nul
   start http://localhost
   echo HelpDesk démarré → http://localhost

8. /installer/stop.bat:
   @echo off
   net stop HelpDesk-Nginx
   net stop HelpDesk-Server
   echo HelpDesk arrêté.

9. /installer/update.bat:
   @echo off
   call stop.bat
   cd C:\HelpDesk\app
   git pull origin main
   cd server && npm ci && npx prisma migrate deploy
   cd ..\client && npm ci && npm run build
   call ..\start.bat

10. /installer/uninstall.ps1:
    Confirm prompt
    Option: keep data (DB + uploads)
    Stop + remove both Windows services
    If not keeping: drop DB + delete C:\HelpDesk\
    Remove desktop shortcut + Start Menu folder
    Print "HelpDesk désinstallé avec succès"

11. /installer/config/helpdesk.conf:
    # Configuration HelpDesk — éditable avant installation
    APP_PORT=80
    COMPANY_NAME=Mon Helpdesk
    ADMIN_EMAIL=admin@helpdesk.com
    SMTP_HOST=
    SMTP_PORT=587
    SMTP_USER=
    SMTP_PASS=
    SURVEY_DELAY_HOURS=48
    SURVEY_COOLDOWN_DAYS=10

Verify all scripts for syntax correctness.
Test install.sh by doing a dry-run check.
Tell me when complete.
```

---

## NOTES IMPORTANTES

- Attendre la confirmation après CHAQUE prompt avant de continuer
- Si une erreur survient, copier l'erreur complète et écrire :
  "Fix this error without breaking existing functionality: [erreur]"
- En début de nouvelle session Claude Code :
  "Read SPEC.md and current project structure. Tell me what is done and what remains."
- Les prompts peuvent être divisés si Claude Code demande à clarifier quelque chose
- Ne pas sauter de prompt même si certaines choses semblent évidentes
