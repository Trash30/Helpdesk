# User Guide — Helpdesk VOGO

**Audience:** support agents, supervisors
**Level:** everyday computer users
**Application:** http://helpdesk.local

> **Screenshots:** the `📷` placeholders indicate where to add a screenshot. Recommended tool: Win+Shift+S (Windows Snipping Tool).

---

## Table of contents

1. [Login](#1-login)
2. [Dashboard](#2-dashboard)
3. [Tickets](#3-tickets)
4. [Clients](#4-clients)
5. [Sports Events](#5-sports-events)
6. [Knowledge Base](#6-knowledge-base)
7. [My Profile](#7-my-profile)
8. [Administration](#8-administration-admins-only)

---

## 1. Login

Access **http://helpdesk.local** from any workstation on the network.

> 📷 *Screenshot: login page (email + password fields + Login button)*

- Enter the **email** and **password** provided by the administrator
- Click **Login**
- **First access:** a password change is required before accessing the application

### Forgotten password
Click **"Forgot password?"** → enter the email → a reset link is sent (valid for 24h).

### Logout
Click the avatar in the top right → **Log out**. The session expires automatically after 8h.

---

## 2. Dashboard

Home page after login. Real-time overview of support activity.

> 📷 *Screenshot: full dashboard (KPIs at the top, charts, urgent tickets table, sports widget at the bottom)*

### Counters (top row)
Each card is **clickable** and opens the corresponding filtered ticket list.

| Card | What it shows |
|-------|-------------------|
| Open tickets | Tickets with OPEN status |
| In progress | Tickets with IN_PROGRESS status |
| Closed today | Tickets closed during the day |
| Events today | Today's matches for your followed competitions |
| Events this week | Total matches for the week |
| Awaiting update | Tickets with no update for +5 days |

Counters refresh **every 60 seconds** automatically.

### Charts
- **Line chart** (left): tickets created over the last 30 days
- **Donut chart** (right): breakdown of active tickets by priority

### Urgent tickets table
The 10 CRITICAL or HIGH tickets that are not closed, so nothing important gets missed.

### Sports widget
At the bottom of the page — matches of the week with your support notes. See [section 5](#5-sports-events).

---

## 3. Tickets

### 3.1 Ticket list

> 📷 *Screenshot: ticket list with active filters and results*

Access via **Tickets** in the left navigation bar.

**Available filters** (combinable):

| Filter | Usage |
|--------|------------|
| Text search | Searches the number, title, client name |
| Status | OPEN / IN_PROGRESS / PENDING / CLOSED (multi-select) |
| Priority | CRITICAL / HIGH / MEDIUM / LOW (multi-select) |
| Category | Filter by issue type |
| My tickets | Shows only tickets assigned to you |
| Organisation / Club | Filter by client structure |
| Creation date | Start / end period |

**"Reset filters"** button to return to the default filters.

**Export** (buttons top right):
- **CSV** — can be opened in Excel
- **PDF** — landscape format, limited to 1000 rows

---

### 3.2 Create a ticket

> 📷 *Screenshot: ticket creation form*

**"+ New ticket"** button at the top of the list.

Fields to fill in:

| Field | Required | Description |
|-------|-------------|-------------|
| Title | Yes | Short summary of the issue |
| Description | No | Details of the issue (Markdown supported) |
| Client | Yes | Contact involved |
| Category | Yes | Type of request |
| Type | No | Sub-category |
| Priority | Yes | LOW / MEDIUM / HIGH / CRITICAL |
| Division | No | Internal support division involved |

---

### 3.3 Process a ticket

> 📷 *Screenshot: ticket detail page (two-column desktop view)*

#### Change the status
In the right panel, select the new status:

```
OPEN → IN_PROGRESS → PENDING → CLOSED
```

- **PENDING**: a dialog asks for the reason for putting the ticket on hold
- **CLOSED**: a closing note is **required** (max 500 characters)

> 📷 *Screenshot: closing dialog with required note field*

#### Edit the information
Title editable directly by clicking. Category, priority, division and assigned agent can be edited in the right panel.

#### Add a comment
Area at the bottom left of the page.

> 📷 *Screenshot: comment area with "Internal note" toggle and attachment area*

- **Formatting**: Bold (Ctrl+B), Italic (Ctrl+I), Code (Ctrl+`)
- **Internal note**: orange toggle → comment visible only to agents, not to clients
- **Attachments**: up to 5 files per comment (5 MB max each)
- Send via **Ctrl+Enter** or the "Send" button

#### Create a knowledge base article from a closed ticket
After closing, if you have the `kb.write` permission, a dialog offers to automatically create an article from the ticket (pre-filled title, selection of comments to include, choice of draft/published).

---

## 4. Clients

> 📷 *Screenshot: client list with search bar*

Access via **Clients** in the navigation.

**Search** by name, email, organisation, club. "Open tickets" filter to see contacts with active requests.

### Client profile

> 📷 *Screenshot: detailed client profile (information + ticket history)*

- Information: name, email, phone, organisation, club, role
- Statistics: total number of tickets, open, resolved, average resolution time
- Full history of the contact's tickets

**Quick access from a ticket:** click on the client's name in the right panel → opens the profile without leaving the ticket (side panel).

---

## 5. Sports Events

Two access points:
- **Dashboard** → bottom of the page (full-week widget)
- **Events → Today** in the navigation → today's matches only

> 📷 *Screenshot: sports widget on the dashboard (matches grouped by competition)*

### 5.1 Reading the calendar

Matches are grouped by competition, filtered according to your preferences (see [section 7](#7-my-profile)). If no preference is configured, all competitions are shown.

Supported competitions: TOP 14, PRO D2, EPCR Champions Cup, EPCR Challenge Cup, Liqui Moly Starligue, ELMS, Premium Liiga (Estonia).

**↻** button at the top of the widget to force a data reload from the scraper (30s cooldown).

### 5.2 PDF attachments

On each match, an upload button lets you attach a PDF (mission order, match sheet, etc.). Max size 10 MB. Files are **automatically deleted 6h after the match**.

### 5.3 Support notes

> 📷 *Screenshot: match note editor open (traffic light + rich text editor)*

Click **"Add notes"** on a match to open the editor.

**Traffic light** (required for the report):

| Colour | Meaning |
|---------|--------------|
| 🟢 GREEN | No incident — nothing to report |
| 🟠 ORANGE | Point to monitor |
| 🔴 RED | Incident or point of attention |

**Other fields:**
- **Production**: select the broadcast unit (BeIN / Via Storia / AMP Visual / IXI Live / None)
- **Chaperoning**: check + select the responsible technician
- **Free content**: rich text editor with Bold, Italic, Underline, lists, images

**Images in notes**: paste (Ctrl+V), drag and drop, or use the upload button in the toolbar. The image is hosted on the server and embedded in the exported report.

**Save** button to save. The note remains visible even after the match (rebuilt from the metadata if the match disappears from the scraper).

### 5.4 Weekly report export

> 📷 *Screenshot: "Export report" button at the top of the widget*

**"Export report"** button → downloads a Word file `CR_Sxx.docx` containing:

- Title: "SUPPORT REPORT WEEK xx — [year]"
- Technicians field (editable in Word)
- A block per noted match: visual traffic light, team logos, time, TV broadcaster, production, chaperoned technician, note content
- GREEN matches with no content, no production and no chaperoning are **omitted** from the report

---

## 6. Knowledge Base

> 📷 *Screenshot: knowledge base article list with search bar and filters*

Access via **Knowledge base** in the navigation.

**Search** by keyword, category, tags. Filters: Draft / Published.

### Create an article
**"+ New article"** button → rich text editor (same as match notes). Choose category, tags and status (Draft or Published directly).

**From a closed ticket**: see [section 3.3](#33-process-a-ticket) — the pre-filled creation dialog is faster.

---

## 7. My Profile

> 📷 *Screenshot: profile page (competitions section with checkboxes)*

Access via the **avatar** in the top right → **My profile**.

### Followed sports competitions

Select the leagues you provide support for. These preferences filter:
- The dashboard sports widget
- The "Events today" page
- The dashboard "Events" KPI counters

If **no competition is checked**, all of them are shown. Click **Save** after making changes.

### Change password

Enter the current password + the new one (minimum 8 characters, 1 uppercase letter, 1 digit). The strength indicator is displayed in real time.

After the change: automatic logout, you must sign in again with the new password.

---

## 8. Administration (admins only)

Accessible via **Administration** in the navigation (visible only with the `admin.access` permission).

> 📷 *Screenshot: administration menu expanded in the sidebar*

### Team (`/admin/users`)
Create, edit, activate/deactivate agent accounts. Sending a password reset email is done from this page.

### Roles (`/admin/roles`)
Create custom roles and configure their permissions. A permission change takes **effect immediately** on all active sessions.

### Categories (`/admin/categories`)
Manage ticket categories (colour, name). Reorderable by drag and drop.

### Organisations & Clubs (`/admin/organisations`, `/admin/clubs`)
Client hierarchy: an organisation contains clubs, a club contains contacts.

### Divisions (`/admin/poles`)
Internal VOGO support divisions (e.g. Technical, Commercial, Production).

### Ticket types (`/admin/ticket-types`)
Ticket sub-categories (e.g. Incident, Request, Question).

### Satisfaction surveys (`/admin/surveys`)

> 📷 *Screenshot: surveys dashboard (CSAT/NPS scores + trends)*

Results of surveys sent automatically after a ticket is closed. CSAT and NPS scores available by month.

### Settings (`/admin/settings`)
- **Appearance**: company logo (drag and drop PNG/JPG/SVG), display name
- **Tickets**: default priority, default assignment, automatic closing after N days (0 = disabled)
- **Surveys**: delay before sending (hours), cooldown between two surveys (days)

---

## Useful shortcuts

| Action | Shortcut |
|--------|-----------|
| Send a comment | Ctrl + Enter |
| Bold | Ctrl + B |
| Italic | Ctrl + I |
| Inline code format | Ctrl + ` |
| Paste an image into a note | Ctrl + V (in the editor) |

---

*Document generated on June 14, 2026 — Helpdesk VOGO v2*
