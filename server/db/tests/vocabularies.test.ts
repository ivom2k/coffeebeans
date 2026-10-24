import { asc } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { beanSurfaceCodes, machineIssueCodes } from '../../../shared/types/rating.ts';
import { beanSurface, machineIssue } from '../schema/index.ts';
import { closeTestDb, withRollback } from './helpers.ts';

// The app's code lists double as i18n keys and API enums, so they must name exactly the rows
// the vocabularies migration inserts, in the same order.
describe('vocabulary code lists', () => {
  afterAll(closeTestDb);

  it('Should_MatchTheMachineIssueRows_When_ReadInSortOrder', () => withRollback(async (tx) => {
    // Act
    const rows = await tx.select({ code: machineIssue.code }).from(machineIssue).orderBy(asc(machineIssue.sortOrder));

    // Assert
    expect(rows.map(row => row.code)).toEqual(machineIssueCodes);
  }));

  it('Should_MatchTheBeanSurfaceRows_When_ReadInSortOrder', () => withRollback(async (tx) => {
    // Act
    const rows = await tx.select({ code: beanSurface.code }).from(beanSurface).orderBy(asc(beanSurface.sortOrder));

    // Assert
    expect(rows.map(row => row.code)).toEqual(beanSurfaceCodes);
  }));
});
