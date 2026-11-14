import { describe, expect, it } from 'vitest';
import { allowedStatuses, speciesShare } from './catalogue';

describe('speciesShare', () => {
  it('Should_AcceptTheBlend_When_PercentagesAddUpTo100', () => {
    // Act
    const share = speciesShare([{ percentage: 80 }, { percentage: 20 }]);

    // Assert
    expect(share).toEqual({ total: 100, allQuantified: true, valid: true });
  });

  it('Should_RejectTheBlend_When_EveryPercentageIsGivenButTheSumIsNot100', () => {
    // Act
    const share = speciesShare([{ percentage: 80 }, { percentage: 30 }]);

    // Assert
    expect(share).toEqual({ total: 110, allQuantified: true, valid: false });
  });

  it('Should_AcceptTheBlend_When_SomeSpeciesHaveNoPercentage', () => {
    // Act: "Arabica & Robusta", or one number on the bag and not the other.
    const unquantified = speciesShare([{ percentage: null }, { percentage: null }]);
    const partly = speciesShare([{ percentage: 70 }, { percentage: null }]);

    // Assert
    expect(unquantified.valid).toBe(true);
    expect(partly).toEqual({ total: 70, allQuantified: false, valid: true });
  });

  it('Should_AcceptNoSpecies_When_TheBagDoesNotSay', () => {
    // Act
    const share = speciesShare([]);

    // Assert
    expect(share).toEqual({ total: 0, allQuantified: false, valid: true });
  });
});

describe('allowedStatuses', () => {
  it.each([null, 'DRAFT'] as const)('Should_OfferEveryStatus_When_TheCoffeeWasNeverPublic (%s)', (saved) => {
    // Act
    const statuses = allowedStatuses(saved);

    // Assert
    expect(statuses).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
  });

  it.each(['PUBLISHED', 'ARCHIVED'] as const)('Should_LeaveOutDraft_When_TheCoffeeHasBeenPublic (%s)', (saved) => {
    // Act
    const statuses = allowedStatuses(saved);

    // Assert
    expect(statuses).toEqual(['PUBLISHED', 'ARCHIVED']);
  });
});
