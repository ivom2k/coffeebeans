import { describe, expect, it } from 'vitest';
import { suggestedSlug, toSlug } from './slug';

describe('toSlug', () => {
  it('Should_JoinBrandAndName_When_GivenSeveralParts', () => {
    // Act
    const slug = toSlug('pohjarost', 'Öine Espresso');

    // Assert: the seed's own slug for this coffee.
    expect(slug).toBe('pohjarost-oine-espresso');
  });

  it.each([
    ['Põhjaröst', 'pohjarost'],
    ['Löfbergs Lila', 'lofbergs-lila'],
    ['Šokolaad Žoss', 'sokolaad-zoss'],
    ['Straße Kaffee', 'strasse-kaffee'],
    ['Søren Æble Œuvre', 'soren-aeble-oeuvre'],
  ])('Should_FoldAccents_When_NameHasThem (%s)', (name, expected) => {
    // Act
    const slug = toSlug(name);

    // Assert
    expect(slug).toBe(expected);
  });

  it.each([
    ['Crema & Aroma', 'crema-aroma'],
    ['  Etioopia Guji 2026  ', 'etioopia-guji-2026'],
    ['"Tume" — röst!', 'tume-rost'],
    ['N°1 Blend', 'n-1-blend'],
  ])('Should_LeaveOnlySingleHyphens_When_NameHasPunctuation (%j)', (name, expected) => {
    // Act
    const slug = toSlug(name);

    // Assert
    expect(slug).toBe(expected);
  });

  it('Should_ReturnAnEmptySlug_When_NothingIsLeftAfterFolding', () => {
    // Act
    const slug = toSlug('—', '');

    // Assert
    expect(slug).toBe('');
  });
});

describe('suggestedSlug', () => {
  it('Should_FollowBrandAndName_When_NotEditedByHand', () => {
    // Act
    const slug = suggestedSlug({ brandSlug: 'vallozzi', name: 'Crema Dolce', current: 'vallozzi-crema', editedByHand: false });

    // Assert
    expect(slug).toBe('vallozzi-crema-dolce');
  });

  it('Should_KeepTheTypedSlug_When_EditedByHand', () => {
    // Act
    const slug = suggestedSlug({ brandSlug: 'vallozzi', name: 'Crema Dolce', current: 'crema', editedByHand: true });

    // Assert
    expect(slug).toBe('crema');
  });

  it('Should_FollowAgain_When_TheHandEditedSlugIsEmptied', () => {
    // Act
    const slug = suggestedSlug({ brandSlug: 'vallozzi', name: 'Crema Dolce', current: '', editedByHand: true });

    // Assert
    expect(slug).toBe('vallozzi-crema-dolce');
  });

  it('Should_UseTheNameAlone_When_NoBrandIsChosenYet', () => {
    // Act
    const slug = suggestedSlug({ brandSlug: null, name: 'Crema Dolce', current: '', editedByHand: false });

    // Assert
    expect(slug).toBe('crema-dolce');
  });
});
