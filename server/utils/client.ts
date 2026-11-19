import { randomBytes } from 'node:crypto';
import { Socket } from 'node:net';
import type { H3Event } from 'h3';
import { addressSubject, clientAddress } from '../features/security/clientAddress.ts';
import { hmacOfSubject, minHmacKeyLength } from '../features/security/ipHmac.ts';
import { createRateLimiter, type RateLimiter } from '../features/security/rateLimiter.ts';

// The client's address as a subject to count against: an IPv4 address, or an IPv6 /64. The only
// code that reads the address from a request (eslint.config.mjs keeps it that way).
export const clientSubject = (event: H3Event): string => addressSubject(clientAddress({
  forwardedFor: getRequestHeader(event, 'x-forwarded-for'),
  socketAddress: event.node.req.socket.remoteAddress,
  trustProxy: useRuntimeConfig(event).trustProxy,
}));

// A page rendered on the server fetches its data by calling the endpoint inside this process,
// through a stand-in request with no network connection behind it. A request from outside
// always arrives on a real socket, so this can't be faked from there.
export const isInternalRequest = (event: H3Event): boolean => !(event.node.req.socket instanceof Socket);

// The limiter never holds an address either, only its HMAC. The key lives as long as the
// process, like the counts it protects, so there is nothing to configure or to leak.
const limiterKey = randomBytes(32);

export const limiterSubject = (event: H3Event): string => hmacOfSubject(limiterKey, clientSubject(event));

// The address as anonymous feedback stores it, under NUXT_IP_HMAC_KEY: the key has to outlive
// the process, since the daily count per sender is read back from the table. Null when the key
// is missing or too short, which the caller answers without storing anything.
export const storedIpHmac = (event: H3Event): string | null => {
  const key = useRuntimeConfig(event).ipHmacKey;
  return key.length >= minHmacKeyLength ? hmacOfSubject(key, clientSubject(event)) : null;
};

let limiter: RateLimiter | undefined;

// One limiter for the whole process, created on first use like the database pool.
export const useRateLimiter = (): RateLimiter => {
  limiter ??= createRateLimiter();
  return limiter;
};
