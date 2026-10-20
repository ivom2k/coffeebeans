import { afterAll, describe, expect, it } from 'vitest';
import type { CoffeeListItem, RankingFilters } from '../../../shared/types/coffee.ts';
import {
  addRatings, closeTestDb, createBrand, createCoffee, createMachineModel, rateCoffee, withRollback,
} from '../../db/tests/helpers.ts';
import { listRankedCoffees } from './listRankedCoffees.ts';
import type { Thresholds } from './thresholds.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 5, issueFlagShare: 0.4 };
const noFilters: RankingFilters = { roastLevels: [], fewIssuesOnly: false };
const slugs = (items: readonly CoffeeListItem[]) => items.map(item => item.slug);

describe('listRankedCoffees', () => {
  afterAll(closeTestDb);

  it('Should_RankByShrunkMean_When_RawMeansDisagree', () => withRollback(async (tx) => {
    // Arrange: the decisions log §2 example, with a global mean of 3.8.
    const single = await createCoffee(tx, { slug: 'single-five' });
    const many = await createCoffee(tx, { slug: 'twenty-ratings' });
    const filler = await createCoffee(tx, { slug: 'filler' });
    await rateCoffee(tx, single.id, [5]);
    await rateCoffee(tx, many.id, [...Array<number>(12).fill(4), ...Array<number>(8).fill(5)]);
    await rateCoffee(tx, filler.id, [3, 3, 3, 2, 2, 2, 2, 2, 2]);

    // Act
    const { ranked } = await listRankedCoffees(tx, noFilters, rules);

    // Assert: 4.28 beats 4.0, although "5,0 (1)" has the higher raw mean.
    expect(slugs(ranked)).toEqual(['twenty-ratings', 'single-five', 'filler']);
    expect(ranked[1]).toMatchObject({ ratingCount: 1, rawMean: 5 });
  }));

  it('Should_ListUnratedCoffeesApartInEstonianOrder_When_TheyHaveNoRatings', () => withRollback(async (tx) => {
    // Arrange: in the Estonian alphabet z comes right after s, so Zeta sorts before Tamm.
    const rated = await createCoffee(tx, { slug: 'rated' });
    await rateCoffee(tx, rated.id, [4]);
    const tamm = await createBrand(tx, { name: 'Tamm' });
    const zeta = await createBrand(tx, { name: 'Zeta' });
    await createCoffee(tx, { brandId: tamm.id, slug: 'tamm-unrated' });
    await createCoffee(tx, { brandId: zeta.id, slug: 'zeta-unrated' });

    // Act
    const { ranked, unrated } = await listRankedCoffees(tx, noFilters, rules);

    // Assert
    expect(slugs(ranked)).toEqual(['rated']);
    expect(slugs(unrated)).toEqual(['zeta-unrated', 'tamm-unrated']);
  }));

  it('Should_LeaveOutArchivedAndDraftCoffees_When_Ranking', () => withRollback(async (tx) => {
    // Arrange
    const published = await createCoffee(tx, { slug: 'published' });
    const archived = await createCoffee(tx, { slug: 'archived', status: 'ARCHIVED' });
    await createCoffee(tx, { slug: 'draft', status: 'DRAFT' });
    await rateCoffee(tx, published.id, [4]);
    await rateCoffee(tx, archived.id, [5]);

    // Act
    const { ranked, unrated } = await listRankedCoffees(tx, noFilters, rules);

    // Assert
    expect([...slugs(ranked), ...slugs(unrated)]).toEqual(['published']);
  }));

  it('Should_KeepOnlyChosenRoastLevels_When_RoastFilterIsSet', () => withRollback(async (tx) => {
    // Arrange
    await createCoffee(tx, { slug: 'light', roastLevel: 1 });
    await createCoffee(tx, { slug: 'dark', roastLevel: 5 });
    await createCoffee(tx, { slug: 'undeclared', roastLevel: null });

    // Act
    const { unrated } = await listRankedCoffees(tx, { roastLevels: [1, 2], fewIssuesOnly: false }, rules);

    // Assert: a coffee without a declared roast level can't match.
    expect(slugs(unrated)).toEqual(['light']);
  }));

  it('Should_FlagAndHideOnlyCommonTrouble_When_FewIssuesOnly', () => withRollback(async (tx) => {
    // Arrange
    const model = await createMachineModel(tx);
    const answers = (withIssues: number, withoutIssues: number) => [
      ...Array.from({ length: withIssues }, () => ({ score: 4, machineModelId: model.id, issues: ['GRINDER_JAMMED'] })),
      ...Array.from({ length: withoutIssues }, () => ({ score: 4, machineModelId: model.id, issues: [] })),
    ];
    const common = await createCoffee(tx, { slug: 'common-trouble' });
    const rare = await createCoffee(tx, { slug: 'rare-trouble' });
    const tooFew = await createCoffee(tx, { slug: 'too-few-answers' });
    await addRatings(tx, common.id, answers(2, 3)); // 40 %
    await addRatings(tx, rare.id, answers(1, 4)); // 20 %
    await addRatings(tx, tooFew.id, answers(4, 0)); // 100 %, but only 4 answers

    // Act
    const unfiltered = await listRankedCoffees(tx, noFilters, rules);
    const filtered = await listRankedCoffees(tx, { roastLevels: [], fewIssuesOnly: true }, rules);

    // Assert
    expect(Object.fromEntries(unfiltered.ranked.map(item => [item.slug, item.issueFlag]))).toEqual({
      'common-trouble': { answered: 5, withIssues: 2 },
      'rare-trouble': null,
      'too-few-answers': null,
    });
    expect(slugs(filtered.ranked).toSorted()).toEqual(['rare-trouble', 'too-few-answers']);
  }));
});
