-- CreateTable
CREATE TABLE "BasePortrait" (
    "id" TEXT NOT NULL,
    "niche" "Niche" NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'female',
    "ethnicity" TEXT NOT NULL,
    "bodyType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasePortrait_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BasePortrait_niche_gender_active_idx" ON "BasePortrait"("niche", "gender", "active");

-- CreateIndex
CREATE INDEX "BasePortrait_active_isNsfw_idx" ON "BasePortrait"("active", "isNsfw");
