-- CreateEnum
CREATE TYPE "LoraStatus" AS ENUM ('NONE', 'TRAINING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN "loraUrl" TEXT,
ADD COLUMN "loraStatus" "LoraStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "loraTriggerWord" TEXT,
ADD COLUMN "loraTrainedAt" TIMESTAMP(3),
ADD COLUMN "loraTrainingJobId" TEXT,
ADD COLUMN "loraDataset" JSONB;

-- AlterTable
ALTER TABLE "TrendItem" ADD COLUMN "sourceVideoUrl" TEXT,
ADD COLUMN "videoFrameUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
