-- CreateTable
CREATE TABLE "CommercialEvent" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "techContactFirstName" TEXT NOT NULL,
    "techContactLastName" TEXT NOT NULL,
    "techContactEmail" TEXT NOT NULL,
    "techContactPhone" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommercialEvent" ADD CONSTRAINT "CommercialEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

