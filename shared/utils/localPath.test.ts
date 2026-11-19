import { describe, expect, it } from 'vitest';
import { maxPagePathLength, toLocalPath, toPagePath } from './localPath.ts';

// Ways a value can leave the site, shared by both functions.
const leavingTheSite = [
  ['protocol-relative', '//evil.example/kohv'],
  ['backslash after the slash', '/\\evil.example'],
  ['two backslashes', '\\\\evil.example'],
  ['tab inside the slashes', '/\t/evil.example'],
  ['newline inside the slashes', '/\n/evil.example'],
  ['a dot segment before the slashes', '/.//evil.example'],
  ['a dot-dot segment before the slashes', '/a/..//evil.example'],
  ['an encoded dot segment before the slashes', '/%2e//evil.example'],
  ['absolute https', 'https://evil.example/'],
  ['absolute URL of this site', 'https://kohvioad.eu/kohv'],
  ['javascript URL', 'javascript:alert(1)'],
  ['data URL', 'data:text/html,<p>x</p>'],
] as const;

const notUsable = [
  ['missing', undefined],
  ['empty', ''],
  ['relative path', 'kohv/crema-scura'],
  ['repeated query parameter', ['/kohv/a', '/kohv/b']],
  ['number', 42],
  ['too long', `/${'a'.repeat(2048)}`],
] as const;

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

  it.each(leavingTheSite)('Should_ReturnHome_When_ValueLeavesTheSite (%s)', (_, value) => {
    // Act
    const result = toLocalPath(value);

    // Assert
    expect(result).toBe('/');
  });

  it.each(notUsable)('Should_ReturnHome_When_ValueIsNotAUsablePath (%s)', (_, value) => {
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

describe('toPagePath', () => {
  it('Should_KeepOnlyThePathname_When_ValueHasAQueryAndHash', () => {
    // Arrange
    const value = '/kohv/x?q=secret#frag';

    // Act
    const result = toPagePath(value);

    // Assert
    expect(result).toBe('/kohv/x');
  });

  it.each(leavingTheSite)('Should_ReturnNull_When_ValueLeavesTheSite (%s)', (_, value) => {
    // Act
    const result = toPagePath(value);

    // Assert
    expect(result).toBeNull();
  });

  it.each(notUsable)('Should_ReturnNull_When_ValueIsNotAUsablePath (%s)', (_, value) => {
    // Act
    const result = toPagePath(value);

    // Assert
    expect(result).toBeNull();
  });

  it('Should_ReturnNull_When_ThePathnameIsLongerThanTheColumn', () => {
    // Arrange: the query doesn't count, the pathname does.
    const fits = `/${'a'.repeat(maxPagePathLength - 1)}?q=${'b'.repeat(500)}`;
    const tooLong = `/${'a'.repeat(maxPagePathLength)}`;

    // Act
    const results = [toPagePath(fits), toPagePath(tooLong)];

    // Assert
    expect(results).toEqual([`/${'a'.repeat(maxPagePathLength - 1)}`, null]);
  });
});
