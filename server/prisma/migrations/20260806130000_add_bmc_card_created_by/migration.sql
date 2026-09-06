-- AlterTable
ALTER TABLE "BmcCard" ADD COLUMN     "createdById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "BmcCard" ADD CONSTRAINT "BmcCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
