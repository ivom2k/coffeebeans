import { afterAll, describe, expect, it } from 'vitest';
import { userMachine } from '../../db/schema/index.ts';
import { closeTestDb, createMachineModel, createManufacturer, createUser, withRollback } from '../../db/tests/helpers.ts';
import { listMyMachines } from './listMyMachines.ts';

describe('listMyMachines', () => {
  afterAll(closeTestDb);

  it('Should_ListOnlyTheUsersOwnMachinesInTheOrderAdded_When_OthersHaveMachinesToo', () => withRollback(async (tx) => {
    // Arrange
    const me = await createUser(tx);
    const someoneElse = await createUser(tx);
    const maker = await createManufacturer(tx, { name: 'Veskimees' });
    const home = await createMachineModel(tx, { manufacturerId: maker.id, name: 'VM 300' });
    const work = await createMachineModel(tx, { manufacturerId: maker.id, name: 'VM 100', kind: 'PORTAFILTER' });
    await tx.insert(userMachine).values([
      { userId: me.id, machineModelId: home.id, nickname: 'Kodu' },
      { userId: someoneElse.id, machineModelId: home.id, nickname: 'Not mine' },
      { userId: me.id, machineModelId: work.id, nickname: null },
    ]);

    // Act
    const machines = await listMyMachines(tx, me.id);

    // Assert
    expect(machines).toMatchObject([
      { modelId: home.id, manufacturerName: 'Veskimees', modelName: 'VM 300', kind: 'AUTOMATIC', nickname: 'Kodu' },
      { modelId: work.id, manufacturerName: 'Veskimees', modelName: 'VM 100', kind: 'PORTAFILTER', nickname: null },
    ]);
  }));
});
