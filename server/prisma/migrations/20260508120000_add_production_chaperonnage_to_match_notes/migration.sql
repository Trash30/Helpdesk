-- AlterTable
ALTER TABLE "MatchNote" ADD COLUMN     "production" TEXT,
ADD COLUMN     "chaperonnage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chaperonneTechnicienId" TEXT;

-- AddForeignKey
ALTER TABLE "MatchNote" ADD CONSTRAINT "MatchNote_chaperonneTechnicienId_fkey" FOREIGN KEY ("chaperonneTechnicienId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
