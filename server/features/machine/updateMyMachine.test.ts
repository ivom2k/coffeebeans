import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { userMachine } from '../../db/schema/index.ts';
import { closeTestDb, createMachineModel, createUser, required, withRollback } from '../../db/tests/helpers.ts';
import { updateMyMachine } from './updateMyMachine.ts';

describe('updateMyMachine', () => {
  afterAll(closeTestDb);

  it('Should_ChangeTheNickname_When_MachineIsTheUsers', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const model = await createMachineModel(tx);
    const [machine] = await tx.insert(userMachine).values({ userId: user.id, machineModelId: model.id, nickname: 'Kodu' }).returning();

    // Act
    const result = await updateMyMachine(tx, user.id, required(machine).id, 'Suvila');

    // Assert
    expect(result).toEqual({ kind: 'updated' });
    expect(await tx.select().from(userMachine).where(eq(userMachine.userId, user.id))).toMatchObject([{ nickname: 'Suvila' }]);
  }));

  it('Should_ReturnNotFoundAndKeepTheRow_When_MachineBelongsToAnotherUser', () => withRollback(async (tx) => {
    // Arrange
    const owner = await createUser(tx);
    const intruder = await createUser(tx);
    const model = await createMachineModel(tx);
    const [machine] = await tx.insert(userMachine).values({ userId: owner.id, machineModelId: model.id, nickname: 'Kodu' }).returning();

    // Act
    const result = await updateMyMachine(tx, intruder.id, required(machine).id, 'Mine now');

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
    expect(await tx.select().from(userMachine).where(eq(userMachine.userId, owner.id))).toMatchObject([{ nickname: 'Kodu' }]);
  }));
});
