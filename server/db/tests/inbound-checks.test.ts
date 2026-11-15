import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from '../client.ts';
import { feedback, suggestion } from '../schema/index.ts';
import { closeTestDb, createUser, withRollback } from './helpers.ts';

// What the database refuses for suggestions and feedback, whatever wrote the row: the API, a
// later feature, or a hand edit in DBeaver. 23514 is Postgres' check_violation.
const checkViolation = (constraint: string) => ({ cause: { code: '23514', constraint } });

// A nested transaction is a savepoint, so a refused insert doesn't abort the test's transaction.
const inSavepoint = <T>(tx: Database, work: (savepoint: Database) => Promise<T>) => tx.transaction(work);

const validPhotoPath = `suggestion/${'0123456789abcdef'.repeat(2)}.webp`;

afterAll(closeTestDb);

describe('suggestion checks', () => {
  it('Should_AcceptThePhoto_When_ItsPathIsOneTheServerGenerates', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const [row] = await tx.insert(suggestion)
      .values({ suggestionType: 'COFFEE_BEAN', userId: user.id, imagePath: validPhotoPath })
      .returning({ imagePath: suggestion.imagePath });

    // Assert
    expect(row?.imagePath).toBe(validPhotoPath);
  }));

  it.each([
    ['a path out of the folder', '../../etc/passwd'],
    ['an absolute path', '/etc/passwd'],
    ['a folder above, behind the right prefix', `suggestion/../${'a'.repeat(32)}.webp`],
    ['a public coffee photo', `coffee/vallozzi-crema-${'a'.repeat(16)}.webp`],
    ['another file type', `suggestion/${'a'.repeat(32)}.svg`],
    ['a name that is too short', `suggestion/${'a'.repeat(31)}.webp`],
    ['upper-case hex', `suggestion/${'A'.repeat(32)}.webp`],
    ['a second line after a valid name', `suggestion/${'a'.repeat(32)}.webp\n../x`],
    ['an empty string', ''],
  ])('Should_RefuseThePhoto_When_ItsPathIs %s', (_case, imagePath) => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const insert = inSavepoint(tx, savepoint =>
      savepoint.insert(suggestion).values({ suggestionType: 'COFFEE_BEAN', userId: user.id, imagePath }));

    // Assert
    await expect(insert).rejects.toMatchObject(checkViolation('suggestion_image_path_chk'));
  }));

  it('Should_RefuseThePhoto_When_TheSuggestionIsNoLongerPending', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act: a reviewed suggestion that still names a photo (decisions log §6).
    const insert = inSavepoint(tx, savepoint => savepoint.insert(suggestion).values({
      suggestionType: 'COFFEE_BEAN',
      userId: user.id,
      imagePath: validPhotoPath,
      status: 'REJECTED',
      reviewReason: 'NOT_ENOUGH_INFO',
      reviewedAt: new Date(),
    }));

    // Assert
    await expect(insert).rejects.toMatchObject(checkViolation('suggestion_image_chk'));
  }));

  it('Should_RefuseTheDetails_When_TheyAreLargerThanAnyFormSends', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const fits = await tx.insert(suggestion)
      .values({ suggestionType: 'COFFEE_BEAN', userId: user.id, details: { name: 'a'.repeat(1900) } })
      .returning({ id: suggestion.id });
    const tooLarge = inSavepoint(tx, savepoint => savepoint.insert(suggestion)
      .values({ suggestionType: 'COFFEE_BEAN', userId: user.id, details: { name: 'a'.repeat(2100) } }));

    // Assert
    expect(fits).toHaveLength(1);
    await expect(tooLarge).rejects.toMatchObject(checkViolation('suggestion_details_size_chk'));
  }));
});

describe('feedback checks', () => {
  it.each([
    ['the home page', '/'],
    ['a coffee page', '/kohv/vallozzi-crema'],
    ['no page', null],
  ])('Should_AcceptThePagePath_When_ItIs %s', (_case, pagePath) => withRollback(async (tx) => {
    // Act
    const [row] = await tx.insert(feedback).values({ message: 'Tere!', pagePath }).returning({ pagePath: feedback.pagePath });

    // Assert
    expect(row?.pagePath).toBe(pagePath);
  }));

  it.each([
    ['another site', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example/kohv'],
    ['a script URL', 'javascript:alert(1)'],
    ['a relative path', 'kohv/vallozzi-crema'],
    ['an empty string', ''],
  ])('Should_RefuseThePagePath_When_ItIs %s', (_case, pagePath) => withRollback(async (tx) => {
    // Act
    const insert = inSavepoint(tx, savepoint => savepoint.insert(feedback).values({ message: 'Tere!', pagePath }));

    // Assert
    await expect(insert).rejects.toMatchObject(checkViolation('feedback_page_path_chk'));
  }));
});
