-- CreateTable
CREATE TABLE "MatchNote" (
    "id" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "competition" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "matchTime" TEXT NOT NULL,
    "venue" TEXT,
    "homeTeamLogo" TEXT,
    "awayTeamLogo" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchNote_matchKey_key" ON "MatchNote"("matchKey");

-- AddForeignKey
ALTER TABLE "MatchNote" ADD CONSTRAINT "MatchNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
