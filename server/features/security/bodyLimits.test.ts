import { describe, expect, it } from 'vitest';
import { adminImageLimit, bodyLimitFor, checkBody, defaultBodyLimit, type BodyHeaders } from './bodyLimits.ts';

const jsonPost = (overrides: Partial<BodyHeaders> = {}): BodyHeaders => ({
  method: 'POST',
  path: '/api/me/machines',
  contentLength: '120',
  transferEncoding: undefined,
  contentType: 'application/json',
  ...overrides,
});

describe('bodyLimitFor', () => {
  it('Should_GiveTheUploadLimit_When_TheRouteTakesAnImage', () => {
    // Act
    const limit = bodyLimitFor('PUT', '/api/admin/coffees/12/image');

    // Assert
    expect(limit).toBe(adminImageLimit);
  });

  it.each([
    ['another method on the upload path', 'DELETE', '/api/admin/coffees/12/image'],
    ['a path below the upload route', 'PUT', '/api/admin/coffees/12/image/extra'],
    ['a path that only contains it', 'PUT', '/x/api/admin/coffees/12/image'],
    ['an ordinary endpoint', 'POST', '/api/me/machines'],
    ['a route that does not exist', 'POST', '/api/nothing-here'],
  ])('Should_GiveTheDefault_When_ItIs %s', (_case, method, path) => {
    // Act
    const limit = bodyLimitFor(method, path);

    // Assert
    expect(limit).toBe(defaultBodyLimit);
  });

  it('Should_MatchTheUploadRoute_When_ThePathIsSpeltInUpperCaseOrEndsInASlash', () => {
    // Act
    const limits = [bodyLimitFor('put', '/API/Admin/Coffees/12/Image'), bodyLimitFor('PUT', '/api/admin/coffees/12/image/')];

    // Assert
    expect(limits).toEqual([adminImageLimit, adminImageLimit]);
  });
});

describe('checkBody', () => {
  it('Should_Pass_When_AJsonBodyIsWithinTheLimit', () => {
    // Act
    const result = checkBody(jsonPost());

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it.each([
    ['a GET', { method: 'GET', contentLength: undefined, contentType: undefined }],
    ['a DELETE', { method: 'DELETE', contentLength: undefined, contentType: undefined }],
    ['a POST with an empty body', { contentLength: '0', contentType: undefined }],
  ])('Should_Pass_When_ThereIsNoBody (%s)', (_case, overrides) => {
    // Act
    const result = checkBody(jsonPost(overrides));

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it('Should_Answer413_When_TheDeclaredLengthIsOverTheLimit', () => {
    // Act
    const atLimit = checkBody(jsonPost({ contentLength: String(defaultBodyLimit.maxBytes) }));
    const over = checkBody(jsonPost({ contentLength: String(defaultBodyLimit.maxBytes + 1) }));

    // Assert
    expect(atLimit).toEqual({ ok: true });
    expect(over).toMatchObject({ ok: false, status: 413 });
  });

  it('Should_Answer413_When_AGetCarriesALargeBody', () => {
    // Act
    const result = checkBody(jsonPost({ method: 'GET', contentLength: '5000000' }));

    // Assert
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it('Should_Answer411_When_TheBodyIsChunked', () => {
    // Act
    const result = checkBody(jsonPost({ contentLength: undefined, transferEncoding: 'chunked' }));

    // Assert
    expect(result).toMatchObject({ ok: false, status: 411 });
  });

  it.each(['-1', '1e3', '12 ', 'abc', '0x10'])('Should_Answer400_When_ContentLengthIsNotANumber (%s)', (contentLength) => {
    // Act
    const result = checkBody(jsonPost({ contentLength }));

    // Assert
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it.each([
    ['text/plain', 'text/plain'],
    ['a form', 'application/x-www-form-urlencoded'],
    ['multipart', 'multipart/form-data; boundary=x'],
    ['a lookalike', 'application/jsonp'],
    ['nothing', undefined],
  ])('Should_Answer415_When_AJsonRouteGets %s', (_case, contentType) => {
    // Act
    const result = checkBody(jsonPost({ contentType }));

    // Assert
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it.each(['application/json', 'application/json; charset=utf-8', 'APPLICATION/JSON'])(
    'Should_Pass_When_TheContentTypeIsJson (%s)',
    (contentType) => {
      // Act
      const result = checkBody(jsonPost({ contentType }));

      // Assert
      expect(result).toEqual({ ok: true });
    },
  );

  it('Should_LeaveTheContentTypeToTheHandler_When_TheRouteTakesAnImage', () => {
    // Act: the handler checks the bytes themselves, which no header can fake.
    const result = checkBody({
      method: 'PUT',
      path: '/api/admin/coffees/1/image',
      contentLength: String(adminImageLimit.maxBytes),
      transferEncoding: undefined,
      contentType: 'application/octet-stream',
    });

    // Assert
    expect(result).toEqual({ ok: true });
  });
});
