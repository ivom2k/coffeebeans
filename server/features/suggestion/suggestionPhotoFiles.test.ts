import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newPhotoPath, writePhoto } from './suggestionPhotoFiles.ts';

// writeFile is the real one unless a test makes it fail partway, as a full disk does.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});

const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

let privateDir: string;
beforeAll(async () => {
  privateDir = await mkdtemp(join(tmpdir(), 'kohvioad-photo-files-'));
});
afterAll(async () => {
  await rm(privateDir, { recursive: true, force: true });
});

const storedFiles = () => readdir(join(privateDir, 'suggestion'));

describe('writePhoto', () => {
  it('Should_LeaveNoFileBehind_When_TheWriteFailsPartway', async () => {
    // Arrange: some bytes reach the disk, then it is full.
    vi.mocked(writeFile).mockImplementationOnce(async (file, _data, options) => {
      await actualFs.writeFile(file, 'half a photo', options);
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
    });
    const photoPath = newPhotoPath();

    // Act
    const writing = writePhoto(privateDir, photoPath, Buffer.from('a whole photo'));

    // Assert: the error that stopped it, and no file left for no row.
    await expect(writing).rejects.toThrow('ENOSPC');
    expect(await storedFiles()).not.toContain(photoPath.replace('suggestion/', ''));
  });

  it('Should_KeepTheOtherFile_When_TheNameIsAlreadyTaken', async () => {
    // Arrange: another suggestion's photo under the same name.
    const photoPath = newPhotoPath();
    await mkdir(join(privateDir, 'suggestion'), { recursive: true });
    await actualFs.writeFile(join(privateDir, photoPath), 'the other photo');

    // Act
    const writing = writePhoto(privateDir, photoPath, Buffer.from('a new photo'));

    // Assert
    await expect(writing).rejects.toThrow('EEXIST');
    expect(await readFile(join(privateDir, photoPath), 'utf8')).toBe('the other photo');
  });
});
