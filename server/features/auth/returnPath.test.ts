import { describe, expect, it } from 'vitest';
import { toLocalPath } from './returnPath.ts';

describe('toLocalPath', () => {
  it('Should_KeepThePath_When_ValueIsAPathOnThisSite', () => {
    // Arrange
    const value = '/kohv/crema-scura';

    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/kohv/crema-scura');
  });

  it('Should_KeepQueryAndHash_When_PathHasThem', () => {
    // Arrange
    const value = '/otsing?q=lavaza#tulemused';

    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/otsing?q=lavaza#tulemused');
  });

  it.each([
    ['protocol-relative', '//evil.example/kohv'],
    ['backslash after the slash', '/\\evil.example'],
    ['two backslashes', '\\\\evil.example'],
    ['tab inside the slashes', '/\t/evil.example'],
    ['newline inside the slashes', '/\n/evil.example'],
    ['absolute https', 'https://evil.example/'],
    ['absolute URL of this site', 'https://kohvioad.eu/kohv'],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<p>x</p>'],
  ])('Should_ReturnHome_When_ValueLeavesTheSite (%s)', (_, value) => {
    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['relative path', 'kohv/crema-scura'],
    ['repeated query parameter', ['/kohv/a', '/kohv/b']],
    ['number', 42],
    ['too long', `/${'a'.repeat(2048)}`],
  ])('Should_ReturnHome_When_ValueIsNotAUsablePath (%s)', (_, value) => {
    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/');
  });

  it('Should_StayOnThisSite_When_SlashesArePercentEncoded', () => {
    // Arrange
    const value = '/%2F%2Fevil.example';

    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/%2F%2Fevil.example');
  });
});
