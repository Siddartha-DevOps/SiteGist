-- CreateTable
CREATE TABLE "ZapierHook" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hookUrl" TEXT NOT NULL,
    "event" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZapierHook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZapierHook_projectId_idx" ON "ZapierHook"("projectId");

-- CreateIndex
CREATE INDEX "ZapierHook_projectId_event_idx" ON "ZapierHook"("projectId", "event");

-- AddForeignKey
ALTER TABLE "ZapierHook" ADD CONSTRAINT "ZapierHook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
