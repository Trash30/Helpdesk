-- CreateEnum
CREATE TYPE "MatchNoteStatus" AS ENUM ('VERT', 'ORANGE', 'ROUGE');

-- AlterTable
ALTER TABLE "MatchNote" ADD COLUMN     "status" "MatchNoteStatus" NOT NULL DEFAULT 'VERT';
