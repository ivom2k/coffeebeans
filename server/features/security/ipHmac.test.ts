import { describe, expect, it } from 'vitest';
import { hmacOfSubject } from './ipHmac.ts';

const key = 'k'.repeat(32);

describe('hmacOfSubject', () => {
  it('Should_Give64HexCharacters_When_HashingAnAddress', () => {
    // Act
    const hmac = hmacOfSubject(key, '198.51.100.7');

    // Assert: what feedback.ip_hmac, a char(64), holds.
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(hmac).not.toContain('198.51.100.7');
  });

  it('Should_GiveTheSameValue_When_TheAddressAndKeyRepeat', () => {
    // Act
    const hmacs = [hmacOfSubject(key, '198.51.100.7'), hmacOfSubject(key, '198.51.100.7')];

    // Assert
    expect(hmacs[0]).toBe(hmacs[1]);
  });

  it('Should_GiveAnotherValue_When_TheKeyDiffers', () => {
    // Act: without the key, the stored value can't be recomputed from a guessed address.
    const hmacs = [hmacOfSubject(key, '198.51.100.7'), hmacOfSubject('j'.repeat(32), '198.51.100.7')];

    // Assert
    expect(hmacs[0]).not.toBe(hmacs[1]);
  });

  it.each(['', 'short', 'k'.repeat(31)])('Should_Refuse_When_TheKeyIsMissingOrShort (%s)', (weakKey) => {
    // Act
    const hash = () => hmacOfSubject(weakKey, '198.51.100.7');

    // Assert
    expect(hash).toThrow('at least 32 characters');
  });
});
