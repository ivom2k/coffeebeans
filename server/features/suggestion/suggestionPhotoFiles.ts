import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Suggestion photos under the private media folder, which no web server mounts (CLAUDE.md
// § Access). Every path has this shape, the same one suggestion_image_path_chk allows in the
// table, and is checked before any file operation: a row edited by hand can't point the server
// at another file.
const storedPathPattern = /^suggestion\/[0-9a-f]{32}\.webp$/;

// Random, so a name says nothing about who sent it and can't be guessed.
export const newPhotoPath = () => `suggestion/${randomBytes(16).toString('hex')}.webp`;

// The file's place on disk, only for a path the server generates and only inside the folder.
const fileOf = (privateDir: string, photoPath: string): string => {
  if (!storedPathPattern.test(photoPath)) {
    throw new Error(`Refusing a suggestion photo path the app never writes: ${photoPath}`);
  }
  const root = resolve(privateDir);
  const file = resolve(root, photoPath);
  if (!file.startsWith(`${root}${sep}`)) {
    throw new Error('Refusing a suggestion photo path outside the private folder.');
  }
  return file;
};

const hasCode = (error: unknown, code: string) => error instanceof Error && 'code' in error && error.code === code;

// A file already gone is the outcome a delete wants, so only other errors are raised.
const removeFile = async (file: string): Promise<void> => {
  try {
    await unlink(file);
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      throw error;
    }
  }
};

export const writePhoto = async (privateDir: string, photoPath: string, photo: Buffer): Promise<void> => {
  const file = fileOf(privateDir, photoPath);
  await mkdir(dirname(file), { recursive: true });
  try {
    // `wx` fails rather than replace a file that is already there.
    await writeFile(file, photo, { flag: 'wx' });
  } catch (error) {
    // A write that fails partway (a full disk) has already created the file, and no row will ever
    // name it. A name that was taken belongs to another suggestion, so that file stays.
    if (!hasCode(error, 'EEXIST')) {
      await removeFile(file).catch((cleanupError: unknown) => {
        console.error(`Partial suggestion photo not removed: ${cleanupError instanceof Error ? cleanupError.message : 'unknown error'}`);
      });
    }
    throw error;
  }
};

export const removePhoto = (privateDir: string, photoPath: string): Promise<void> => removeFile(fileOf(privateDir, photoPath));
