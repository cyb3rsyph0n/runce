import crypto from 'crypto';
import fs from 'fs/promises';

export async function calculateChecksum(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Normalize line endings to ensure consistent checksums across platforms
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate checksum for ${filePath}: ${error}`);
  }
}