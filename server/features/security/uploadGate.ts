// The uploads one route receives at once. Each holds up to its route's cap in memory while its
// body arrives, at the client's pace, so the places bound that memory. No queue: a request that
// finds every place taken is told to come back. One place per account, so one account's slow
// uploads can't take the others' places (decisions log §6).

export type GateResult<T> = { kind: 'ran'; value: T } | { kind: 'busy' } | { kind: 'inProgress' };

export const createUploadGate = ({ places }: { places: number }) => {
  const holders = new Set<number>();

  return async <T>(accountId: number, work: () => Promise<T>): Promise<GateResult<T>> => {
    if (holders.has(accountId)) {
      return { kind: 'inProgress' };
    }
    if (holders.size >= places) {
      return { kind: 'busy' };
    }
    holders.add(accountId);
    try {
      return { kind: 'ran', value: await work() };
    } finally {
      holders.delete(accountId);
    }
  };
};
