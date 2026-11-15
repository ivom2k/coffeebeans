import { describe, expect, it } from 'vitest';
import { canAddMachine, maxMachinesPerAccount } from './machine';

describe('canAddMachine', () => {
  it.each([0, 1, maxMachinesPerAccount - 1])('Should_AllowAnotherMachine_When_AccountHasFewerThanTheMost (%i)', (count) => {
    // Act
    const allowed = canAddMachine(count);

    // Assert
    expect(allowed).toBe(true);
  });

  // Over the limit too: rows added by hand, or a limit lowered later, must not reopen the door.
  it.each([maxMachinesPerAccount, maxMachinesPerAccount + 1])('Should_RefuseAnotherMachine_When_AccountHasTheMostOrMore (%i)', (count) => {
    // Act
    const allowed = canAddMachine(count);

    // Assert
    expect(allowed).toBe(false);
  });
});
