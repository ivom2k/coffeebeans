import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from './requestOrigin.ts';

const host = 'kohvioad.eu';

describe('isSameOriginRequest', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])('Should_Pass_When_MethodNeverWrites (%s)', (method) => {
    // Act: even from another site, since a read changes nothing.
    const result = isSameOriginRequest({ method, secFetchSite: 'cross-site', origin: 'https://evil.example', host });

    // Assert
    expect(result).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('Should_Pass_When_AWriteComesFromThisOrigin (%s)', (method) => {
    // Act
    const result = isSameOriginRequest({ method, secFetchSite: 'same-origin', origin: 'https://kohvioad.eu', host });

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ['another site', 'cross-site'],
    ['a subdomain', 'same-site'],
    ['a typed address', 'none'],
    ['an unknown value', 'whatever'],
  ])('Should_Refuse_When_AWriteComesFrom %s', (_case, secFetchSite) => {
    // Act: Sec-Fetch-Site decides, even when Origin claims this site.
    const result = isSameOriginRequest({ method: 'POST', secFetchSite, origin: 'https://kohvioad.eu', host });

    // Assert
    expect(result).toBe(false);
  });

  it.each([
    ['this site', 'https://kohvioad.eu', true],
    ['this site in another case', 'https://KOHVIOAD.eu', true],
    ['another site', 'https://evil.example', false],
    ['a subdomain', 'https://shop.kohvioad.eu', false],
    ['this site on another port', 'https://kohvioad.eu:8443', false],
    ['a lookalike host', 'https://kohvioad.eu.evil.example', false],
    ['a sandboxed frame', 'null', false],
    ['not a URL', 'kohvioad.eu', false],
  ])('Should_CompareOriginWithHost_When_SecFetchSiteIsMissing (%s)', (_case, origin, expected) => {
    // Act
    const result = isSameOriginRequest({ method: 'POST', secFetchSite: undefined, origin, host });

    // Assert
    expect(result).toBe(expected);
  });

  it('Should_Pass_When_TheRequestIsNotFromABrowser', () => {
    // Act: curl and the tests send neither header.
    const result = isSameOriginRequest({ method: 'DELETE', secFetchSite: undefined, origin: undefined, host });

    // Assert
    expect(result).toBe(true);
  });

  it('Should_Refuse_When_OriginIsSentWithoutAHost', () => {
    // Act
    const result = isSameOriginRequest({ method: 'POST', secFetchSite: undefined, origin: 'https://kohvioad.eu', host: undefined });

    // Assert
    expect(result).toBe(false);
  });

  it('Should_MatchTheDevServer_When_HostHasAPort', () => {
    // Act
    const result = isSameOriginRequest({ method: 'POST', secFetchSite: undefined, origin: 'http://localhost:3000', host: 'localhost:3000' });

    // Assert
    expect(result).toBe(true);
  });
});
