import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { feedback } from '../../db/schema/index.ts';
import { closeTestDb, required, withRollback } from '../../db/tests/helpers.ts';
import { countInbox } from './countInbox.ts';
import { setFeedbackStatus } from './setFeedbackStatus.ts';

describe('setFeedbackStatus', () => {
  afterAll(closeTestDb);

  it('Should_ChangeTheStatusAndTheCount_When_TheMessageExists', () => withRollback(async (tx) => {
    // Arrange
    const [row] = await tx.insert(feedback).values([{ message: 'A' }, { message: 'B' }]).returning({ id: feedback.id });
    const { id } = required(row);

    // Act
    const result = await setFeedbackStatus(tx, id, 'DONE');

    // Assert
    expect(result).toEqual({ kind: 'updated' });
    expect(await tx.select({ status: feedback.status }).from(feedback).where(eq(feedback.id, id))).toEqual([{ status: 'DONE' }]);
    expect(await countInbox(tx)).toEqual({ newFeedback: 1, pendingSuggestions: 0 });
  }));

  it('Should_ReturnNotFound_When_TheIdIsUnknown', () => withRollback(async (tx) => {
    // Act
    const result = await setFeedbackStatus(tx, 999_999, 'READ');

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
  }));
});
