-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sportCompetitions" TEXT[] DEFAULT ARRAY[]::TEXT[];
