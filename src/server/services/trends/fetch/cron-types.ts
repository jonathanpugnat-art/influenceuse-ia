export interface CronRunResult {
  ok: boolean;
  provider: string | null;
  snapshotsCreated: number;
  itemsCreated: number;
  itemsRefreshed?: number;
  formatsAnalyzed?: number;
  thumbnailsMirrored?: number;
  skipped?: string;
}
