import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { userMachine } from '../../db/schema/index.ts';
import { closeTestDb, createMachineModel, createManufacturer, createUser, withRollback } from '../../db/tests/helpers.ts';
import { maxMachinesPerAccount } from '../../../shared/utils/machine.ts';
import { addMyMachine } from './addMyMachine.ts';

// One multi-row INSERT: a transaction is a single connection, so no queries in parallel.
const machines = (count: number, userId: number, machineModelId: number) =>
  Array.from({ length: count }, () => ({ userId, machineModelId }));

describe('addMyMachine', () => {
  afterAll(closeTestDb);

  it('Should_AddTheMachineWithItsNames_When_ModelExists', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const maker = await createManufacturer(tx, { name: 'Duomatica' });
    const model = await createMachineModel(tx, { manufacturerId: maker.id, name: 'Duo 5' });

    // Act
    const result = await addMyMachine(tx, user.id, { machineModelId: model.id, nickname: 'Töö' });

    // Assert
    expect(result).toEqual({
      kind: 'added',
      machine: {
        id: expect.any(Number), modelId: model.id, manufacturerName: 'Duomatica', modelName: 'Duo 5', kind: 'AUTOMATIC', nickname: 'Töö',
      },
    });
    expect(await tx.select().from(userMachine).where(eq(userMachine.userId, user.id)))
      .toMatchObject([{ machineModelId: model.id, nickname: 'Töö' }]);
  }));

  it('Should_ReturnUnknownModel_When_ModelDoesNotExist', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);

    // Act
    const result = await addMyMachine(tx, user.id, { machineModelId: 999_999, nickname: null });

    // Assert
    expect(result).toEqual({ kind: 'unknownModel' });
    expect(await tx.$count(userMachine, eq(userMachine.userId, user.id))).toBe(0);
  }));

  it('Should_RefuseTheMachine_When_AccountAlreadyHasTheMost', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const model = await createMachineModel(tx);
    await tx.insert(userMachine).values(machines(maxMachinesPerAccount, user.id, model.id));

    // Act
    const result = await addMyMachine(tx, user.id, { machineModelId: model.id, nickname: null });

    // Assert
    expect(result).toEqual({ kind: 'limitReached' });
    expect(await tx.$count(userMachine, eq(userMachine.userId, user.id))).toBe(maxMachinesPerAccount);
  }));

  it('Should_AddTheLastMachine_When_AccountIsOneBelowTheMost', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const model = await createMachineModel(tx);
    await tx.insert(userMachine).values(machines(maxMachinesPerAccount - 1, user.id, model.id));

    // Act
    const result = await addMyMachine(tx, user.id, { machineModelId: model.id, nickname: null });

    // Assert
    expect(result).toMatchObject({ kind: 'added' });
    expect(await tx.$count(userMachine, eq(userMachine.userId, user.id))).toBe(maxMachinesPerAccount);
  }));

  it('Should_CountOnlyTheUsersOwnMachines_When_AnotherAccountIsFull', () => withRollback(async (tx) => {
    // Arrange
    const user = await createUser(tx);
    const other = await createUser(tx);
    const model = await createMachineModel(tx);
    await tx.insert(userMachine).values(machines(maxMachinesPerAccount, other.id, model.id));

    // Act
    const result = await addMyMachine(tx, user.id, { machineModelId: model.id, nickname: null });

    // Assert
    expect(result).toMatchObject({ kind: 'added' });
  }));
});
