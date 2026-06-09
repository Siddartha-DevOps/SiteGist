-- CreateTable
CREATE TABLE "UserAddon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "externalSubscriptionId" TEXT,
    "externalCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAddon_userId_idx" ON "UserAddon"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAddon_userId_type_key" ON "UserAddon"("userId", "type");

-- AddForeignKey
ALTER TABLE "UserAddon" ADD CONSTRAINT "UserAddon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
