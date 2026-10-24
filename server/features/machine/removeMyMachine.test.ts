import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { rating, userMachine } from '../../db/schema/index.ts';
import { closeTestDb, createCoffee, createMachineModel, createUser, required, withRollback } from '../../db/tests/helpers.ts';
import { removeMyMachine } from './removeMyMachine.ts';

describe('removeMyMachine', () => {
  afterAll(closeTestDb);

  it('Should_RemoveTheMachineAndKeepItsRatings_When_MachineIsTheUsers', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const model = await createMachineModel(tx);
    const coffee = await createCoffee(tx);
    const [machine] = await tx.insert(userMachine).values({ userId: user.id, machineModelId: model.id }).returning();
    await tx.insert(rating).values({ userId: user.id, coffeeBeanId: coffee.id, machineModelId: model.id, score: 4 });

    // Act
    const result = await removeMyMachine(tx, user.id, required(machine).id);

    // Assert
    expect(result).toEqual({ kind: 'removed' });
    expect(await tx.$count(userMachine, eq(userMachine.userId, user.id))).toBe(0);
    expect(await tx.select().from(rating).where(eq(rating.userId, user.id))).toMatchObject([{ machineModelId: model.id }]);
  }));

  it('Should_ReturnNotFoundAndKeepTheRow_When_MachineBelongsToAnotherUser', () => withRollback(async (tx) => {
    // Arrange
    const owner = await createUser(tx);
    const intruder = await createUser(tx);
    const model = await createMachineModel(tx);
    const [machine] = await tx.insert(userMachine).values({ userId: owner.id, machineModelId: model.id }).returning();

    // Act
    const result = await removeMyMachine(tx, intruder.id, required(machine).id);

    // Assert
    expect(result).toEqual({ kind: 'notFound' });
    expect(await tx.$count(userMachine, eq(userMachine.userId, owner.id))).toBe(1);
  }));
});
