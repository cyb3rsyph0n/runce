export interface AppliedRecord {
  id: string;
  name: string;
  checksum: string;
  appliedAt: Date;
  durationMs: number;
  status: 'success' | 'failed';
  error?: string;
}