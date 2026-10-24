import { describe, expect, it } from 'vitest';
import { ratingInputSchema } from './ratingInput.ts';

const unanswered = {
  score: 4,
  perception: { bitterness: null, roastCharacter: null, crema: null, strength: null },
  beanSurface: null,
  machineModelId: null,
  machineIssues: null,
  privateNote: null,
};

describe('rating input', () => {
  it('Should_AcceptAScoreAlone_When_EverythingElseIsUnanswered', () => {
    // Act
    const input = ratingInputSchema.parse(unanswered);

    // Assert
    expect(input).toEqual(unanswered);
  });

  it('Should_Reject_When_ScoreIsNotAWholeNumberFromOneToFive', () => {
    // Act
    const results = [0, 6, 3.5, null].map(score => ratingInputSchema.safeParse({ ...unanswered, score }));

    // Assert
    expect(results.map(result => result.success)).toEqual([false, false, false, false]);
  });

  it('Should_Reject_When_ASliderIsOutsideOneToFive', () => {
    // Act
    const result = ratingInputSchema.safeParse({ ...unanswered, perception: { ...unanswered.perception, crema: 6 } });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_Reject_When_IssuesAreAnsweredWithoutAMachine', () => {
    // Act
    const noIssues = ratingInputSchema.safeParse({ ...unanswered, machineIssues: [] });
    const someIssues = ratingInputSchema.safeParse({ ...unanswered, machineIssues: ['GRINDER_JAMMED'] });

    // Assert
    expect([noIssues.success, someIssues.success]).toEqual([false, false]);
  });

  it('Should_AcceptIssues_When_AMachineIsNamed', () => {
    // Act
    const input = ratingInputSchema.parse({ ...unanswered, machineModelId: 7, machineIssues: ['GRINDER_JAMMED', 'OTHER'] });

    // Assert
    expect(input.machineIssues).toEqual(['GRINDER_JAMMED', 'OTHER']);
  });

  it('Should_Reject_When_AnIssueCodeRepeats', () => {
    // Act
    const result = ratingInputSchema.safeParse({ ...unanswered, machineModelId: 7, machineIssues: ['OTHER', 'OTHER'] });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_Reject_When_ACodeIsNotInTheVocabulary', () => {
    // Act
    const surface = ratingInputSchema.safeParse({ ...unanswered, beanSurface: 'WET' });
    const issue = ratingInputSchema.safeParse({ ...unanswered, machineModelId: 7, machineIssues: ['MACHINE_ON_FIRE'] });

    // Assert
    expect([surface.success, issue.success]).toEqual([false, false]);
  });

  it('Should_TrimTheNoteAndStoreNone_When_NoteIsBlank', () => {
    // Act
    const trimmed = ratingInputSchema.parse({ ...unanswered, privateNote: '  Jahvatus 8  ' });
    const blank = ratingInputSchema.parse({ ...unanswered, privateNote: '   ' });

    // Assert
    expect([trimmed.privateNote, blank.privateNote]).toEqual(['Jahvatus 8', null]);
  });

  it('Should_Reject_When_NoteIsLongerThan500Characters', () => {
    // Act
    const result = ratingInputSchema.safeParse({ ...unanswered, privateNote: 'x'.repeat(501) });

    // Assert
    expect(result.success).toBe(false);
  });
});
