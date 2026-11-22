import { describe, expect, it } from 'vitest';
import { buckets, limitRuleFor } from './rateLimits.ts';

describe('limitRuleFor', () => {
  it.each([
    ['search', 'GET', '/api/search', buckets.search, 'ip'],
    ['the search page', 'GET', '/otsing', buckets.search, 'ip'],
    ['the search page in another locale', 'GET', '/ru/otsing', buckets.search, 'ip'],
    ['the sign-in start and callback', 'GET', '/api/auth/google', buckets.signIn, 'ip'],
    ['a rating save', 'PUT', '/api/me/ratings/vallozzi-crema', buckets.ratingSave, 'user'],
    ['adding a machine', 'POST', '/api/me/machines', buckets.machineWrite, 'user'],
    ['renaming a machine', 'PATCH', '/api/me/machines/7', buckets.machineWrite, 'user'],
    ['removing a machine', 'DELETE', '/api/me/machines/7', buckets.machineWrite, 'user'],
    ['sending feedback', 'POST', '/api/feedback', buckets.feedback, 'user'],
    ['sending a suggestion', 'POST', '/api/me/suggestions', buckets.suggestionCreate, 'user'],
    ['marking outcomes seen', 'POST', '/api/me/suggestions/seen', buckets.suggestionSeen, 'user'],
  ] as const)('Should_Count_When_ItIs %s', (_case, method, path, bucket, by) => {
    // Act
    const rule = limitRuleFor(method, path);

    // Assert
    expect(rule).toEqual({ bucket, by });
  });

  it.each([
    ['an admin write', 'PUT', '/api/admin/coffees/1'],
    ['an admin upload', 'PUT', '/api/admin/coffees/1/image'],
    ['sign-out', 'DELETE', '/api/_auth/session'],
  ])('Should_NotCount_When_ItIs %s', (_case, method, path) => {
    // Act
    const rule = limitRuleFor(method, path);

    // Assert
    expect(rule).toBe('none');
  });

  it.each([
    ['a cached page', 'GET', '/kohv/vallozzi-crema'],
    ['a cached endpoint', 'GET', '/api/ranking'],
    ['the user\'s own data', 'GET', '/api/me/machines'],
    ['the user\'s own suggestions', 'GET', '/api/me/suggestions'],
    ['an admin read', 'GET', '/api/admin/coffees'],
    ['the session check', 'GET', '/api/_auth/session'],
  ])('Should_HaveNoRule_When_ItIsARead (%s)', (_case, method, path) => {
    // Act
    const rule = limitRuleFor(method, path);

    // Assert
    expect(rule).toBeUndefined();
  });

  it.each([
    ['a new endpoint nobody listed', 'POST', '/api/something-new'],
    ['a write to a read-only route', 'POST', '/api/search'],
    ['a write to a page', 'DELETE', '/kohv/vallozzi-crema'],
  ])('Should_FallIntoTheUnlistedBucket_When_ItIs %s', (_case, method, path) => {
    // Act
    const rule = limitRuleFor(method, path);

    // Assert
    expect(rule).toEqual({ bucket: buckets.unlisted, by: 'user' });
  });

  it('Should_FindTheSameRule_When_ThePathIsSpeltInUpperCaseOrEndsInASlash', () => {
    // Act: a variant spelling must not slip past the count.
    const rules = [limitRuleFor('get', '/API/Search'), limitRuleFor('GET', '/api/search/')];

    // Assert
    expect(rules).toEqual([{ bucket: buckets.search, by: 'ip' }, { bucket: buckets.search, by: 'ip' }]);
  });
});
