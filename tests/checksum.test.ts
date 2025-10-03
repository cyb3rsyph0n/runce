import { calculateChecksum } from '../src/core/checksum.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

describe('checksum', () => {
  it('should calculate consistent checksums', async () => {
    const testFile = join(process.cwd(), 'test-file.txt');
    const content = 'hello world\n';

    try {
      await writeFile(testFile, content);
      const checksum1 = await calculateChecksum(testFile);
      const checksum2 = await calculateChecksum(testFile);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await unlink(testFile).catch(() => { });
    }
  });

  it('should normalize line endings', async () => {
    const testFile1 = join(process.cwd(), 'test-file1.txt');
    const testFile2 = join(process.cwd(), 'test-file2.txt');

    try {
      await writeFile(testFile1, 'hello\nworld\n');
      await writeFile(testFile2, 'hello\r\nworld\r\n');

      const checksum1 = await calculateChecksum(testFile1);
      const checksum2 = await calculateChecksum(testFile2);

      expect(checksum1).toBe(checksum2);
    } finally {
      await unlink(testFile1).catch(() => { });
      await unlink(testFile2).catch(() => { });
    }
  });
});