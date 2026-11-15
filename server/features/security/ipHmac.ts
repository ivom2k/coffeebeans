import { createHmac } from 'node:crypto';

// An address is only ever kept as an HMAC with a server secret (decisions log §5). A plain hash
// wouldn't do: there are few enough IPv4 addresses to hash them all and look the value up.
export const minHmacKeyLength = 32;

export const hmacOfSubject = (key: string | Buffer, subject: string): string => {
  if (key.length < minHmacKeyLength) {
    throw new Error(`The HMAC key must be at least ${minHmacKeyLength} characters long.`);
  }
  return createHmac('sha256', key).update(subject).digest('hex');
};
