import { describe, expect, it } from 'vitest';
import { maxHttpUrlLength, toHttpUrl } from './httpUrl.ts';

describe('toHttpUrl', () => {
  it.each([
    ['a plain https link', 'https://pood.example/kohv/crema?id=4', 'https://pood.example/kohv/crema?id=4'],
    ['an http link', 'http://pood.example', 'http://pood.example/'],
    ['an upper-case scheme', 'HTTPS://pood.example/a', 'https://pood.example/a'],
    ['an international host', 'https://kohvipõld.example/', 'https://xn--kohvipld-j4a.example/'],
  ])('Should_KeepTheLink_When_ItIs %s', (_case, value, expected) => {
    // Act
    const result = toHttpUrl(value);

    // Assert
    expect(result).toBe(expected);
  });

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['javascript in upper case', 'JAVASCRIPT:alert(1)'],
    ['javascript split by a tab', 'java\tscript:alert(1)'],
    ['javascript split by a newline', 'java\nscript:alert(1)'],
    ['a data URL', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['a file URL', 'file:///etc/passwd'],
    ['ftp', 'ftp://pood.example/'],
    ['protocol-relative', '//evil.example/'],
    ['a path', '/kohv/crema'],
    ['credentials', 'http://user:pass@pood.example/'],
    ['a user name alone', 'https://user@pood.example/'],
    ['no host', 'http://'],
    ['a space inside', 'https://pood.example/a b'],
    ['a NUL inside', 'https://pood.example/\u0000'],
    ['empty', ''],
    ['one character too long', `https://pood.example/${'a'.repeat(maxHttpUrlLength - 20)}`],
    ['longer than allowed once encoded', `https://pood.example/${'ä'.repeat(200)}`],
    ['not a string', 42],
    ['missing', undefined],
  ])('Should_RefuseTheLink_When_ItIs %s', (_case, value) => {
    // Act
    const result = toHttpUrl(value);

    // Assert
    expect(result).toBeNull();
  });
});
