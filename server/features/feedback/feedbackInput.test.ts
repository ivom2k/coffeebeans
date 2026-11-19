import { describe, expect, it } from 'vitest';
import { maxFeedbackLength } from '../../../shared/utils/feedback.ts';
import { feedbackInputSchema } from './feedbackInput.ts';

describe('feedbackInputSchema', () => {
  it('Should_TrimTheMessageAndKeepOnlyThePathname_When_TheInputIsValid', () => {
    // Act
    const input = feedbackInputSchema.parse({ message: '  Vale röstiaste\r\n', pagePath: '/kohv/x?q=secret#frag', website: '' });

    // Assert
    expect(input).toEqual({ message: 'Vale röstiaste', pagePath: '/kohv/x', website: '' });
  });

  it.each([['another site', 'https://evil.example/'], ['a protocol-relative link', '//evil.example'], ['nothing', undefined]])(
    'Should_StoreNoPage_When_ThePathIs %s',
    (_, pagePath) => {
      // Act
      const input = feedbackInputSchema.parse({ message: 'Tere', pagePath });

      // Assert
      expect(input.pagePath).toBeNull();
    },
  );

  it.each([
    ['empty', ''],
    ['only spaces and line breaks', ' \n\t '],
    ['one character too long', 'x'.repeat(maxFeedbackLength + 1)],
    ['a NUL', 'Tere\u0000'],
  ])('Should_RefuseTheMessage_When_ItIs %s', (_, message) => {
    // Act
    const result = feedbackInputSchema.safeParse({ message, pagePath: '/' });

    // Assert
    expect(result.success).toBe(false);
  });

  it('Should_RefuseTheInput_When_ItHasAFieldNobodyExpects', () => {
    // Act
    const result = feedbackInputSchema.safeParse({ message: 'Tere', pagePath: '/', userId: 1 });

    // Assert
    expect(result.success).toBe(false);
  });
});
