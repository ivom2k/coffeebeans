// The one place that reads the driver's error fields (decisions log §7): switching away from pg
// changes this file, not the features that map a violated constraint to a result.

export type ConstraintViolation = { kind: 'unique' | 'foreignKey'; constraint: string };

// Postgres error codes: 23505 unique_violation, 23503 foreign_key_violation.
const violationKinds: Readonly<Record<string, ConstraintViolation['kind']>> = {
  23505: 'unique',
  23503: 'foreignKey',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Drizzle wraps the driver's error in a DrizzleQueryError; pg's own fields sit on its cause.
export const constraintViolation = (error: unknown): ConstraintViolation | null => {
  const driverError = isRecord(error) && isRecord(error.cause) ? error.cause : error;
  if (!isRecord(driverError) || typeof driverError.code !== 'string' || typeof driverError.constraint !== 'string') {
    return null;
  }
  const kind = violationKinds[driverError.code];
  return kind ? { kind, constraint: driverError.constraint } : null;
};
