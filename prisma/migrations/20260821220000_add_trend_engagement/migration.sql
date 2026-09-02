-- Persist raw engagement so Trends can rank what actually works
-- and so generation can reuse high-performing posts as examples.

ALTER TABLE "TrendItem" ADD COLUMN "viewCount" INTEGER;
ALTER TABLE "TrendItem" ADD COLUMN "likesCount" INTEGER;
ALTER TABLE "TrendItem" ADD COLUMN "commentsCount" INTEGER;

CREATE INDEX "TrendItem_likesCount_idx" ON "TrendItem"("likesCount");
CREATE INDEX "TrendItem_viewCount_idx" ON "TrendItem"("viewCount");
