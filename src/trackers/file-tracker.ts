import { ITracker, AppliedRecord, TrackerInit } from './tracker.js';
import fs from 'fs/promises';
import path from 'path';

export class FileTracker implements ITracker {
  private filePath!: string;

  async init(cfg: TrackerInit): Promise<void> {
    const { path: filePath = '.runce.json' } = cfg as { path?: string };
    this.filePath = path.resolve(filePath);

    // Ensure the directory exists
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    // Ensure the file exists
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify({ applied: [] }, null, 2));
    }
  }

  async getAppliedIds(): Promise<Set<string>> {
    try {
      const data = await this.readData();
      return new Set(data.applied.filter((r: AppliedRecord) => r.status === 'success').map((r: AppliedRecord) => r.id));
    } catch {
      return new Set();
    }
  }

  async recordApplied(rec: AppliedRecord): Promise<void> {
    const data = await this.readData();

    // Remove existing record with same ID
    data.applied = data.applied.filter((r: AppliedRecord) => r.id !== rec.id);

    // Add new record
    data.applied.push({
      ...rec,
      appliedAt: rec.appliedAt.toISOString(),
    });

    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async listApplied(): Promise<AppliedRecord[]> {
    const data = await this.readData();
    return data.applied.map((r: any) => ({
      ...r,
      appliedAt: new Date(r.appliedAt),
    }));
  }

  private async readData(): Promise<{ applied: any[] }> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { applied: [] };
    }
  }
}