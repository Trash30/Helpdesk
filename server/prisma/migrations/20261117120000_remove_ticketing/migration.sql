-- Suppression du module ticketing (tickets, commentaires, pièces jointes, enquêtes, clients, etc.)
-- ⚠️ Irréversible : faire un pg_dump avant d'appliquer en production.

-- ─── 1. Conversion des permissions des rôles existants ───────────────────────
-- tickets.create (qui gardait aussi les notes/PDF de matchs) devient sports.edit ;
-- les permissions tickets.*, clients.*, comments.*, surveys.* et admin.clientRoles sont retirées.
UPDATE "Role"
SET "permissions" = COALESCE((
      SELECT array_agg(DISTINCT p)
      FROM unnest(
        CASE WHEN 'tickets.create' = ANY("permissions")
             THEN array_append("permissions", 'sports.edit')
             ELSE "permissions" END
      ) AS p
      WHERE p NOT LIKE 'tickets.%'
        AND p NOT LIKE 'clients.%'
        AND p NOT LIKE 'comments.%'
        AND p NOT LIKE 'surveys.%'
        AND p <> 'admin.clientRoles'
    ), ARRAY[]::text[]),
    "roleUpdatedAt" = (now() AT TIME ZONE 'UTC');

-- ─── 2. Nettoyage des paramètres propres au ticketing ────────────────────────
DELETE FROM "Settings"
WHERE "key" IN ('default_priority', 'default_assigned_to', 'auto_close_days',
                'survey_delay_hours', 'survey_cooldown_days', 'survey_enabled');

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_clubId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_typeId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_poleId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_commentId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "SurveySend" DROP CONSTRAINT "SurveySend_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "SurveyResponse" DROP CONSTRAINT "SurveyResponse_surveySendId_fkey";

-- DropForeignKey
ALTER TABLE "ClientClub" DROP CONSTRAINT "ClientClub_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "KbArticle" DROP CONSTRAINT "KbArticle_sourceTicketId_fkey";

-- AlterTable
ALTER TABLE "KbArticle" DROP COLUMN "sourceTicketId";

-- DropTable
DROP TABLE "ClientRole";

-- DropTable
DROP TABLE "Client";

-- DropTable
DROP TABLE "Ticket";

-- DropTable
DROP TABLE "Comment";

-- DropTable
DROP TABLE "Attachment";

-- DropTable
DROP TABLE "ActivityLog";

-- DropTable
DROP TABLE "SurveyTemplate";

-- DropTable
DROP TABLE "SurveySend";

-- DropTable
DROP TABLE "SurveyResponse";

-- DropTable
DROP TABLE "ClientOrganisation";

-- DropTable
DROP TABLE "ClientClub";

-- DropTable
DROP TABLE "ClientPole";

-- DropTable
DROP TABLE "TicketType";

-- DropEnum
DROP TYPE "Status";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "SurveySendStatus";

-- DropEnum
DROP TYPE "QuestionType";

