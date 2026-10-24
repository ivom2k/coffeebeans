import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, createMachineModel, createManufacturer, withRollback } from '../../db/tests/helpers.ts';
import { listMachineCatalogue } from './listMachineCatalogue.ts';

describe('listMachineCatalogue', () => {
  afterAll(closeTestDb);

  it('Should_SortByManufacturerThenModelInEstonianOrder_When_ListingTheCatalogue', () => withRollback(async (tx) => {
    // Arrange: Estonian puts z between s and t, and ü near the end.
    const umar = await createManufacturer(tx, { name: 'Ümar' });
    const tamm = await createManufacturer(tx, { name: 'Tamm' });
    const zeller = await createManufacturer(tx, { name: 'Zeller' });
    await createMachineModel(tx, { manufacturerId: umar.id, name: 'U 1' });
    await createMachineModel(tx, { manufacturerId: tamm.id, name: 'T 1000', kind: 'PORTAFILTER' });
    await createMachineModel(tx, { manufacturerId: tamm.id, name: 'T 300' });
    await createMachineModel(tx, { manufacturerId: zeller.id, name: 'Z 1' });

    // Act
    const catalogue = await listMachineCatalogue(tx);

    // Assert
    expect(catalogue.map(model => `${model.manufacturerName} ${model.modelName}`))
      .toEqual(['Zeller Z 1', 'Tamm T 300', 'Tamm T 1000', 'Ümar U 1']);
    expect(catalogue).toContainEqual(expect.objectContaining({ modelName: 'T 1000', kind: 'PORTAFILTER' }));
  }));
});
