import { isIP } from 'node:net';

// Who is asking, for the rate limiter and the feedback IP hash. The one place that reads the
// address (CLAUDE.md § Access), because getting it wrong hands the choice to the visitor.

export type AddressSource = {
  forwardedFor: string | undefined;
  socketAddress: string | undefined;
  // True only behind Caddy (NUXT_TRUST_PROXY in deploy/compose.yaml). Anywhere else the header
  // comes straight from the client, who could send a new address with every request.
  trustProxy: boolean;
};

const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

// An address in one form, or null when it isn't one. An IPv4 client that reached an IPv6 socket
// shows as ::ffff:1.2.3.4, and a link-local address carries a zone (%eth0).
const normalise = (value: string | undefined): string | null => {
  const address = (value ?? '').trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '').toLowerCase();
  const unwrapped = mappedIpv4.exec(address)?.[1] ?? address;
  return isIP(unwrapped) === 0 ? null : unwrapped;
};

// Caddy appends the address it saw to whatever the client sent, so the last entry is the only
// one the client didn't write.
export const clientAddress = ({ forwardedFor, socketAddress, trustProxy }: AddressSource): string | null => {
  const forwarded = trustProxy ? normalise(forwardedFor?.split(',').at(-1)) : null;
  return forwarded ?? normalise(socketAddress);
};

// A group that holds an embedded IPv4 address (64:ff9b::1.2.3.4) stands for two.
const groupsOf = (part: string) =>
  (part === '' ? [] : part.split(':').flatMap(group => (group.includes('.') ? ['0', '0'] : [group])));

const firstFourGroups = (address: string): string[] => {
  const [head = '', tail] = address.split('::');
  const leading = groupsOf(head);
  const trailing = tail === undefined ? [] : groupsOf(tail);
  const zeros = Array.from({ length: Math.max(0, 8 - leading.length - trailing.length) }, () => '0');
  return [...leading, ...zeros, ...trailing].slice(0, 4).map(group => Number.parseInt(group, 16).toString(16));
};

// What a limit or a hash is counted against. One IPv6 subscriber holds a whole /64 and can use
// a new address from it for every request, so the /64 stands for them; an IPv4 address stands
// for itself. Requests without a usable address share one subject rather than escape the limit.
export const addressSubject = (address: string | null): string => {
  if (address === null) {
    return 'unknown';
  }
  return isIP(address) === 6 ? `${firstFourGroups(address).join(':')}::/64` : address;
};
