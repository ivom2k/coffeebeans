import { describe, expect, it } from 'vitest';
import { addressSubject, clientAddress } from './clientAddress.ts';

describe('clientAddress', () => {
  it('Should_UseTheSocket_When_NoProxyIsTrusted', () => {
    // Act: without Caddy in front, the header is whatever the client typed.
    const address = clientAddress({ forwardedFor: '203.0.113.9', socketAddress: '198.51.100.7', trustProxy: false });

    // Assert
    expect(address).toBe('198.51.100.7');
  });

  it('Should_UseTheHeader_When_CaddySetIt', () => {
    // Act
    const address = clientAddress({ forwardedFor: '203.0.113.9', socketAddress: '172.18.0.4', trustProxy: true });

    // Assert
    expect(address).toBe('203.0.113.9');
  });

  it('Should_TakeTheLastEntry_When_TheClientSentItsOwn', () => {
    // Act: Caddy appends what it saw; everything before it came from the client.
    const address = clientAddress({
      forwardedFor: '1.1.1.1, 10.0.0.1 ,203.0.113.9',
      socketAddress: '172.18.0.4',
      trustProxy: true,
    });

    // Assert
    expect(address).toBe('203.0.113.9');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not an address', 'kohvioad.eu'],
    ['an address with a port', '203.0.113.9:4711'],
  ])('Should_FallBackToTheSocket_When_TheHeaderIs %s', (_case, forwardedFor) => {
    // Act
    const address = clientAddress({ forwardedFor, socketAddress: '172.18.0.4', trustProxy: true });

    // Assert
    expect(address).toBe('172.18.0.4');
  });

  it.each([
    ['an IPv4 client on an IPv6 socket', '::ffff:198.51.100.7', '198.51.100.7'],
    ['the same in upper case', '::FFFF:198.51.100.7', '198.51.100.7'],
    ['a zone on a link-local address', 'fe80::1%eth0', 'fe80::1'],
    ['brackets', '[2001:db8::1]', '2001:db8::1'],
    ['upper case', '2001:DB8::A', '2001:db8::a'],
  ])('Should_GiveOneForm_When_TheAddressIs %s', (_case, socketAddress, expected) => {
    // Act
    const address = clientAddress({ forwardedFor: undefined, socketAddress, trustProxy: false });

    // Assert
    expect(address).toBe(expected);
  });

  it('Should_ReturnNull_When_NothingIsAnAddress', () => {
    // Act
    const address = clientAddress({ forwardedFor: 'nonsense', socketAddress: undefined, trustProxy: true });

    // Assert
    expect(address).toBeNull();
  });
});

describe('addressSubject', () => {
  it('Should_KeepTheWholeAddress_When_ItIsIpv4', () => {
    // Act
    const subject = addressSubject('198.51.100.7');

    // Assert
    expect(subject).toBe('198.51.100.7');
  });

  it.each([
    ['a full address', '2001:db8:aa:bb:1:2:3:4', '2001:db8:aa:bb::/64'],
    ['zeros in the middle', '2001:db8::1', '2001:db8:0:0::/64'],
    ['zeros inside the prefix', '2001:db8:0:5::9', '2001:db8:0:5::/64'],
    ['loopback', '::1', '0:0:0:0::/64'],
    ['leading zeros in a group', '2001:0db8:00aa:000b::1', '2001:db8:aa:b::/64'],
    ['an embedded IPv4 tail', '64:ff9b::198.51.100.7', '64:ff9b:0:0::/64'],
    ['zeros at the end', '2001:db8:1:2::', '2001:db8:1:2::/64'],
  ])('Should_CutToThe64_When_ItIs %s', (_case, address, expected) => {
    // Act
    const subject = addressSubject(address);

    // Assert
    expect(subject).toBe(expected);
  });

  it('Should_GiveTheSameSubject_When_TwoAddressesShareA64', () => {
    // Act: one subscriber, two of the addresses they can pick freely.
    const subjects = [addressSubject('2001:db8:aa:bb::1'), addressSubject('2001:db8:aa:bb:ffff:ffff:ffff:ffff')];

    // Assert
    expect(subjects[0]).toBe(subjects[1]);
  });

  it('Should_GiveDifferentSubjects_When_The64Differs', () => {
    // Act
    const subjects = [addressSubject('2001:db8:aa:bb::1'), addressSubject('2001:db8:aa:bc::1')];

    // Assert
    expect(subjects[0]).not.toBe(subjects[1]);
  });

  it('Should_ShareOneSubject_When_TheAddressIsUnknown', () => {
    // Act
    const subject = addressSubject(null);

    // Assert
    expect(subject).toBe('unknown');
  });
});
