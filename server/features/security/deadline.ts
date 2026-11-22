export type DeadlineResult<T> = { kind: 'done'; value: T } | { kind: 'timedOut' };

// The work's result, or `timedOut` once `ms` have passed, whichever comes first. The work itself
// isn't stopped: the caller ends whatever feeds it. A rejection that arrives after the deadline is
// already handled by the race, so it never surfaces as an unhandled one.
export const withDeadline = async <T>(work: Promise<T>, ms: number): Promise<DeadlineResult<T>> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<DeadlineResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timedOut' }), ms);
  });
  try {
    return await Promise.race([work.then((value): DeadlineResult<T> => ({ kind: 'done', value })), deadline]);
  } finally {
    clearTimeout(timer);
  }
};
