-- CreateEnum
CREATE TYPE "BmcDivision" AS ENUM ('TOP14', 'PRO_D2');

-- CreateTable
CREATE TABLE "BmcCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "division" "BmcDivision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BmcCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BmcCard_ip_key" ON "BmcCard"("ip");
